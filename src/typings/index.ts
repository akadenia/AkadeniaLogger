export enum Severity {
  Debug = 1,
  Info,
  Warn,
  Error,
}

export type Options = {
  overrideConsole?: boolean
  overrideDebug?: boolean
  extraData?: any
}

export type Config = {
  console?: boolean
  debug?: boolean
  minimumLevel?: Severity
}

export interface ILogger {
  name: string

  minimumLogLevel: Severity

  debug(message: string, options?: Options): void

  info(message: string, options?: Options): void

  warn(message: string, options?: Options): void

  error(message: string, options?: Options): void

  exception(message: string, exception: Error, options?: Options): void
}
