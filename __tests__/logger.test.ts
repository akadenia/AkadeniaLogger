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

describe("Logger message sanitization", () => {
  it("should replace newlines, carriage returns, and tabs with spaces", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Line1\nLine2\rLine3\tTabbed"
    const spy = jest.spyOn(console, "info")

    logger.info(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith("Line1 Line2 Line3 Tabbed")
  })

  it("should strip control characters (0-31) except space", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Hello" + String.fromCharCode(0) + "World" + String.fromCharCode(31) + "Test"
    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith("HelloWorldTest")
  })

  it("should strip DEL character (127)", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Hello" + String.fromCharCode(127) + "World"
    const spy = jest.spyOn(console, "warn")

    logger.warn(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith("HelloWorld")
  })

  it("should strip C1 control characters (128-159)", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Hello" + String.fromCharCode(128) + "World" + String.fromCharCode(159) + "Test"
    const spy = jest.spyOn(console, "info")

    logger.info(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith("HelloWorldTest")
  })

  it("should preserve printable ASCII characters (32-126)", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Hello World! 123 @#$%^&*()"
    const spy = jest.spyOn(console, "debug")

    logger.debug(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should preserve valid UTF-8 characters above 159", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Hello 世界 🌍"
    const spy = jest.spyOn(console, "trace")

    logger.trace(message)

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should not modify extraData when sanitizing messages", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Test\nMessage"
    const extraData = { key: "value", nested: { data: "test" } }
    const spy = jest.spyOn(console, "error")

    logger.error(message, { extraData })

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith("Test Message", { extraData })
  })

  it("should sanitize exception messages", () => {
    const logger = new Logger({ consoleEnabled: true })
    const message = "Error\nMessage\tWith\tTabs"
    const error = new Error("Original error")
    const spy = jest.spyOn(console, "error")

    logger.exception(message, error)

    expect(spy).toHaveBeenCalled()
    const callArgs = spy.mock.calls[0]
    expect(callArgs[0]).toContain("Error Message With Tabs")
  })

  it("should leave normal messages unchanged", () => {
    const logger = new Logger({ consoleEnabled: true })
    const normalMessages = [
      "Simple message",
      "Message with numbers 12345",
      "Message with symbols !@#$%^&*()",
      "Message with unicode: café résumé",
    ]

    for (const message of normalMessages) {
      const spy = jest.spyOn(console, "info")
      logger.info(message)
      expect(spy).toHaveBeenCalledWith(message)
      spy.mockRestore()
    }
  })
})

describe("Logger adapter message sanitization", () => {
  it("should send sanitized messages to adapters for error", () => {
    const logger = new Logger()
    const mockAdapter: any = {
      error: jest.fn(),
      name: "mock",
      minimumLogLevel: Severity.Trace,
    }

    logger.addLogger(mockAdapter)
    const message = "Error\nMessage\tWith\tControl" + String.fromCharCode(0)

    logger.error(message)

    expect(mockAdapter.error).toHaveBeenCalledWith("Error Message With Control", undefined)
  })

  it("should send sanitized messages to adapters for info", () => {
    const logger = new Logger()
    const mockAdapter: any = {
      info: jest.fn(),
      name: "mock",
      minimumLogLevel: Severity.Trace,
    }

    logger.addLogger(mockAdapter)
    const message = "Info\nMessage\rWith\nNewlines"
    const options = { extraData: { test: "data" } }

    logger.info(message, options)

    expect(mockAdapter.info).toHaveBeenCalledWith("Info Message With Newlines", options)
  })

  it("should send sanitized messages to adapters for warn", () => {
    const logger = new Logger()
    const mockAdapter: any = {
      warn: jest.fn(),
      name: "mock",
      minimumLogLevel: Severity.Trace,
    }

    logger.addLogger(mockAdapter)
    const message = "Warn\tMessage"

    logger.warn(message)

    expect(mockAdapter.warn).toHaveBeenCalledWith("Warn Message", undefined)
  })

  it("should send sanitized messages to adapters for debug", () => {
    const logger = new Logger()
    const mockAdapter: any = {
      debug: jest.fn(),
      name: "mock",
      minimumLogLevel: Severity.Trace,
    }

    logger.addLogger(mockAdapter)
    const message = "Debug\nMessage"

    logger.debug(message)

    expect(mockAdapter.debug).toHaveBeenCalledWith("Debug Message", undefined)
  })

  it("should send sanitized messages to adapters for trace", () => {
    const logger = new Logger()
    const mockAdapter: any = {
      trace: jest.fn(),
      name: "mock",
      minimumLogLevel: Severity.Trace,
    }

    logger.addLogger(mockAdapter)
    const message = "Trace\nMessage"

    logger.trace(message)

    expect(mockAdapter.trace).toHaveBeenCalledWith("Trace Message", undefined)
  })

  it("should send sanitized message to adapters for exception but preserve original Error", () => {
    const logger = new Logger()
    const mockAdapter: any = {
      exception: jest.fn(),
      name: "mock",
      minimumLogLevel: Severity.Trace,
    }

    logger.addLogger(mockAdapter)
    const message = "Exception\nMessage"
    const error = new Error("Original error message")
    const options = { extraData: { test: "data" } }

    logger.exception(message, error, options)

    expect(mockAdapter.exception).toHaveBeenCalledWith("Exception Message", error, options)
    expect(mockAdapter.exception.mock.calls[0][1]).toBe(error)
  })

  it("should send sanitized messages to multiple adapters", () => {
    const logger = new Logger()
    const mockAdapter1: any = {
      error: jest.fn(),
      name: "mock1",
      minimumLogLevel: Severity.Trace,
    }
    const mockAdapter2: any = {
      error: jest.fn(),
      name: "mock2",
      minimumLogLevel: Severity.Trace,
    }

    logger.addLogger(mockAdapter1)
    logger.addLogger(mockAdapter2)
    const message = "Error\nMessage"

    logger.error(message)

    expect(mockAdapter1.error).toHaveBeenCalledWith("Error Message", undefined)
    expect(mockAdapter2.error).toHaveBeenCalledWith("Error Message", undefined)
  })
})
