import { jest, describe, expect, it, afterEach } from "@jest/globals"

import { AkadeniaLogger, Logger } from "../src/logger"

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

    const spy = jest.spyOn(console, "log")

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

    logger.error(message, { overrideConsole: true })

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(message)
  })

  it("should show not show console error", () => {
    const logger = new Logger({ console: true })
    const message = "Test Error #4"

    const spy = jest.spyOn(console, "error")

    logger.error(message, { overrideConsole: false })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe("Logger namespace test", () => {
  it("should accept right format namespace", () => {
    const logger = new Logger()

    const expected = ["worker", "worker:a", "worker:a:b", "http:1", "123"]

    expected.forEach((value) => {
      logger.setDebugNamespace(value)
      expect(logger.namespace).toEqual(value)
    })
  })

  it("should fail wrong formatted namespace", () => {
    const logger = new Logger()

    const expected = ["invalid namespace", "invalid:", "#$@$#$@"]
    expected.forEach((value) => {
      expect(() => {
        logger.setDebugNamespace(value)
      }).toThrow()
    })
  })

  it("should succeed and not log below minimum log level", () => {
    const logger = new Logger({ console: true }, AkadeniaLogger.Severity.Error)
    const message = "Test Error #4"

    const spy = jest.spyOn(console, "warn")

    logger.warn(message)

    expect(spy).not.toHaveBeenCalled()
  })

  it("should succeed and log when equal minimum log level", () => {
    const logger = new Logger({ console: true }, AkadeniaLogger.Severity.Error)
    const message = "Test Error #5"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
  })

  it("should succeed and log when above minimum log level", () => {
    const logger = new Logger({ console: true }, AkadeniaLogger.Severity.Warn)
    const message = "Test Error #5"

    const spy = jest.spyOn(console, "error")

    logger.error(message)

    expect(spy).toHaveBeenCalled()
  })
})
