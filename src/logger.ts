import { createDetailedObjectSummary, mergeSensitiveKeyMasking, SensitiveKeyMasking } from "./serialization"

export type Attachment = {
  filename: string
  data: string | Uint8Array | ArrayBuffer
  contentType?: string
}

export enum Severity {
  Trace = 1,
  Debug,
  Info,
  Warn,
  Error,
}

export type ApiResponse = {
  status?: number
  statusText?: string
  message?: string
  data?: any
}

export type Options = {
  forceConsole?: boolean
  extraData?: any
  response?: ApiResponse
  exception?: Error
  signozPayload?: any
  attachments?: Attachment[]
  masking?: SensitiveKeyMasking
}

export type Config = {
  consoleEnabled?: boolean
  consoleMinimumLogLevel?: Severity
  masking?: SensitiveKeyMasking
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

  flush?(duration: number): void | Promise<boolean>
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

  private resolveOptions(options?: Options): Options | undefined {
    const masking = mergeSensitiveKeyMasking(this.defaultConfig?.masking, options?.masking)
    if (!masking) return options
    return { ...options, masking }
  }

  private checkConsole(severity: Severity, options?: Options): boolean {
    if (options?.forceConsole !== undefined) return !!options?.forceConsole

    if (this.minimumLogLevel > severity) return false

    return !!this.defaultConfig?.consoleEnabled
  }

  addLogger(logger: ILogger): void {
    this.adapters.push(logger)
  }

  sanitizeLogMessage(message: string): string {
    return message
      .replace(/[\r\n\t]/g, " ")
      .split("")
      .filter((char) => {
        const code = char.charCodeAt(0)
        return code >= 32 && code !== 127 && (code < 128 || code > 159)
      })
      .join("")
  }

  trace(message: string, options?: Options) {
    const sanitizedMessage = this.sanitizeLogMessage(message)
    const resolved = this.resolveOptions(options)
    if (this.checkConsole(Severity.Trace, resolved)) logToConsole("trace", sanitizedMessage, resolved)

    this.adapters.forEach((adapter) => {
      try {
        adapter.trace(sanitizedMessage, resolved)
      } catch {} // absorb adapter errors for now!
    })
  }

  debug(message: string, options?: Options) {
    const sanitizedMessage = this.sanitizeLogMessage(message)
    const resolved = this.resolveOptions(options)
    if (this.checkConsole(Severity.Debug, resolved)) logToConsole("debug", sanitizedMessage, resolved)

    this.adapters.forEach((adapter) => {
      try {
        adapter.debug(sanitizedMessage, resolved)
      } catch {} // absorb adapter errors for now!
    })
  }

  info(message: string, options?: Options) {
    const sanitizedMessage = this.sanitizeLogMessage(message)
    const resolved = this.resolveOptions(options)
    if (this.checkConsole(Severity.Info, resolved)) logToConsole("info", sanitizedMessage, resolved)

    this.adapters.forEach((adapter) => {
      try {
        adapter.info(sanitizedMessage, resolved)
      } catch {} // absorb adapter errors for now!
    })
  }

  predefinedEvent(options: PredefinedLogOptions) {
    const message = "PREDEFINED EVENT:"
    if (this.checkConsole(Severity.Debug, options)) logToConsole("log", message, options)

    this.adapters.forEach((adapter) => {
      try {
        adapter?.predefinedEvent?.(options)
      } catch {} // absorb adapter errors for now!
    })
  }

  warn(message: string, options?: Options) {
    const sanitizedMessage = this.sanitizeLogMessage(message)
    const resolved = this.resolveOptions(options)
    if (this.checkConsole(Severity.Warn, resolved)) logToConsole("warn", sanitizedMessage, resolved)

    this.adapters.forEach((adapter) => {
      try {
        adapter.warn(sanitizedMessage, resolved)
      } catch {} // absorb adapter errors for now!
    })
  }

  error(message: string, options?: Options) {
    const sanitizedMessage = this.sanitizeLogMessage(message)
    const resolved = this.resolveOptions(options)
    if (this.checkConsole(Severity.Error, resolved)) logToConsole("error", sanitizedMessage, resolved)

    this.adapters.forEach((adapter) => {
      try {
        adapter.error(sanitizedMessage, resolved)
      } catch {} // absorb adapter errors for now!
    })
  }

  exception(message: string, exception: Error, options?: Options) {
    const sanitizedMessage = this.sanitizeLogMessage(message)
    const resolved = this.resolveOptions(options)
    if (this.checkConsole(Severity.Error, resolved)) {
      const exceptionDetails = createDetailedObjectSummary(exception, "exception", resolved?.masking)
      const enhancedMessage = `${sanitizedMessage}\n${exceptionDetails}`
      logToConsole("error", enhancedMessage, resolved)
    }
    this.adapters.forEach((adapter) => {
      try {
        adapter.exception(sanitizedMessage, exception, resolved)
      } catch {} // absorb adapter errors for now!
    })
  }

  /**
   * Flush all adapters that support it.
   * @returns true if every adapter flushed within `duration` ms
   */
  async flush(duration: number): Promise<boolean> {
    const results = await Promise.all(
      this.adapters.map(async (adapter) => {
        try {
          return (await adapter.flush?.(duration)) !== false
        } catch {
          return false
        }
      }),
    )
    return results.every(Boolean)
  }
}
