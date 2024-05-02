export enum Severity {
  Debug = 1,
  Info,
  Warn,
  Error,
}

export type Options = {
  overrideConsole?: boolean
  extraData?: any
  exception?: Error
  signozPayload?: any
}

export type Config = {
  console?: boolean
  minimumLevel?: Severity
}

export enum PredefinedLogEvents {
  Login = "LOGIN",
  Share = "SHARE",
  AppOpen = "APP_OPEN",
  Search = "SEARCH",
}

export type PredefinedLogOptions =
  | { type: PredefinedLogEvents.Share; extraData: { contentType: string; itemId: string; method: string } }
  | { type: PredefinedLogEvents.Search; extraData: { searchTerm: string } }
  | { type: PredefinedLogEvents.AppOpen; extraData?: Options["extraData"] }
  | { type: PredefinedLogEvents.Login; extraData?: Options["extraData"] }

export interface ILogger {
  name: string

  minimumLogLevel: Severity

  debug(message: string, options?: Options): void

  info(message: string, options?: Options): void

  warn(message: string, options?: Options): void

  error(message: string, options?: Options): void

  exception(message: string, exception: Error, options?: Options): void

  predefinedEvent?(options: PredefinedLogOptions): void
}

export class Logger implements ILogger {
  name: string = "root"
  defaultConfig?: Config
  namespace?: string

  minimumLogLevel: Severity
  adapters: ILogger[] = []

  constructor(defaultConfig?: Config, minimumLogLevel = Severity.Debug) {
    this.defaultConfig = defaultConfig
    this.minimumLogLevel = minimumLogLevel
  }

  private checkConsole(options?: Options): boolean {
    if (options && options.overrideConsole !== undefined) return !!options?.overrideConsole

    return !!this.defaultConfig?.console
  }

  addLogger(logger: ILogger): void {
    this.adapters.push(logger)
  }

  setMinimumLogLevel(minimumLogLevel: Severity): void {
    this.minimumLogLevel = minimumLogLevel
  }

  debug(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Debug) return

    if (this.checkConsole(options)) console.log(message, { extraData: options?.extraData })

    this.adapters.forEach((adapter) => {
      try {
        adapter.debug(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  info(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Info) return

    if (this.checkConsole(options)) console.log(message, { extraData: options?.extraData })

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.info(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  predefinedEvent(options: PredefinedLogOptions) {
    const message = "PREDEFINED EVENT:"

    if (this.checkConsole(options)) console.log(message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter?.predefinedEvent?.(options)
      } catch {} // absorb adapter errors for now!
    })
  }

  warn(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Warn) return

    if (this.checkConsole(options)) console.warn(message, { extraData: options?.extraData })

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.warn(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  error(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Error) return

    if (this.checkConsole(options)) console.error(message, { extraData: options?.extraData })

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.error(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  exception(message: string, exception: Error, options?: Options) {
    if (this.checkConsole(options))
      console.error(`name: ${exception.name} message: ${exception.message} stack: ${exception.stack}`, {
        extraData: options?.extraData,
      })

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.exception(message, exception, options)
      } catch {} // absorb adapter errors for now!
    })
  }
}
