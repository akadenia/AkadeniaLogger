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
}

export type Config = {
  console?: boolean
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

    if (this.checkConsole(options)) console.log(message)

    this.adapters.forEach((adapter) => {
      try {
        adapter.debug(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  info(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Info) return

    if (this.checkConsole(options)) console.log(message)

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.info(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  warn(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Warn) return

    if (this.checkConsole(options)) console.warn(message)

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.warn(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  error(message: string, options?: Options) {
    if (this.minimumLogLevel > Severity.Error) return

    if (this.checkConsole(options)) console.error(message)

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.error(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  exception(message: string, exception: Error, options?: Options) {
    if (this.checkConsole(options)) console.error(`${message} : ${exception?.toString()} `)

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.exception(message, exception, options)
      } catch {} // absorb adapter errors for now!
    })
  }
}
