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

  private captureMessage(message: string, severity: SentryLoggerSeverity, options?: Options) {
    this.Sentry.withScope((scope: any) => {
      if (options?.extraData) scope.setExtra("extra-data", JSON.stringify(options.extraData, null, 4))

      if (severity === SentryLoggerSeverity.Exception && options?.exception) {
        scope.setExtra("message", message)
        if (!(options.exception instanceof Error)) {
          options.exception = new Error(message)
          scope.setExtra("options", options)

          this.Sentry.captureMessage("Sentry.captureException was called with a non Error instance", SentryLoggerSeverity.Error)
        }

        this.Sentry.captureException(options.exception, scope)
      } else {
        this.Sentry.captureMessage(message, severity)
      }
    })
  }

  debug(message: string, options?: Options | undefined): void {
    this.captureMessage(message, SentryLoggerSeverity.Info, options)
  }

  info(message: string, options?: Options | undefined): void {
    this.captureMessage(message, SentryLoggerSeverity.Info, options)
  }

  warn(message: string, options?: Options | undefined): void {
    this.captureMessage(message, SentryLoggerSeverity.Warning, options)
  }

  error(message: string, options?: Options | undefined): void {
    this.captureMessage(message, SentryLoggerSeverity.Error, options)
  }

  exception(message: string, exception: Error, options?: Options | undefined): void {
    this.captureMessage(message, SentryLoggerSeverity.Exception, { ...options, exception })
  }
}
