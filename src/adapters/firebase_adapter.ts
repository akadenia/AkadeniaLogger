import { ILogger, Options, PredefinedLogEvents, PredefinedLogOptions, Severity } from "../logger"
import { safeStringify } from "../serialization"

export enum LogSeverity {
  Warning = "WARNING",
  Error = "ERROR",
  Exception = "EXCEPTION",
  Info = "INFO",
  Fatal = "FATAL",
}

// Firebase limits: https://support.google.com/analytics/answer/9267744
const MAX_NAME_LENGTH = 40
const MAX_EVENT_PARAMS = 25
const MAX_PARAM_VALUE_LENGTH = 100
const MAX_ATTRIBUTE_VALUE_LENGTH = 1024

// https://firebase.google.com/docs/reference/android/com/google/firebase/analytics/FirebaseAnalytics.Event
const RESERVED_EVENT_NAMES = new Set([
  "ad_activeview",
  "ad_click",
  "ad_exposure",
  "ad_impression",
  "ad_query",
  "ad_reward",
  "adunit_exposure",
  "app_background",
  "app_clear_data",
  "app_exception",
  "app_remove",
  "app_store_refund",
  "app_store_subscription_cancel",
  "app_store_subscription_convert",
  "app_store_subscription_renew",
  "app_update",
  "app_upgrade",
  "dynamic_link_app_open",
  "dynamic_link_app_update",
  "dynamic_link_first_open",
  "error",
  "first_open",
  "first_visit",
  "in_app_purchase",
  "notification_dismiss",
  "notification_foreground",
  "notification_open",
  "notification_receive",
  "os_update",
  "session_start",
  "session_start_with_rollout",
  "user_engagement",
])
const RESERVED_PREFIX = /^(firebase_|google_|ga_)/i

// Names must be alphanumeric/underscore, start with a letter, avoid reserved names and be at most 40 characters
const toFirebaseName = (s: string | undefined, prefix: string, reserved: Set<string> = new Set()): string => {
  const name = (s?.trim() || "").replace(/[^A-Za-z0-9_]/g, "_")
  const isValid = /^[A-Za-z]/.test(name) && !RESERVED_PREFIX.test(name) && !reserved.has(name.toLowerCase())
  return (isValid ? name : `${prefix}${name}`).substring(0, MAX_NAME_LENGTH)
}

const toEventName = (message: string) => toFirebaseName(message, "e_", RESERVED_EVENT_NAMES)

// Gives each param a unique name: a second "user_id" becomes "user_id_2"
const toUniqueParamName = (key: string, taken: Record<string, unknown>): string => {
  const name = toFirebaseName(key, "p_")
  let unique = name
  for (let i = 2; unique in taken; i++) {
    const suffix = `_${i}`
    unique = `${name.substring(0, MAX_NAME_LENGTH - suffix.length)}${suffix}`
  }
  return unique
}

type FlattenRules = {
  maxEntries: number
  maxValueLength: number
  keepNumbers: boolean
  toKey: (key: string, taken: Record<string, unknown>) => string
}

// extraData plus response status as flat key/value pairs; functions, symbols and empty values are skipped
const flattenFields = (options: Options | undefined, rules: FlattenRules): Record<string, string | number> => {
  const fields: Record<string, unknown> = {}
  if (options?.extraData && typeof options.extraData === "object") Object.assign(fields, options.extraData)
  if (options?.response?.status !== undefined) fields.response_status = options.response.status
  if (options?.response?.statusText !== undefined) fields.response_status_text = options.response.statusText

  const flat: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (Object.keys(flat).length >= rules.maxEntries) break
    if (value === null || value === undefined || typeof value === "function" || typeof value === "symbol") continue

    flat[rules.toKey(key, flat)] =
      rules.keepNumbers && typeof value === "number" && Number.isFinite(value)
        ? value
        : (typeof value === "object" ? safeStringify(value) : String(value)).substring(0, rules.maxValueLength)
  }
  return flat
}

// Analytics params: at most 25, string values up to 100 characters, or numbers
const toEventParams = (options?: Options) =>
  flattenFields(options, {
    maxEntries: MAX_EVENT_PARAMS,
    maxValueLength: MAX_PARAM_VALUE_LENGTH,
    keepNumbers: true,
    toKey: toUniqueParamName,
  })

// Crashlytics custom keys only accept string values
const toCrashlyticsAttributes = (options?: Options) =>
  flattenFields(options, {
    maxEntries: Infinity,
    maxValueLength: MAX_ATTRIBUTE_VALUE_LENGTH,
    keepNumbers: false,
    toKey: (key) => key,
  }) as Record<string, string>

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
        this.analytics().logEvent(toEventName(message), toEventParams(options))
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
