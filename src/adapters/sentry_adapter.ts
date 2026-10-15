import { Severity, ILogger, Options, ApiResponse, Attachment } from "../logger"
import { maskSensitiveData, safeStringify, SensitiveKeyMasking } from "../serialization"
import { Client, Scope, SeverityLevel } from "@sentry/types"

const EXTRA_ATTACHMENT_THRESHOLD_BYTES = 16 * 1024
const AUTO_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
const SMALL_SCALAR_MAX_CHARS = 200
const EXTRA_DATA_ATTACHMENT_FILENAME = "extra-data.json"
const EXTRA_DATA_ATTACHMENT_NOTICE = "EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION"
const INLINE_TRUNCATED_SUFFIX = "... [TRUNCATED]"

export enum SentrySeverity {
  Debug = "debug",
  Warning = "warning",
  Error = "error",
  Info = "info",
  Fatal = "fatal",
}

interface SentryClient extends Client {
  withScope(callback: (scope: Scope) => void): void
}

type NormalizedAttachment = {
  filename: string
  data: string | Uint8Array
  contentType?: string
}

export class SentryAdapter implements ILogger {
  name: string = "sentry"

  Sentry: SentryClient

  minimumLogLevel: Severity

  constructor(Sentry: any, minimumLogLevel = Severity.Debug) {
    this.Sentry = Sentry
    this.minimumLogLevel = minimumLogLevel
  }

  private trimResponse(response: ApiResponse): any {
    // Trim response to only essential fields: status, statusText, message, data
    const trimmedResponse: any = {}
    if (response && typeof response === "object") {
      if (response.status !== undefined) trimmedResponse.status = response.status
      if (response.statusText !== undefined) trimmedResponse.statusText = response.statusText
      if (response.message !== undefined) trimmedResponse.message = response.message
      if (response.data !== undefined) trimmedResponse.data = response.data
    }

    return trimmedResponse
  }

  private processData(extraData: any, response?: ApiResponse, masking?: SensitiveKeyMasking): any {
    const processedData: any = maskSensitiveData({ ...(extraData || {}) }, masking)

    // Add trimmed response if provided
    if (response && typeof response === "object") {
      const trimmedResponse = this.trimResponse(response)
      if (Object.keys(trimmedResponse).length > 0) {
        processedData.response = maskSensitiveData(trimmedResponse, masking)
      }
    }

    return processedData
  }

  // One pass over UTF-16 code units: a binary search re-encodes the string on every step, which is slow
  // on multi-MB payloads. A surrogate pair is 4 UTF-8 bytes and is never split.
  private truncateToByteSize(str: string, maxBytes: number): string {
    let bytes = 0
    let end = 0
    while (end < str.length) {
      const code = str.charCodeAt(end)
      const next = str.charCodeAt(end + 1)
      const isPair = code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
      const size = isPair ? 4 : code < 0x80 ? 1 : code < 0x800 ? 2 : 3
      if (bytes + size > maxBytes) break
      bytes += size
      end += isPair ? 2 : 1
    }

    return str.substring(0, end)
  }

  private isSmallScalar(value: unknown): boolean {
    if (value === null) return true
    switch (typeof value) {
      case "number":
      case "boolean":
        return true
      case "string":
        return value.length <= SMALL_SCALAR_MAX_CHARS
      default:
        return false
    }
  }

  private buildSearchableExtraSummary(processedData: any): string {
    const summary: Record<string, unknown> = {}

    if (processedData && typeof processedData === "object") {
      for (const [key, value] of Object.entries(processedData)) {
        if (key === "response" && value && typeof value === "object") {
          const response = value as Record<string, unknown>
          const slim: Record<string, unknown> = {}
          if (response.status !== undefined) slim.status = response.status
          if (response.statusText !== undefined) slim.statusText = response.statusText
          if (Object.keys(slim).length > 0) summary.response = slim
          continue
        }

        if (this.isSmallScalar(value)) summary[key] = value
      }
    }

    // Set last so an extraData field named "notice" can't hide the pointer to the attachment
    summary.notice = EXTRA_DATA_ATTACHMENT_NOTICE
    return safeStringify(summary, 4)
  }

  // One pass over the escaped string: stringifying and encoding candidates in a binary search
  // freezes the logging call on multi-MB payloads (especially on Hermes)
  private buildTruncatedJsonEnvelope(dataString: string): string {
    const prefix = '{"truncated":true,"data":'
    const suffix = '"}'
    const escaped = JSON.stringify(dataString) // starts with a quote, so the cut below keeps it
    const budget = AUTO_ATTACHMENT_MAX_BYTES - prefix.length - suffix.length

    // Walk whole tokens (escape sequences, surrogate pairs, single chars) so the cut is never inside one
    let bytes = 0
    let end = 0
    while (end < escaped.length - 1) {
      const code = escaped.charCodeAt(end)
      let length = 1
      let size: number
      if (code === 0x5c) {
        length = escaped[end + 1] === "u" ? 6 : 2
        size = length
      } else if (code >= 0xd800 && code <= 0xdbff) {
        length = 2
        size = 4
      } else {
        size = code < 0x80 ? 1 : code < 0x800 ? 2 : 3
      }
      if (bytes + size > budget) break
      bytes += size
      end += length
    }

    return `${prefix}${escaped.substring(0, end)}${suffix}`
  }

