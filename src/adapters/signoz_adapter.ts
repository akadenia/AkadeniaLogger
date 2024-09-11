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
  message: string
}

export class SignozAdapter implements ILogger {
  name: string = "signoz"

  url: URL

  minimumLogLevel: Severity

  api: AxiosApiClient

  constructor(host: string, port: number = 8082, minimumLogLevel = Severity.Debug) {
    this.minimumLogLevel = minimumLogLevel

    this.url = new URL(`http://${host}:${port}`)

    this.api = new AxiosApiClient({
      baseUrl: this.url.toString(),
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  private async captureMessage(message: string, severity: SignozSeverity, options?: Options) {
    const payload: SignozLog[] = [
      {
        trace_id: options?.signozPayload?.trace_id,
        span_id: options?.signozPayload?.span_id,
        trace_flags: options?.signozPayload?.trace_flags,
        severity_text: severity,
        severity_number: options?.signozPayload?.severity_number,
        attributes: options?.signozPayload?.attributes,
        resources: options?.signozPayload?.resources,
        message: message,
      },
    ]

    const response = await this.api.post("", payload)
    if (!response.success) {
      console.log(`${response.message}: ${response.data}`)

      return false
    }

    return true
  }

  async trace(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Trace) return

    this.captureMessage(message, SignozSeverity.Trace, options)
  }

  async debug(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Debug) return

    this.captureMessage(message, SignozSeverity.Debug, options)
  }

  async info(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Info) return

    this.captureMessage(message, SignozSeverity.Info, options)
  }

  async warn(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Warn) return

    this.captureMessage(message, SignozSeverity.Warn, options)
  }

  async error(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Error) return

    this.captureMessage(message, SignozSeverity.Error, options)
  }

  async exception(message: string, exception: Error, options?: Options | undefined) {
    this.captureMessage(message, SignozSeverity.Fatal, { ...options, exception })
  }
}
