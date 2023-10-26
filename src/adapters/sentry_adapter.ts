import { Severity, ILogger, Options } from "../logger"

export enum SentryLoggerSeverity {
  Warning = "warning",
  Error = "error",
  Exception = "exception",
  Info = "info",
  Fatal = "fatal",
}

export class SentryLoggerAdapter implements ILogger {
  name: string = "sentry"

  Sentry: any

  minimumLogLevel: Severity

  constructor(Sentry: any, minimumLogLevel = Severity.Debug) {
    this.Sentry = Sentry
    this.minimumLogLevel = minimumLogLevel
  }

  private setScope(options: Options) {
    this.Sentry.withScope((scope: any) => {
      scope.setExtra("extra-data", JSON.stringify(options.extraData, null, 4))
    })
  }

  debug(message: string, options?: Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureMessage(message, SentryLoggerSeverity.Info)
  }

  info(message: string, options?: Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureMessage(message, SentryLoggerSeverity.Info)
  }

  warn(message: string, options?: Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureMessage(message, SentryLoggerSeverity.Warning)
  }

  error(message: string, options?: Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureMessage(message, SentryLoggerSeverity.Error)
  }

  exception(message: string, exception: Error, options?: Options | undefined): void {
    if (options?.extraData) {
      this.setScope(options)
    }
    this.Sentry.captureException(exception, {
      extra: { message: message },
    })
  }
}
