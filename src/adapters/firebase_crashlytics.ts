import { ILogger, Options, PredefinedLogEvents, PredefinedLogOptions, Severity } from "../logger"

export enum LogSeverity {
  Warning = "WARNING",
  Error = "ERROR",
  Exception = "EXCEPTION",
  Info = "INFO",
  Fatal = "FATAL",
}

const replaceSpacesWithUnderscore = (s?: string): string => s?.trim().replace(/\s/g, "_") || ""

export class FireBaseCrashlyticsLoggerAdapter implements ILogger {
  name: string = "firebase_crashlytics"

  crashlytics: any

  analytics: any

  minimumLogLevel: Severity

  constructor(crashlytics: any, analytics: any, minimumLogLevel = Severity.Debug, collectionEnabled: boolean) {
    this.crashlytics = crashlytics
    this.analytics = analytics
    this.minimumLogLevel = minimumLogLevel

    this.analytics()
      .setAnalyticsCollectionEnabled(collectionEnabled)
      .catch((e: Error) => this.crashlytics().recordError(e, "Failed to enable analytics collection"))
  }

  private captureMessage(message: string, severity: LogSeverity, options?: Options) {
    switch (severity) {
      case LogSeverity.Exception:
      case LogSeverity.Error: {
        let error = severity === LogSeverity.Exception && options?.exception ? options.exception : new Error(message)
        this.crashlytics().setAttributes(options || {})
        this.crashlytics().recordError(error, message)
        break
      }
      case LogSeverity.Warning:
      case LogSeverity.Info: {
        this.analytics().logEvent(replaceSpacesWithUnderscore(message), options)
        break
      }
    }
  }

  public predefinedEvent(options: PredefinedLogOptions) {
    switch (options.type) {
      case PredefinedLogEvents.Login:
        this.analytics().logLogin({ method: "email" })
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

  debug(message: string, options?: Options): void {
    this.captureMessage(message, LogSeverity.Info, options)
  }

  info(message: string, options?: Options): void {
    this.captureMessage(message, LogSeverity.Info, options)
  }

  warn(message: string, options?: Options): void {
    this.captureMessage(message, LogSeverity.Warning, options)
  }

  error(message: string, options?: Options): void {
    this.captureMessage(message, LogSeverity.Error, options)
  }

  exception(message: string, exception: Error, options?: Options): void {
    this.captureMessage(message, LogSeverity.Exception, { ...options, exception })
  }
}
