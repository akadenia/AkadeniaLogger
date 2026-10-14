import { Severity, ILogger, Options, ApiResponse, Attachment } from "../logger"
import { maskSensitiveData, SensitiveKeyMasking } from "../serialization"
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

  private safeStringify(value: any, space?: number): string {
    const seen = new WeakSet()
    try {
      return JSON.stringify(
        value,
        (key, val) => {
          if (typeof val === "bigint") return val.toString()
          if (typeof val === "object" && val !== null) {
            if (seen.has(val)) return "[Circular]"
            seen.add(val)
          }
          return val
        },
        space,
      )!
    } catch {
      return "[Unserializable extra-data]"
    }
  }

  private truncateToByteSize(str: string, maxBytes: number): string {
    const encoder = new TextEncoder()
    let truncated = str

    // Use binary search for better performance on large strings
    if (encoder.encode(truncated).length <= maxBytes) {
      return truncated
    }

    // Binary search to find the optimal truncation point
    let left = 0
    let right = str.length
    let bestFit = 0

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const testStr = str.substring(0, mid)
      const byteSize = encoder.encode(testStr).length

      if (byteSize <= maxBytes) {
        bestFit = mid
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    return str.substring(0, bestFit)
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
    const summary: Record<string, unknown> = { notice: EXTRA_DATA_ATTACHMENT_NOTICE }

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

    return this.safeStringify(summary, 4)
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

  private truncateDataIfNeeded(processedData: any): string {
    const encoder = new TextEncoder()
    const dataString = this.safeStringify(processedData, 4)

    if (encoder.encode(dataString).length <= EXTRA_ATTACHMENT_THRESHOLD_BYTES) {
      return dataString
    }

    const reservedBytes = encoder.encode(INLINE_TRUNCATED_SUFFIX).length
    return `${this.truncateToByteSize(dataString, EXTRA_ATTACHMENT_THRESHOLD_BYTES - reservedBytes)}${INLINE_TRUNCATED_SUFFIX}`
  }

  private prepareExtraData(processedData: any): { extraString: string; autoAttachment?: NormalizedAttachment } {
    const encoder = new TextEncoder()
    const dataString = this.safeStringify(processedData, 4)
    const dataSize = encoder.encode(dataString).length

    if (dataSize <= EXTRA_ATTACHMENT_THRESHOLD_BYTES) {
      return { extraString: dataString }
    }

    const attachmentData = dataSize > AUTO_ATTACHMENT_MAX_BYTES ? this.buildTruncatedJsonEnvelope(dataString) : dataString

    return {
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
    addAttachment.call(scope, attachment)
    return true
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
    this.Sentry.withScope((scope: Scope) => {
      if (options?.extraData || options?.response) {
        const processedData = this.processData(options.extraData, options.response, options.masking)
        const { extraString, autoAttachment } = this.prepareExtraData(processedData)
        if (autoAttachment) {
          if (this.tryAddAttachment(scope, autoAttachment)) {
            scope.setExtra("extra-data", extraString)
          } else {
            scope.setExtra("extra-data", this.truncateDataIfNeeded(processedData))
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
            ...optionsForExtra
          } = options
          scope.setExtra("options", maskSensitiveData(optionsForExtra, options.masking))
          this.Sentry.captureMessage("Sentry.captureException was called with a non Error instance", SentrySeverity.Error)
        }

        this.Sentry.captureException(exception, undefined, scope)
      } else {
        this.Sentry.captureMessage(message, severity)
      }
    })
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
