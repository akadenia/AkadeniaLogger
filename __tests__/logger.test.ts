import { jest, describe, expect, it, afterEach } from "@jest/globals"

import { Logger, Severity } from "../src/logger"

afterEach(() => {
  jest.clearAllMocks()
})

describe("Logger tests where no console logs should get triggered", () => {
  it("should NOT show console error when console is set to false", () => {
    const logger = new Logger({ consoleEnabled: false })

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
    const logger = new Logger({ consoleEnabled: true })

    const spy = jest.spyOn(console, "error")

    logger.info("Test")

    expect(spy).not.toHaveBeenCalled()
  })
})

describe("Logger tests where it's supposed to show appropriate error", () => {
  it("should show console log with info", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Test Info"

    const spy = jest.spyOn(console, "info")

    logger.info(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should show console warn with warn", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Test Warn"
    const spy = jest.spyOn(console, "warn")

    logger.warn(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should show console error with error", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Test Error #1"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should show console error with error", () => {
    const logger = new Logger({ consoleEnabled: true })
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

  it("should not show console error", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Test Error #4"

    const spy = jest.spyOn(console, "error")

    logger.error(message, { forceConsole: false })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe("Logger namespace test", () => {
  it("should succeed and not log below minimum log level", () => {
    const logger = new Logger({ consoleEnabled: true, consoleMinimumLogLevel: Severity.Error })
    const message = "Test Error #4"

    const spy = jest.spyOn(console, "warn")

    logger.warn(message)

    expect(spy).not.toHaveBeenCalled()
  })

  it("should log when equal minimum log level", () => {
    const logger = new Logger({ consoleEnabled: true, consoleMinimumLogLevel: Severity.Error })
    const message = "Test Error #5"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
  })

  it("should log when above minimum log level", () => {
    const logger = new Logger({ consoleEnabled: true, consoleMinimumLogLevel: Severity.Warn })
    const message = "Test Error #5"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
  })

  it("should log when above minimum log level when not passed by config", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Test Error #6"

    const spy = jest.spyOn(console, "trace")

    logger.trace(message)

    expect(spy).toHaveBeenCalled()
  })
})

describe("Logger tests with response implementation", () => {
  it("should pass response as separate parameter", () => {
    const logger = new Logger({ consoleEnabled: true })
    const consoleErrorSpy = jest.spyOn(console, "error")

    const message = "Test with response"
    const response = {
      success: false,
      message: "Not Found",
      status: 404,
      statusText: "Not Found",
      data: { error: "Details" },
    } as any

    logger.error(message, { response })

    expect(consoleErrorSpy).toHaveBeenCalled()
    // Console doesn't log response, so it should just log the message
    expect(consoleErrorSpy).toHaveBeenCalledWith(message)
  })

  it("should pass response with extraData", () => {
    const logger = new Logger({ consoleEnabled: true })
    const consoleErrorSpy = jest.spyOn(console, "error")

    const message = "Test with response and other fields"
    const response = {
      success: false,
      message: "Server error",
      status: 500,
      statusText: "Internal Server Error",
      data: { errorCode: "ERR_500" },
    } as any
    const extraData = {
      userId: "12345",
      timestamp: Date.now(),
      action: "fetch_data",
    }

    logger.error(message, { extraData, response })

    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(message, { extraData })
  })

  it("should handle large response data exceeding 16kb", () => {
    const logger = new Logger({ consoleEnabled: true })
    const consoleErrorSpy = jest.spyOn(console, "error")

    const message = "Test with large response"
    const largeData = "x".repeat(20 * 1024) // 20kb of data
    const response = {
      success: false,
      message: "Internal Server Error",
      status: 500,
      statusText: "Internal Server Error",
      data: largeData,
    } as any
    const extraData = {
      userId: "12345",
    }

    logger.error(message, { extraData, response })

    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(message, { extraData })

    // Verify the data size is indeed large (>16kb)
    const dataSize = new TextEncoder().encode(response.data).length
    expect(dataSize).toBeGreaterThan(16 * 1024)
  })
})
