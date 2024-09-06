import { jest, describe, expect, it, afterEach } from "@jest/globals"

import { Logger, Severity } from "../src/logger"

afterEach(() => {
  jest.clearAllMocks()
})

describe("Logger tests where no console logs should get triggered", () => {
  it("should NOT show console error when console is set to false", () => {
    const logger = new Logger({ console: false })

    const spy = jest.spyOn(console, "error")

    logger.error("Test")

    expect(spy).not.toHaveBeenCalled()
  })

  it("should NOT show console error when console is undefined", () => {
    const logger = new Logger()

    const spy = jest.spyOn(console, "error")

    logger.error("Test")

    expect(spy).not.toHaveBeenCalled()
  })

  it("should NOT show console error with info", () => {
    const logger = new Logger({ console: true })

    const spy = jest.spyOn(console, "error")

    logger.info("Test")

    expect(spy).not.toHaveBeenCalled()
  })
})

describe("Logger tests where it's supposed to show appropriate error", () => {
  it("should show console log with info", () => {
    const logger = new Logger({ console: true })
    const message = "Test Info"

    const spy = jest.spyOn(console, "info")

    logger.info(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should show console warn with warn", () => {
    const logger = new Logger({ console: true })
    const message = "Test Warn"
    const spy = jest.spyOn(console, "warn")

    logger.warn(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should show console error with error", () => {
    const logger = new Logger({ console: true })
    const message = "Test Error #1"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should show console error with error", () => {
    const logger = new Logger({ console: true })
    const message = "Test Error #2"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })
})

describe("Logger tests with specific log message to override default logger config", () => {
  it("should show console error with error", () => {
    const logger = new Logger()
    const message = "Test Error #3"

    const spy = jest.spyOn(console, "error")

    logger.error(message, { forceConsole: true })

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should show log extraData in console", () => {
    const logger = new Logger()
    const message = "Test Error #3"

    const consoleErrorSpy = jest.spyOn(console, "error")
    const consoleInfoSpy = jest.spyOn(console, "info")
    const consoleWarnSpy = jest.spyOn(console, "warn")

    logger.error(message, { forceConsole: true, extraData: { errorProperty: "some error" } })
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(message, { extraData: { errorProperty: "some error" } })

    logger.info(message, { forceConsole: true, extraData: { infoProperty: "some info" } })
    expect(consoleInfoSpy).toHaveBeenCalled()
    expect(consoleInfoSpy).toHaveBeenCalledWith(message, { extraData: { infoProperty: "some info" } })

    logger.warn(message, { forceConsole: true, extraData: { warnProperty: "some warn" } })
    expect(consoleWarnSpy).toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalledWith(message, { extraData: { warnProperty: "some warn" } })
  })

  it("should show not show console error", () => {
    const logger = new Logger({ console: true })
    const message = "Test Error #4"

    const spy = jest.spyOn(console, "error")

    logger.error(message, { forceConsole: false })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe("Logger namespace test", () => {
  it("should succeed and not log below minimum log level", () => {
    const logger = new Logger({ console: true }, Severity.Error)
    const message = "Test Error #4"

    const spy = jest.spyOn(console, "warn")

    logger.warn(message)

    expect(spy).not.toHaveBeenCalled()
  })

  it("should succeed and log when equal minimum log level", () => {
    const logger = new Logger({ console: true }, Severity.Error)
    const message = "Test Error #5"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
  })

  it("should succeed and log when above minimum log level", () => {
    const logger = new Logger({ console: true }, Severity.Warn)
    const message = "Test Error #5"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
  })
})
