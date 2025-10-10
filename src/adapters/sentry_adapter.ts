import { Severity, ILogger, Options } from "../logger"
import { Client, Scope, SeverityLevel } from "@sentry/types"
import { AkadeniaApiResponse } from "@akadenia/api"

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

  private trimResponse(response: AkadeniaApiResponse): any {
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

  private processData(extraData: any, response?: AkadeniaApiResponse): any {
    // Accommodate extraData first (Sentry has 16kb limit)
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

  private truncateDataIfNeeded(processedData: any): string {
    const SENTRY_MAX_SIZE = 16 * 1024 // 16kb in bytes
    let dataString = JSON.stringify(processedData, null, 4)
    let dataSize = new TextEncoder().encode(dataString).length

    if (dataSize > SENTRY_MAX_SIZE) {
      // Create a deep copy to avoid mutating the original object
      const dataCopy = JSON.parse(JSON.stringify(processedData))

      // If there's a response with data, try to truncate just the response.data first
      if (processedData.response?.data) {
        const tempData = JSON.parse(JSON.stringify(dataCopy))
        delete tempData.response.data
        const baseSize = new TextEncoder().encode(JSON.stringify(tempData, null, 4)).length
        const availableSpace = SENTRY_MAX_SIZE - baseSize - 100 // Reserve 100 bytes for truncation indicator

        if (availableSpace > 0) {
          const dataStr = JSON.stringify(dataCopy.response.data)
          const dataBytes = new TextEncoder().encode(dataStr)

          if (dataBytes.length > availableSpace) {
            // Truncate response.data to fit within limit using byte-based truncation
            const truncated = this.truncateToByteSize(dataStr, availableSpace - 20) // Reserve space for truncation indicator
            dataCopy.response.data = `${truncated}... [TRUNCATED]`
            dataCopy.response._dataTruncated = true
            dataString = JSON.stringify(dataCopy, null, 4)
          }
        } else {
          dataCopy.response.data = "[Removed - Exceeds size limit]"
          dataCopy.response._dataTruncated = true
          dataString = JSON.stringify(dataCopy, null, 4)
        }
      } else {
        // No response.data to truncate, truncate the entire payload using byte-based truncation
        const truncated = this.truncateToByteSize(dataString, SENTRY_MAX_SIZE - 50)
        dataString = `${truncated}... [TRUNCATED - extraData]`
      }
    }

    return dataString
  }

  private captureMessage(message: string, severity: SeverityLevel, options?: Options) {
    this.Sentry.withScope((scope: Scope) => {
      if (options?.extraData || options?.response) {
        // Process extraData and response together
        const processedData = this.processData(options.extraData, options.response)

        // Always check size limits to prevent exceeding Sentry's 16KB limit
        const dataString = this.truncateDataIfNeeded(processedData)
        scope.setExtra("extra-data", dataString)
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
