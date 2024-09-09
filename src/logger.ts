export enum Severity {
  Debug = 1,
  Info,
  Warn,
  Error,
}

export type Options = {
  forceConsole?: boolean
  extraData?: any
  exception?: Error
  signozPayload?: any
  azureContext?: any
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

  trace(message: string, options?: Options): void

  debug(message: string, options?: Options): void

  info(message: string, options?: Options): void

  warn(message: string, options?: Options): void

  error(message: string, options?: Options): void

  exception(message: string, exception: Error, options?: Options): void

  predefinedEvent?(options: PredefinedLogOptions): void

  flush?(duration: number): void
}

function logToConsole(logLevel: "warn" | "info" | "log" | "error" | "trace" | "debug", message: string, options?: Options) {
  const consoleLogger = options?.azureContext || console

  if (options?.extraData) {
    consoleLogger[logLevel](message, { extraData: options.extraData })
  } else {
    consoleLogger[logLevel](message)
  }
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
    if (options && options.forceConsole !== undefined) return !!options?.forceConsole

    return !!this.defaultConfig?.console
  }

  addLogger(logger: ILogger): void {
    this.adapters.push(logger)
  }

  setMinimumLogLevel(minimumLogLevel: Severity): void {
    this.minimumLogLevel = minimumLogLevel
  }

  trace(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Debug) return

    if (this.checkConsole(options)) logToConsole("trace", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter.trace(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  debug(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Debug) return

    if (this.checkConsole(options)) logToConsole("log", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter.debug(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  info(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Info) return

    if (this.checkConsole(options)) logToConsole("info", message, options)

    this.debug(message, { forceConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.info(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  predefinedEvent(options: PredefinedLogOptions) {
    const message = "PREDEFINED EVENT:"

    if (this.checkConsole(options)) logToConsole("log", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter?.predefinedEvent?.(options)
      } catch {} // absorb adapter errors for now!
    })
  }

  warn(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Warn) return

    if (this.checkConsole(options)) logToConsole("warn", message, options)

    this.debug(message, { forceConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.warn(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  error(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Error) return

    if (this.checkConsole(options)) logToConsole("error", message, options)

    this.debug(message, { forceConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.error(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  exception(message: string, exception: Error, options?: Options) {
    if (this.checkConsole(options))
      logToConsole("error", message, { ...options, extraData: { ...options?.extraData, exception: exception } })

    this.debug(message, { forceConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.exception(message, exception, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  flush(duration: number) {
    this.adapters.forEach((adapter) => {
      try {
        adapter.flush?.(duration)
      } catch {} // absorb adapter errors for now!
    })
  }
}
