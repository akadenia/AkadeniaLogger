import * as AkadeniaLogger from "./typings"

export class Logger implements AkadeniaLogger.ILogger {
  name: string = "root"
  defaultConfig?: AkadeniaLogger.Config
  namespace?: string

  minimumLogLevel: AkadeniaLogger.Severity
  adapters: AkadeniaLogger.ILogger[] = []

  constructor(defaultConfig?: AkadeniaLogger.Config, minimumLogLevel = AkadeniaLogger.Severity.Debug) {
    this.defaultConfig = defaultConfig
    this.minimumLogLevel = minimumLogLevel
  }

  private checkConsole(options?: AkadeniaLogger.Options): boolean {
    if (options && options.overrideConsole !== undefined) return !!options?.overrideConsole

    return !!this.defaultConfig?.console
  }

  private checkDebug(options?: AkadeniaLogger.Options): boolean {
    if (options && options.overrideDebug !== undefined) return !!options?.overrideDebug

    return !!this.defaultConfig?.debug
  }

  private prefixWithNamespace(message: string): string {
    return this.namespace?.length ? `${this.namespace} - ${message}` : message
  }

  private validateNamespace(namespace: string): boolean {
    const regexp = /^\w+(:\w+)*$/

    return regexp.test(namespace)
  }

  addAkadeniaLogger(logger: AkadeniaLogger.ILogger): void {
    this.adapters.push(logger)
  }

  setMinimumLogLevel(minimumLogLevel: AkadeniaLogger.Severity): void {
    this.minimumLogLevel = minimumLogLevel
  }

  setDebugNamespace(namespace: string): void {
    if (!this.validateNamespace(namespace)) {
      throw new SyntaxError("Invalid namespace. Use colon (:) separated alphanumeric words")
    }

    this.namespace = namespace
  }

  debug(message: string, options?: AkadeniaLogger.Options) {
    if (this.minimumLogLevel > AkadeniaLogger.Severity.Debug) return

    if (this.checkConsole(options)) console.log(this.prefixWithNamespace(message))

    if (this.checkDebug(options)) {
      const debug = require("debug")

      if (this.namespace) {
        debug.extend(this.namespace)
      }

      debug(message)
    }

    this.adapters.forEach((adapter) => {
      try {
        adapter.debug(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  info(message: string, options?: AkadeniaLogger.Options) {
    if (this.minimumLogLevel > AkadeniaLogger.Severity.Info) return

    if (this.checkConsole(options)) console.log(this.prefixWithNamespace(message))

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.info(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  warn(message: string, options?: AkadeniaLogger.Options) {
    if (this.minimumLogLevel > AkadeniaLogger.Severity.Warn) return

    if (this.checkConsole(options)) console.warn(this.prefixWithNamespace(message))

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.warn(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  error(message: string, options?: AkadeniaLogger.Options) {
    if (this.minimumLogLevel > AkadeniaLogger.Severity.Error) return

    if (this.checkConsole(options)) console.error(this.prefixWithNamespace(message))

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.error(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  exception(message: string, exception: Error, options?: AkadeniaLogger.Options) {
    if (this.checkConsole(options)) console.error(this.prefixWithNamespace(message))

    this.debug(message, { overrideConsole: false })

    this.adapters.forEach((adapter) => {
      try {
        adapter.exception(message, exception, options)
      } catch {} // absorb adapter errors for now!
    })
  }
}

export * as AkadeniaLogger from "./typings"