  private truncateDataIfNeeded(dataString: string): string {
    const encoder = new TextEncoder()
    if (encoder.encode(dataString).length <= EXTRA_ATTACHMENT_THRESHOLD_BYTES) {
      return dataString
    }

    const reservedBytes = encoder.encode(INLINE_TRUNCATED_SUFFIX).length
    return `${this.truncateToByteSize(dataString, EXTRA_ATTACHMENT_THRESHOLD_BYTES - reservedBytes)}${INLINE_TRUNCATED_SUFFIX}`
  }

  private prepareExtraData(processedData: any): {
    dataString: string
    extraString: string
    autoAttachment?: NormalizedAttachment
  } {
    const encoder = new TextEncoder()
    const dataString = safeStringify(processedData, 4)
    const dataSize = encoder.encode(dataString).length

    if (dataSize <= EXTRA_ATTACHMENT_THRESHOLD_BYTES) {
      return { dataString, extraString: dataString }
    }

    const attachmentData = dataSize > AUTO_ATTACHMENT_MAX_BYTES ? this.buildTruncatedJsonEnvelope(dataString) : dataString

    return {
      dataString,
      extraString: this.buildSearchableExtraSummary(processedData),
      autoAttachment: {
        filename: EXTRA_DATA_ATTACHMENT_FILENAME,
        data: attachmentData,
        contentType: "application/json",
      },
    }
  }

  private normalizeAttachmentData(data: unknown): string | Uint8Array | null {
    if (typeof data === "string") return data
    if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0))
    if (data instanceof Uint8Array) return new Uint8Array(data)
    return null
  }

  private tryAddAttachment(scope: Scope, attachment: NormalizedAttachment): boolean {
    const addAttachment = (scope as Scope & { addAttachment?: unknown }).addAttachment
    if (typeof addAttachment !== "function") return false
    try {
      addAttachment.call(scope, attachment)
      return true
    } catch {
      // A rejected attachment must not drop the event itself
      return false
    }
  }

  private processAttachments(attachments: Attachment[]): NormalizedAttachment[] {
    const processed: NormalizedAttachment[] = []

    for (const attachment of attachments) {
      if (!attachment?.filename || typeof attachment.filename !== "string" || !attachment.filename.trim()) {
        continue
      }

      const data = this.normalizeAttachmentData(attachment.data)
      if (data === null) continue

      processed.push({
        filename: attachment.filename,
        data,
        ...(attachment.contentType !== undefined && { contentType: attachment.contentType }),
      })
    }

    return processed
  }

  private captureMessage(message: string, severity: SeverityLevel, options?: Options) {
    let capturedNonError = false

    this.Sentry.withScope((scope: Scope) => {
      if (options?.extraData || options?.response) {
        const processedData = this.processData(options.extraData, options.response, options.masking)
        const { dataString, extraString, autoAttachment } = this.prepareExtraData(processedData)
        if (autoAttachment) {
          if (this.tryAddAttachment(scope, autoAttachment)) {
            scope.setExtra("extra-data", extraString)
          } else {
            // Old SDKs without attachments: reuse the string already built instead of serializing again
            scope.setExtra("extra-data", this.truncateDataIfNeeded(dataString))
          }
        } else {
          scope.setExtra("extra-data", extraString)
        }
      }

      if (options?.attachments?.length) {
        for (const attachment of this.processAttachments(options.attachments)) {
          this.tryAddAttachment(scope, attachment)
        }
      }

      if (severity === SentrySeverity.Fatal && options?.exception) {
        scope.setExtra("message", message)
        const exception = options.exception instanceof Error ? options.exception : new Error(message)
        if (!(options.exception instanceof Error)) {
          // extraData and response are already in "extra-data", masked and size-capped
          const {
            attachments: _attachments,
            exception: _exception,
            extraData: _extraData,
            response: _response,
            masking: _masking,
            ...optionsForExtra
          } = options
          scope.setExtra(
            "options",
            this.truncateDataIfNeeded(safeStringify(maskSensitiveData(optionsForExtra, options.masking), 4)),
          )
          capturedNonError = true
        }

        this.Sentry.captureException(exception, undefined, scope)
      } else {
        this.Sentry.captureMessage(message, severity)
      }
    })

    // Outside the scope above so this notice doesn't upload the event's attachments a second time
    if (capturedNonError) {
      this.Sentry.captureMessage("Sentry.captureException was called with a non Error instance", SentrySeverity.Error)
    }
  }

  trace(message: string, options?: Options | undefined): void {
    if (this.minimumLogLevel > Severity.Trace) return

    this.captureMessage(message, SentrySeverity.Info, options)
  }

  debug(message: string, options?: Options | undefined): void {
    if (this.minimumLogLevel > Severity.Debug) return

    this.captureMessage(message, SentrySeverity.Info, options)
  }

  info(message: string, options?: Options | undefined): void {
    if (this.minimumLogLevel > Severity.Info) return

    this.captureMessage(message, SentrySeverity.Info, options)
  }

  warn(message: string, options?: Options | undefined): void {
    if (this.minimumLogLevel > Severity.Warn) return

    this.captureMessage(message, SentrySeverity.Warning, options)
  }

  error(message: string, options?: Options | undefined): void {
    if (this.minimumLogLevel > Severity.Error) return

    this.captureMessage(message, SentrySeverity.Error, options)
  }

  exception(message: string, exception: Error, options?: Options | undefined): void {
    this.captureMessage(message, SentrySeverity.Fatal, { ...options, exception })
  }

  flush(duration: number): void {
    this.Sentry.flush(duration)
  }
}
