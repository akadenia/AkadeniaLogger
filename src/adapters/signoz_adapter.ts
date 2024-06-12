import { Severity, ILogger, Options } from "../logger"
import { AxiosApiClient } from "@akadenia/api"

export enum SignozSeverity {
  Warn = "warn",
  Error = "error",
  Debug = "debug",
  Trace = "trace",
  Info = "info",
  Fatal = "fatal",
}

export interface SignozLog {
  timestamp?: number
  trace_id?: string
  span_id?: string
  trace_flags?: number
  severity_text: string
  severity_number?: number
  attributes?: Record<string, any>
  resources?: Record<string, any>
  body: string
}

export class SignozAdapter implements ILogger {
  name: string = "signoz"

  host: string

  token: string

  minimumLogLevel: Severity

  api: AxiosApiClient

  constructor(host: string, token: string, minimumLogLevel = Severity.Debug) {
    this.host = host
    this.token = token
    this.minimumLogLevel = minimumLogLevel

    this.api = new AxiosApiClient(this.host, {
      "Content-Type": "application/json",
    })
  }

  private async captureMessage(message: string, severity: SignozSeverity, options?: Options) {
    const payload: SignozLog = {
      severity_text: severity,
      body: message,
    }

    const response = await this.api.post<SignozLog>("/", payload)
    if (!response.success) {
      console.log(response.message || "Failed to send log to Signoz")
    }
  }

  debug(message: string, options?: Options | undefined): void {
    this.captureMessage(message, SignozSeverity.Debug, options)
  }

  info(message: string, options?: Options | undefined): void {
    this.captureMessage(message, SignozSeverity.Info, options)
  }

  warn(message: string, options?: Options | undefined): void {
    this.captureMessage(message, SignozSeverity.Warn, options)
  }

  error(message: string, options?: Options | undefined): void {
    this.captureMessage(message, SignozSeverity.Error, options)
  }

  exception(message: string, exception: Error, options?: Options | undefined): void {
    this.captureMessage(message, SignozSeverity.Fatal, { ...options, exception })
  }
}
