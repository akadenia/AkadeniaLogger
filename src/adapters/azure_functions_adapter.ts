import { Severity, ILogger, Options } from "../logger"

export enum AzureFunctionsSeverity {
  Error = "error",
  Warn = "warn",
  Verbose = "verbose",
  Info = "info",
}

export class AzureFunctionsAdapter implements ILogger {
  name: string = "AzureFunctions"

  minimumLogLevel: Severity

  context: any

  constructor(context: any, minimumLogLevel = Severity.Debug) {
    this.minimumLogLevel = minimumLogLevel
  }

  private async captureMessage(message: string, severity: AzureFunctionsSeverity, options?: Options) {
    this.context[severity](message)
  }

  async trace(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Trace) return

    this.captureMessage(message, AzureFunctionsSeverity.Verbose, options)
  }

  async debug(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Debug) return

    this.captureMessage(message, AzureFunctionsSeverity.Verbose, options)
  }

  async info(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Info) return

    this.captureMessage(message, AzureFunctionsSeverity.Info, options)
  }

  async warn(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Warn) return

    this.captureMessage(message, AzureFunctionsSeverity.Warn, options)
  }

  async error(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Error) return

    this.captureMessage(message, AzureFunctionsSeverity.Error, options)
  }

  async exception(message: string, exception: Error, options?: Options | undefined) {
    this.captureMessage(`${message} - ${exception.toString()}`, AzureFunctionsSeverity.Error, options)
  }
}
