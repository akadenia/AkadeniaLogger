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
    this.context = context
  }

  private async captureMessage(message: string, severity: AzureFunctionsSeverity, options?: Options) {
    if (!this.context || typeof this.context[severity] !== 'function') {
      throw new Error(`Invalid Azure Functions context or missing ${severity} method`)
    }
    const logMessage = options?.extra 
      ? `${message} ${JSON.stringify(options.extra)}`
      : message
    this.context[severity](logMessage)
  }

  async trace(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Trace) return
    await this.captureMessage(message, AzureFunctionsSeverity.Trace, options)
  }

  async debug(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Debug) return
    await this.captureMessage(message, AzureFunctionsSeverity.Verbose, options)
  }

  async info(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Info) return

    await this.captureMessage(message, AzureFunctionsSeverity.Info, options)
  }

  async warn(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Warn) return

    await this.captureMessage(message, AzureFunctionsSeverity.Warn, options)
  }

  async error(message: string, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Error) return

    await this.captureMessage(message, AzureFunctionsSeverity.Error, options)
  }

  async exception(message: string, exception: Error, options?: Options | undefined) {
    if (this.minimumLogLevel > Severity.Error) return
    await this.captureMessage(`${message} - ${exception.toString()}`, AzureFunctionsSeverity.Error, options)
  }
}
