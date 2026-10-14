import { Severity, ILogger, Options } from "../logger"
import { safeStringify } from "../serialization"

export enum SignozSeverity {
  Warn = "warn",
  Error = "error",
  Debug = "debug",
  Trace = "trace",
  Info = "info",
  Fatal = "fatal",
}

// OTLP severity numbers: https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
const SIGNOZ_SEVERITY_NUMBERS: Record<SignozSeverity, number> = {
  [SignozSeverity.Trace]: 1,
  [SignozSeverity.Debug]: 5,
  [SignozSeverity.Info]: 9,
  [SignozSeverity.Warn]: 13,
  [SignozSeverity.Error]: 17,
  [SignozSeverity.Fatal]: 21,
}

const DEFAULT_TIMEOUT_MS = 5000

export type SignozAdapterConfig = {
  // Extra request headers, e.g. { "signoz-ingestion-key": "..." } for SigNoz Cloud
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface SignozAttribute {
  key: string
  value: { stringValue?: string; intValue?: string; doubleValue?: string; boolValue?: boolean }
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
  attributes?: SignozAttribute[]
}

export interface SignozResourceLog {
  resource?: {
    attributes?: SignozAttribute[]
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

  headers: Record<string, string>

  timeoutMs: number

  private pending = new Set<Promise<boolean>>()

  constructor(url: string | URL, minimumLogLevel = Severity.Debug, config?: SignozAdapterConfig) {
    this.minimumLogLevel = minimumLogLevel
    this.url = typeof url === "string" ? new URL(url) : url
    this.headers = { "Content-Type": "application/json", ...config?.headers }
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private convertAttributesToOTLP(attrs: Record<string, any>): SignozAttribute[] {
    return Object.entries(attrs).map(([key, value]) => {
      if (typeof value === "string") {
        return { key, value: { stringValue: value } }
      } else if (typeof value === "number") {
        if (Number.isInteger(value)) {
          return { key, value: { intValue: value.toString() } }
        } else {
          return { key, value: { doubleValue: value.toString() } }
        }
      } else if (typeof value === "bigint") {
        return { key, value: { intValue: value.toString() } }
      } else if (typeof value === "boolean") {
        return { key, value: { boolValue: value } }
      } else if (value === null || value === undefined) {
        return { key, value: { stringValue: "" } }
      } else {
        return { key, value: { stringValue: safeStringify(value) } }
      }
    })
  }

  private captureMessage(message: string, severity: SignozSeverity, options?: Options): Promise<boolean> {
    const request = this.send(message, severity, options)
    this.pending.add(request)
    request.finally(() => this.pending.delete(request))
    return request
  }

  // Never rejects: Logger doesn't await adapters, so a rejection would surface as an unhandled rejection
  private async send(message: string, severity: SignozSeverity, options?: Options): Promise<boolean> {
    let payload: SignozOTLPPayload
    try {
      payload = this.buildPayload(message, severity, options)
    } catch (err) {
      console.debug("SignozAdapter payload error:", err)
      return false
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(this.url.toString(), {
        method: "POST",
        headers: this.headers,
        body: safeStringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        console.debug(`${response.statusText}: ${text}`)
        return false
      }

      return true
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === "AbortError") {
        console.debug("SignozAdapter fetch timeout")
        return false
      }
      console.debug("SignozAdapter fetch error:", err)
      return false
    }
  }

  private buildPayload(message: string, severity: SignozSeverity, options?: Options): SignozOTLPPayload {
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

    if (options?.exception) {
      if (options.exception instanceof Error) {
        attributes.exception_message = options.exception.message
        if (options.exception.stack) {
          attributes.exception_stack = options.exception.stack
        }
        if (options.exception.name) {
          attributes.exception_name = options.exception.name
        }
      } else if (typeof options.exception === "string") {
        attributes.exception = options.exception
      } else if (typeof options.exception === "object") {
        Object.assign(attributes, options.exception)
      }
    }

    const now = Date.now()
    const timeUnixNano = (BigInt(now) * BigInt(1000000)).toString()

    const logRecord: SignozLogRecord = {
      timeUnixNano,
      severityText: severity,
      traceId: options?.signozPayload?.trace_id,
      spanId: options?.signozPayload?.span_id,
      traceFlags: options?.signozPayload?.trace_flags,
      severityNumber: options?.signozPayload?.severity_number ?? SIGNOZ_SEVERITY_NUMBERS[severity],
      attributes: this.convertAttributesToOTLP(attributes),
      body: {
        stringValue: message,
      },
    }

    const resourceAttributes: SignozAttribute[] = options?.signozPayload?.resources
      ? this.convertAttributesToOTLP(options.signozPayload.resources)
      : []

    const resourceLog: SignozResourceLog = {
      scopeLogs: [
        {
          logRecords: [logRecord],
        },
      ],
    }

    if (resourceAttributes.length > 0) {
      resourceLog.resource = { attributes: resourceAttributes }
    }

    return { resourceLogs: [resourceLog] }
  }

  async trace(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Trace) return

    await this.captureMessage(message, SignozSeverity.Trace, options)
  }

  async debug(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Debug) return

    await this.captureMessage(message, SignozSeverity.Debug, options)
  }

  async info(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Info) return

    await this.captureMessage(message, SignozSeverity.Info, options)
  }

  async warn(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Warn) return

    await this.captureMessage(message, SignozSeverity.Warn, options)
  }

  async error(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Error) return

    await this.captureMessage(message, SignozSeverity.Error, options)
  }

  async exception(message: string, exception: Error, options?: Options | undefined) {
    await this.captureMessage(message, SignozSeverity.Fatal, { ...options, exception })
  }

  /**
   * Wait for in-flight log requests to finish.
   * @returns true if all requests settled within `duration` ms, false on timeout
   */
  async flush(duration: number): Promise<boolean> {
    if (this.pending.size === 0) return true

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<boolean>((resolve) => {
      timeoutId = setTimeout(() => resolve(false), duration)
    })
    const settled = Promise.all(this.pending).then(() => true)

    const result = await Promise.race([settled, timeout])
    clearTimeout(timeoutId)
    return result
  }
}
