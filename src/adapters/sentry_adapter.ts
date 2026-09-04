import { Severity, ILogger, Options, ApiResponse, Attachment } from "../logger"
import { Client, Scope, SeverityLevel } from "@sentry/types"

const EXTRA_ATTACHMENT_THRESHOLD_BYTES = 16 * 1024
const AUTO_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
const EXTRA_DATA_ATTACHMENT_FILENAME = "extra-data.json"
const EXTRA_DATA_ATTACHMENT_NOTICE = "EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION"
const ATTACHMENT_TRUNCATED_SUFFIX = "... [ATTACHMENT TRUNCATED]"

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

  private processData(extraData: any, response?: ApiResponse): any {
    const processedData: any = { ...(extraData || {}) }

    // Add trimmed response if provided
    if (response && typeof response === "object") {
      const trimmedResponse = this.trimResponse(response)
      if (Object.keys(trimmedResponse).length > 0) {
        processedData.response = trimmedResponse
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

  private prepareExtraData(processedData: any): { extraString: string; autoAttachment?: Attachment } {
    const encoder = new TextEncoder()
    const dataString = this.safeStringify(processedData, 4)
    const dataSize = encoder.encode(dataString).length

    if (dataSize <= EXTRA_ATTACHMENT_THRESHOLD_BYTES) {
      return { extraString: dataString }
    }

    const attachmentTruncated = dataSize > AUTO_ATTACHMENT_MAX_BYTES
    let attachmentData = dataString

    if (attachmentTruncated) {
      const reservedBytes = encoder.encode(ATTACHMENT_TRUNCATED_SUFFIX).length
      attachmentData = `${this.truncateToByteSize(dataString, AUTO_ATTACHMENT_MAX_BYTES - reservedBytes)}${ATTACHMENT_TRUNCATED_SUFFIX}`
    }

    return {
      extraString: EXTRA_DATA_ATTACHMENT_NOTICE,
      autoAttachment: {
        filename: EXTRA_DATA_ATTACHMENT_FILENAME,
        data: attachmentData,
        contentType: "application/json",
      },
    }
  }

  private normalizeAttachmentData(data: unknown): string | Uint8Array | null {
    if (typeof data === "string") return data
    if (data instanceof Uint8Array) return data
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) return new Uint8Array(data)
    return null
  }

  private processAttachments(attachments: Attachment[]): Attachment[] {
    const processed: Attachment[] = []

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
        const processedData = this.processData(options.extraData, options.response)
        const { extraString, autoAttachment } = this.prepareExtraData(processedData)
        scope.setExtra("extra-data", extraString)
        if (autoAttachment) {
          scope.addAttachment(autoAttachment)
        }
      }

      if (options?.attachments?.length) {
        for (const attachment of this.processAttachments(options.attachments)) {
          scope.addAttachment(attachment)
        }
      }

      if (severity === SentrySeverity.Fatal && options?.exception) {
        scope.setExtra("message", message)
        if (!(options.exception instanceof Error)) {
          options.exception = new Error(message)
          scope.setExtra("options", options)

          this.Sentry.captureMessage("Sentry.captureException was called with a non Error instance", SentrySeverity.Error)
        }

        this.Sentry.captureException(options.exception, undefined, scope)
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
