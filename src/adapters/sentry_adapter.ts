import { AkadeniaLogger } from "../logger"

export enum SentryLoggerSeverity {
  Warning = "warning",
  Error = "error",
  Exception = "exception",
  Info = "info",
  Fatal = "fatal",
}

export class SentryLoggerAdapter implements AkadeniaLogger.ILogger {
  name: string = "sentry"

  Sentry: any

  minimumLogLevel: AkadeniaLogger.Severity

  constructor(Sentry: any, minimumLogLevel = AkadeniaLogger.Severity.Debug) {
    this.Sentry = Sentry
    this.minimumLogLevel = minimumLogLevel
  }

  private setScope(options: AkadeniaLogger.Options) {
    this.Sentry.withScope((scope: any) => {
      scope.setExtra("extra-data", JSON.stringify(options.extraData, null, 4))
    })
  }

  debug(message: string, options?: AkadeniaLogger.Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureMessage(message, SentryLoggerSeverity.Info)
  }

  info(message: string, options?: AkadeniaLogger.Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureMessage(message, SentryLoggerSeverity.Info)
  }

  warn(message: string, options?: AkadeniaLogger.Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureMessage(message, SentryLoggerSeverity.Warning)
  }

  error(message: string, options?: AkadeniaLogger.Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureMessage(message, SentryLoggerSeverity.Error)
  }

  exception(message: string, exception: Error, options?: AkadeniaLogger.Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureException(exception, {
      extra: { message: message },
    })
  }
}
