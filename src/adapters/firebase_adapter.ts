import { ILogger, Options, PredefinedLogEvents, PredefinedLogOptions, Severity } from "../logger"

export enum LogSeverity {
  Warning = "WARNING",
  Error = "ERROR",
  Exception = "EXCEPTION",
  Info = "INFO",
  Fatal = "FATAL",
}

// Firebase Analytics limits: https://support.google.com/analytics/answer/9267744
const MAX_NAME_LENGTH = 40
const MAX_PARAM_VALUE_LENGTH = 100
const MAX_ATTRIBUTE_VALUE_LENGTH = 1024

// Names must be alphanumeric/underscore, start with a letter, and be at most 40 characters
const toFirebaseName = (s?: string): string => {
  const name = (s?.trim() || "").replace(/[^A-Za-z0-9_]/g, "_")
  return (/^[A-Za-z]/.test(name) ? name : `e_${name}`).substring(0, MAX_NAME_LENGTH)
}

const stringifyValue = (value: unknown, maxLength: number): string => {
  let str: string
  if (typeof value === "string") {
    str = value
  } else {
    try {
      str = JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val)) ?? String(value)
    } catch {
      str = "[Unserializable value]"
    }
  }
  return str.length > maxLength ? str.substring(0, maxLength) : str
}

const collectFields = (options?: Options): Record<string, unknown> => {
  const fields: Record<string, unknown> = {}
  if (options?.extraData && typeof options.extraData === "object") Object.assign(fields, options.extraData)
  if (options?.response?.status !== undefined) fields.response_status = options.response.status
  if (options?.response?.statusText !== undefined) fields.response_status_text = options.response.statusText
  return fields
}

// Analytics params are flat: string values up to 100 characters, or numbers
const toEventParams = (options?: Options): Record<string, string | number> => {
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(collectFields(options))) {
    if (value === null || value === undefined) continue
    params[toFirebaseName(key)] =
      typeof value === "number" && Number.isFinite(value) ? value : stringifyValue(value, MAX_PARAM_VALUE_LENGTH)
  }
  return params
}

// Crashlytics custom keys only accept string values
const toCrashlyticsAttributes = (options?: Options): Record<string, string> => {
  const attributes: Record<string, string> = {}
  for (const [key, value] of Object.entries(collectFields(options))) {
    if (value === null || value === undefined) continue
    attributes[key] = stringifyValue(value, MAX_ATTRIBUTE_VALUE_LENGTH)
  }
  return attributes
}

export class FirebaseAdapter implements ILogger {
  name: string = "firebase_crashlytics"

  crashlytics: any

  analytics: any

  minimumLogLevel: Severity

  constructor(crashlytics: any, analytics: any, minimumLogLevel = Severity.Debug, collectionEnabled = true) {
    this.crashlytics = crashlytics
    this.analytics = analytics
    this.minimumLogLevel = minimumLogLevel

    Promise.resolve(this.analytics().setAnalyticsCollectionEnabled(collectionEnabled)).catch((e: Error) =>
      this.crashlytics().recordError(e, "Failed to enable analytics collection"),
    )
  }

  private captureMessage(message: string, severity: LogSeverity, options?: Options) {
    switch (severity) {
      case LogSeverity.Exception:
      case LogSeverity.Error: {
        const error = severity === LogSeverity.Exception && options?.exception ? options.exception : new Error(message)
        this.crashlytics().setAttributes(toCrashlyticsAttributes(options))
        this.crashlytics().recordError(error, message)
        break
      }
      case LogSeverity.Warning:
      case LogSeverity.Info: {
        this.analytics().logEvent(toFirebaseName(message), toEventParams(options))
        break
      }
    }
  }

  public predefinedEvent(options: PredefinedLogOptions) {
    switch (options.type) {
      case PredefinedLogEvents.Login:
        this.analytics().logLogin({ method: options.extraData?.method ?? "email" })
        break
      case PredefinedLogEvents.Share: {
        const { contentType, itemId, method } = options.extraData
        this.analytics().logShare({ content_type: contentType, item_id: itemId, method })
        break
      }
      case PredefinedLogEvents.AppOpen:
        this.analytics().logAppOpen()
        break
      case PredefinedLogEvents.Search:
        this.analytics().logSearch({ search_term: options.extraData.searchTerm })
        break
    }
  }

  trace(message: string, options?: Options): void {
    if (this.minimumLogLevel > Severity.Trace) return

    this.captureMessage(message, LogSeverity.Info, options)
  }

  debug(message: string, options?: Options): void {
    if (this.minimumLogLevel > Severity.Debug) return

    this.captureMessage(message, LogSeverity.Info, options)
  }

  info(message: string, options?: Options): void {
    if (this.minimumLogLevel > Severity.Info) return

    this.captureMessage(message, LogSeverity.Info, options)
  }

  warn(message: string, options?: Options): void {
    if (this.minimumLogLevel > Severity.Warn) return

    this.captureMessage(message, LogSeverity.Warning, options)
  }

  error(message: string, options?: Options): void {
    if (this.minimumLogLevel > Severity.Error) return

    this.captureMessage(message, LogSeverity.Error, options)
  }

  exception(message: string, exception: Error, options?: Options): void {
    this.captureMessage(message, LogSeverity.Exception, { ...options, exception })
  }
}
