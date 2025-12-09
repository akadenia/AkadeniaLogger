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

export interface SignozLogBody {
  stringValue: string
}

export interface SignozLogRecord {
  timeUnixNano?: string
  traceId?: string
  spanId?: string
  traceFlags?: number
  severityText: string
  severityNumber?: number
  body: SignozLogBody
  attributes?: Array<{
    key: string
    value: { stringValue?: string; intValue?: string; doubleValue?: string; boolValue?: boolean }
  }>
}

export interface SignozResourceLog {
  resource?: {
    attributes?: Array<{
      key: string
      value: { stringValue?: string; intValue?: string; doubleValue?: string; boolValue?: boolean }
    }>
  }
  scopeLogs: Array<{
    logRecords: SignozLogRecord[]
  }>
}

export interface SignozOTLPPayload {
  resourceLogs: SignozResourceLog[]
}

export class SignozAdapter implements ILogger {
  name: string = "signoz"

  url: URL

  minimumLogLevel: Severity

  api: AxiosApiClient

  constructor(url: string | URL, minimumLogLevel = Severity.Debug) {
    this.minimumLogLevel = minimumLogLevel

    this.url = typeof url === "string" ? new URL(url) : url

    this.api = new AxiosApiClient({
      baseUrl: this.url.toString(),
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  private convertAttributesToOTLP(
    attrs: Record<string, any>,
  ): Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: string; boolValue?: boolean } }> {
    return Object.entries(attrs).map(([key, value]) => {
      if (typeof value === "string") {
        return { key, value: { stringValue: value } }
      } else if (typeof value === "number") {
        if (Number.isInteger(value)) {
          return { key, value: { intValue: value.toString() } }
        } else {
          return { key, value: { doubleValue: value.toString() } }
        }
      } else if (typeof value === "boolean") {
        return { key, value: { boolValue: value } }
      } else if (value === null || value === undefined) {
        return { key, value: { stringValue: "" } }
      } else {
        return { key, value: { stringValue: JSON.stringify(value) } }
      }
    })
  }

  private async captureMessage(message: string, severity: SignozSeverity, options?: Options) {
    const attributes: Record<string, any> = {}

    if (options?.extraData) {
      Object.assign(attributes, options.extraData)
    }

    if (options?.response) {
      Object.assign(attributes, options.response)
    }

    if (options?.signozPayload?.attributes) {
      Object.assign(attributes, options.signozPayload.attributes)
    }

    const now = Date.now()
    const timeUnixNano = (BigInt(now) * BigInt(1000000)).toString()

    const logRecord: SignozLogRecord = {
      timeUnixNano,
      severityText: severity,
      traceId: options?.signozPayload?.trace_id,
      spanId: options?.signozPayload?.span_id,
      traceFlags: options?.signozPayload?.trace_flags,
      severityNumber: options?.signozPayload?.severity_number,
      attributes: this.convertAttributesToOTLP(attributes),
      body: {
        stringValue: message,
      },
    }

    const resourceAttributes: Array<{
      key: string
      value: { stringValue?: string; intValue?: string; doubleValue?: string; boolValue?: boolean }
    }> = options?.signozPayload?.resources ? this.convertAttributesToOTLP(options.signozPayload.resources) : []

    const payload: SignozOTLPPayload = {
      resourceLogs: [
        {
          resource: resourceAttributes.length > 0 ? { attributes: resourceAttributes } : undefined,
          scopeLogs: [
            {
              logRecords: [logRecord],
            },
          ],
        },
      ],
    }

    const apiResponse = await this.api.post("", payload)
    if (!apiResponse.success) {
      console.debug(`${apiResponse.message}: ${apiResponse.data}`)

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
