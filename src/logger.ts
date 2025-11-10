import { AkadeniaApiResponse } from "@akadenia/api"
import { createDetailedObjectSummary } from "./serialization"

export enum Severity {
  Trace = 1,
  Debug,
  Info,
  Warn,
  Error,
}

export type Options = {
  forceConsole?: boolean
  extraData?: any
  response?: AkadeniaApiResponse
  exception?: Error
  signozPayload?: any
}

export type Config = {
  consoleEnabled?: boolean
  consoleMinimumLogLevel?: Severity
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
  // Pass extraData as a separate object argument (not serialized)
  // Response is not logged to console, only passed to adapters
  if (options?.extraData) {
    console[logLevel](message, { extraData: options.extraData })
  } else {
    console[logLevel](message)
  }
}

export class Logger implements ILogger {
  name: string = "root"
  defaultConfig?: Config
  namespace?: string
  adapters: ILogger[] = []
  minimumLogLevel: Severity

  constructor(defaultConfig?: Config) {
    this.defaultConfig = defaultConfig
    this.minimumLogLevel = defaultConfig?.consoleMinimumLogLevel || Severity.Trace
  }

  private checkConsole(severity: Severity, options?: Options): boolean {
    if (options?.forceConsole !== undefined) return !!options?.forceConsole

    if (this.minimumLogLevel > severity) return false

    return !!this.defaultConfig?.consoleEnabled
  }

  addLogger(logger: ILogger): void {
    this.adapters.push(logger)
  }

  trace(message: string, options?: Options) {
    if (this.checkConsole(Severity.Trace, options)) logToConsole("trace", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter.trace(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  debug(message: string, options?: Options) {
    if (this.checkConsole(Severity.Debug, options)) logToConsole("debug", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter.debug(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  info(message: string, options?: Options) {
    if (this.checkConsole(Severity.Info, options)) logToConsole("info", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter.info(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  predefinedEvent(options: PredefinedLogOptions) {
    const message = "PREDEFINED EVENT:"

    this.adapters.forEach((adapter) => {
      if (this.checkConsole(Severity.Debug, options)) logToConsole("log", message, options)

      try {
        adapter?.predefinedEvent?.(options)
      } catch {} // absorb adapter errors for now!
    })
  }

  warn(message: string, options?: Options) {
    if (this.checkConsole(Severity.Warn, options)) logToConsole("warn", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter.warn(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  error(message: string, options?: Options) {
    if (this.checkConsole(Severity.Error, options)) logToConsole("error", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter.error(message, options)
      } catch {} // absorb adapter errors for now!
    })
  }

  exception(message: string, exception: Error, options?: Options) {
    if (this.checkConsole(Severity.Error, options)) {
      // Serialize exception details for better visibility
      const exceptionDetails = createDetailedObjectSummary(exception, "exception")
      const enhancedMessage = `${message}\n${exceptionDetails}`
      logToConsole("error", enhancedMessage, options)
    }
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
