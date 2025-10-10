import { Severity, ILogger, Options } from "../logger"
import { Client, Scope, SeverityLevel } from "@sentry/types"

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

  private trimAndProcessResponseData(extraData: any): any {
    const { response, ...otherFields } = extraData

    // Trim response to only essential fields: status, statusText, message, data
    const trimmedResponse: any = {}
    if (response && typeof response === "object") {
      if (response.status !== undefined) trimmedResponse.status = response.status
      if (response.statusText !== undefined) trimmedResponse.statusText = response.statusText
      if (response.message !== undefined) trimmedResponse.message = response.message
      if (response.data !== undefined) trimmedResponse.data = response.data
    }

    // Accommodate other fields first before response (Sentry has 16kb limit)
    const processedData: any = {}
    Object.assign(processedData, otherFields)

    // Add trimmed response last
    if (Object.keys(trimmedResponse).length > 0) {
      processedData.response = trimmedResponse
    }

    return processedData
  }

  private truncateDataIfNeeded(processedData: any): string {
    const SENTRY_MAX_SIZE = 16 * 1024 // 16kb in bytes
    let dataString = JSON.stringify(processedData, null, 4)
    let dataSize = new TextEncoder().encode(dataString).length

    if (dataSize > SENTRY_MAX_SIZE && processedData.response?.data) {
      // Create a deep copy to avoid mutating the original object
      const dataCopy = JSON.parse(JSON.stringify(processedData))

      // Calculate available space for response.data
      const tempData = JSON.parse(JSON.stringify(dataCopy))
      delete tempData.response.data
      const baseSize = new TextEncoder().encode(JSON.stringify(tempData, null, 4)).length
      const availableSpace = SENTRY_MAX_SIZE - baseSize - 100 // Reserve 100 bytes for truncation indicator

      if (availableSpace > 0) {
        const dataStr = JSON.stringify(dataCopy.response.data)
        if (dataStr?.length > availableSpace) {
          // Truncate response.data to fit within limit
          const truncated = dataStr.substring(0, availableSpace)
          dataCopy.response.data = `${truncated}... [TRUNCATED]`
          dataCopy.response._dataTruncated = true
        }
      } else {
        dataCopy.response.data = "[Removed - Exceeds size limit]"
        dataCopy.response._dataTruncated = true
      }

      dataString = JSON.stringify(dataCopy, null, 4)
    }

    return dataString
  }

  private captureMessage(message: string, severity: SeverityLevel, options?: Options) {
    this.Sentry.withScope((scope: Scope) => {
      if (options?.extraData) {
        const extraData = { ...options.extraData }

        if (!extraData.response || typeof extraData.response !== "object" || !Object.keys(extraData.response).length) {
          scope.setExtra("extra-data", JSON.stringify(extraData, null, 4))
        } else {
          const processedData = this.trimAndProcessResponseData(extraData)
          const dataString = this.truncateDataIfNeeded(processedData)
          scope.setExtra("extra-data", dataString)
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
