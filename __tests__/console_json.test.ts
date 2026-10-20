import { jest, describe, expect, it, afterEach } from "@jest/globals"

import { Logger, PredefinedLogEvents, Severity } from "../src/logger"

afterEach(() => {
  jest.restoreAllMocks()
})

const spyOn = (method: "log" | "info" | "warn" | "error" | "debug" | "trace") =>
  jest.spyOn(console, method).mockImplementation(() => {})

const lineFrom = (spy: ReturnType<typeof spyOn>, call = 0): string => {
  const args = spy.mock.calls[call]!
  expect(args).toHaveLength(1)
  const line = args[0] as string
  expect(line).not.toMatch(/[\r\n]/)
  return line
}

describe("consoleFormat: json", () => {
  it("writes one JSON line through the matching console method", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const warn = spyOn("warn")

    logger.warn("NVD lookup failed", { extraData: { match: "cpe:2.3:a", status: 429 } })

    expect(lineFrom(warn)).toBe('{"msg":"NVD lookup failed","level":"warn","match":"cpe:2.3:a","status":429}')
  })

  it("uses info, debug and error for those levels", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const info = spyOn("info")
    const debug = spyOn("debug")
    const error = spyOn("error")

    logger.info("a")
    logger.debug("b")
    logger.error("c")

    expect(JSON.parse(lineFrom(info))).toEqual({ msg: "a", level: "info" })
    expect(JSON.parse(lineFrom(debug))).toEqual({ msg: "b", level: "debug" })
    expect(JSON.parse(lineFrom(error))).toEqual({ msg: "c", level: "error" })
  })

  it("writes trace through console.debug so no stack trace is appended", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const trace = spyOn("trace")
    const debug = spyOn("debug")

    logger.trace("t")

    expect(trace).not.toHaveBeenCalled()
    expect(JSON.parse(lineFrom(debug))).toEqual({ msg: "t", level: "trace" })
  })

  it("masks sensitive extraData keys, including the logger's masking config", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json", masking: { add: ["internal"] } })
    const info = spyOn("info")

    logger.info("login", { extraData: { user: "ana", password: "hunter2", nested: { apiKey: "k" }, internalId: 7 } })

    expect(JSON.parse(lineFrom(info))).toEqual({
      msg: "login",
      level: "info",
      user: "ana",
      password: "[MASKED]",
      nested: { apiKey: "[MASKED]" },
      internalId: "[MASKED]",
    })
  })

  it("keeps msg and level when extraData has the same keys", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const info = spyOn("info")

    logger.info("real", { extraData: { msg: "forged", level: "error", other: 1 } })

    expect(JSON.parse(lineFrom(info))).toEqual({ msg: "real", level: "info", other: 1 })
  })

  it("puts non-object extraData under extraData", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const info = spyOn("info")

    logger.info("list", { extraData: [1, 2] })
    logger.info("text", { extraData: "value" })

    expect(JSON.parse(lineFrom(info, 0))).toEqual({ msg: "list", level: "info", extraData: [1, 2] })
    expect(JSON.parse(lineFrom(info, 1))).toEqual({ msg: "text", level: "info", extraData: "value" })
  })

  it("keeps the message sanitized so it can't forge another entry", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const info = spyOn("info")

    logger.info('ok\n{"msg":"forged","level":"error"}')

    expect(JSON.parse(lineFrom(info))).toEqual({ msg: 'ok {"msg":"forged","level":"error"}', level: "info" })
  })

  it("serializes BigInt and circular extraData without throwing", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const info = spyOn("info")
    const data: Record<string, unknown> = { count: BigInt(5) }
    data.self = data

    logger.info("odd", { extraData: data })

    expect(JSON.parse(lineFrom(info))).toEqual({ msg: "odd", level: "info", count: "5", self: "[Circular]" })
  })

  it("adds error and stack for exceptions instead of the multi-line summary", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const error = spyOn("error")
    const exception = new Error("boom")

    logger.exception("job failed", exception, { extraData: { jobId: "j1", error: "shadowed" } })

    expect(JSON.parse(lineFrom(error))).toEqual({
      msg: "job failed",
      level: "error",
      jobId: "j1",
      error: "boom",
      stack: exception.stack,
    })
  })

  it("omits stack when the exception has none", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const error = spyOn("error")
    const exception = new Error("no stack")
    exception.stack = undefined

    logger.exception("failed", exception)

    expect(JSON.parse(lineFrom(error))).toEqual({ msg: "failed", level: "error", error: "no stack" })
  })

  it("writes predefined events as one line", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json" })
    const info = spyOn("info")

    logger.predefinedEvent({ type: PredefinedLogEvents.Search, extraData: { searchTerm: "gold" } })

    expect(JSON.parse(lineFrom(info))).toEqual({
      msg: "PREDEFINED EVENT",
      level: "info",
      searchTerm: "gold",
      event: "SEARCH",
    })
  })

  it("still respects consoleMinimumLogLevel and forceConsole", () => {
    const logger = new Logger({ consoleEnabled: true, consoleFormat: "json", consoleMinimumLogLevel: Severity.Warn })
    const info = spyOn("info")

    logger.info("hidden")
    expect(info).not.toHaveBeenCalled()

    logger.info("forced", { forceConsole: true })
    expect(JSON.parse(lineFrom(info))).toEqual({ msg: "forced", level: "info" })
  })
})

describe("consoleFormat: pretty", () => {
  it("is the default and keeps the message and extraData arguments", () => {
    const logger = new Logger({ consoleEnabled: true })
    const warn = spyOn("warn")

    logger.warn("message", { extraData: { a: 1 } })

    expect(warn).toHaveBeenCalledWith("message", { extraData: { a: 1 } })
  })
})
