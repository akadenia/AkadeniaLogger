import { jest, describe, expect, it, beforeEach, afterEach } from "@jest/globals"
import { SignozAdapter, SignozSeverity } from "../src/adapters/signoz_adapter"
import { Severity } from "../src/logger"

const originalFetch = global.fetch

function mockFetchOk() {
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))
}

function mockFetchError(statusText: string, body: string) {
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 500, statusText }))
}

function lastFetchBody(): any {
  const calls = (global.fetch as jest.Mock).mock.calls
  return JSON.parse((calls[calls.length - 1] as any)[1].body)
}

describe("SignozAdapter Tests", () => {
  let signozAdapter: SignozAdapter

  beforeEach(() => {
    mockFetchOk()
  })

  afterEach(() => {
    jest.clearAllMocks()
    global.fetch = originalFetch
  })

  describe("Constructor", () => {
    it("should accept a full URL string including path", () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)

      expect(signozAdapter.name).toBe("signoz")
      expect(signozAdapter.minimumLogLevel).toBe(Severity.Debug)
      expect(signozAdapter.url.toString()).toBe("http://collector:4318/v1/logs")
    })

    it("should accept a URL object", () => {
      const url = new URL("https://signoz.example.com:4318/v1/logs")
      signozAdapter = new SignozAdapter(url, Severity.Info)

      expect(signozAdapter.url.toString()).toBe("https://signoz.example.com:4318/v1/logs")
    })

    it("should accept a custom route endpoint", () => {
      signozAdapter = new SignozAdapter("http://localhost:8082/custom/endpoint", Severity.Warn)

      expect(signozAdapter.url.toString()).toBe("http://localhost:8082/custom/endpoint")
    })

    it("should default to Severity.Debug if minimumLogLevel is not provided", () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs")

      expect(signozAdapter.minimumLogLevel).toBe(Severity.Debug)
    })
  })

  describe("Minimum Log Level Filtering", () => {
    it("should not log trace when minimumLogLevel is Debug", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)

      await signozAdapter.trace("Trace message")

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("should log info when minimumLogLevel is Info", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Info)

      await signozAdapter.info("Info message")

      expect(global.fetch).toHaveBeenCalled()
    })

    it("should not log debug when minimumLogLevel is Info", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Info)

      await signozAdapter.debug("Debug message")

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("should log error when minimumLogLevel is Warn", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Warn)

      await signozAdapter.error("Error message")

      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe("Logging Methods", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Trace)
    })

    it("should post trace logs to the provided URL", async () => {
      await signozAdapter.trace("Trace message")

      expect(global.fetch).toHaveBeenCalledWith("http://collector:4318/v1/logs", expect.objectContaining({ method: "POST" }))
      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    severityText: SignozSeverity.Trace,
                    body: { stringValue: "Trace message" },
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should post debug logs to the provided URL", async () => {
      await signozAdapter.debug("Debug message")

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    severityText: SignozSeverity.Debug,
                    body: { stringValue: "Debug message" },
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should post info logs to the provided URL", async () => {
      await signozAdapter.info("Info message")

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    severityText: SignozSeverity.Info,
                    body: { stringValue: "Info message" },
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should post warn logs to the provided URL", async () => {
      await signozAdapter.warn("Warn message")

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    severityText: SignozSeverity.Warn,
                    body: { stringValue: "Warn message" },
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should post error logs to the provided URL", async () => {
      await signozAdapter.error("Error message")

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    severityText: SignozSeverity.Error,
                    body: { stringValue: "Error message" },
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should post exception logs as fatal", async () => {
      const error = new Error("Test error")
      error.stack = "Error: Test error\n    at test.js:1:1"
      await signozAdapter.exception("Exception message", error)

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    severityText: SignozSeverity.Fatal,
                    body: { stringValue: "Exception message" },
                    attributes: expect.arrayContaining([
                      expect.objectContaining({
                        key: "exception_message",
                        value: { stringValue: "Test error" },
                      }),
                      expect.objectContaining({
                        key: "exception_stack",
                        value: { stringValue: "Error: Test error\n    at test.js:1:1" },
                      }),
                      expect.objectContaining({
                        key: "exception_name",
                        value: { stringValue: "Error" },
                      }),
                    ]),
                  }),
                ],
              },
            ],
          },
        ],
      })
    })
  })

  describe("Signoz Payload Options", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)
    })

    it("should include signozPayload fields when provided", async () => {
      const options = {
        signozPayload: {
          trace_id: "trace-123",
          span_id: "span-456",
          trace_flags: 1,
          severity_number: 9,
          attributes: { key: "value" },
          resources: { service: "test" },
        },
      }

      await signozAdapter.info("Test message", options)

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            resource: {
              attributes: [{ key: "service", value: { stringValue: "test" } }],
            },
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    traceId: "trace-123",
                    spanId: "span-456",
                    traceFlags: 1,
                    severityNumber: 9,
                    severityText: SignozSeverity.Info,
                    body: { stringValue: "Test message" },
                    attributes: expect.arrayContaining([
                      expect.objectContaining({
                        key: "key",
                        value: { stringValue: "value" },
                      }),
                    ]),
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should omit resource field when no resources are provided", async () => {
      await signozAdapter.info("Test message", {
        signozPayload: {
          trace_id: "trace-123",
          attributes: { key: "value" },
        },
      })

      const payload = lastFetchBody()
      expect(payload.resourceLogs[0]).not.toHaveProperty("resource")
      expect(payload.resourceLogs[0]).toHaveProperty("scopeLogs")
    })
  })

  describe("Attribute Value Conversion", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)
    })

    it("should convert null values to empty string", async () => {
      await signozAdapter.info("Test message", {
        extraData: { nullValue: null },
      })

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    attributes: expect.arrayContaining([
                      expect.objectContaining({
                        key: "nullValue",
                        value: { stringValue: "" },
                      }),
                    ]),
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should convert undefined values to empty string", async () => {
      await signozAdapter.info("Test message", {
        extraData: { undefinedValue: undefined },
      })

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    attributes: expect.arrayContaining([
                      expect.objectContaining({
                        key: "undefinedValue",
                        value: { stringValue: "" },
                      }),
                    ]),
                  }),
                ],
              },
            ],
          },
        ],
      })
    })
  })

  describe("Exception Handling", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)
    })

    it("should include exception details when exception is an Error", async () => {
      const error = new Error("Test error message")
      error.stack = "Error: Test error message\n    at test.js:1:1"
      error.name = "CustomError"

      await signozAdapter.info("Test message", { exception: error })

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    attributes: expect.arrayContaining([
                      expect.objectContaining({
                        key: "exception_message",
                        value: { stringValue: "Test error message" },
                      }),
                      expect.objectContaining({
                        key: "exception_stack",
                        value: { stringValue: "Error: Test error message\n    at test.js:1:1" },
                      }),
                      expect.objectContaining({
                        key: "exception_name",
                        value: { stringValue: "CustomError" },
                      }),
                    ]),
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should include exception as string when exception is a string", async () => {
      await signozAdapter.info("Test message", { exception: "String error" as any })

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    attributes: expect.arrayContaining([
                      expect.objectContaining({
                        key: "exception",
                        value: { stringValue: "String error" },
                      }),
                    ]),
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should flatten exception object when exception is an object", async () => {
      await signozAdapter.info("Test message", { exception: { code: 500, type: "server" } as any })

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    attributes: expect.arrayContaining([
                      expect.objectContaining({
                        key: "code",
                        value: { intValue: "500" },
                      }),
                      expect.objectContaining({
                        key: "type",
                        value: { stringValue: "server" },
                      }),
                    ]),
                  }),
                ],
              },
            ],
          },
        ],
      })
    })

    it("should handle Error without stack trace", async () => {
      const error = new Error("Error without stack")
      delete (error as any).stack

      await signozAdapter.info("Test message", { exception: error })

      expect(lastFetchBody()).toEqual({
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    attributes: expect.arrayContaining([
                      expect.objectContaining({
                        key: "exception_message",
                        value: { stringValue: "Error without stack" },
                      }),
                    ]),
                  }),
                ],
              },
            ],
          },
        ],
      })

      const payload = lastFetchBody()
      const attributes = payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes
      expect(attributes.find((attr: any) => attr.key === "exception_stack")).toBeUndefined()
    })
  })

  describe("API Error Handling", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)
      jest.spyOn(console, "debug").mockImplementation(() => {})
    })

    afterEach(() => {
      ;(console.debug as jest.Mock).mockRestore()
    })

    it("should log error when API call fails", async () => {
      mockFetchError("API Error", "Error details")

      const result = await (signozAdapter as any).captureMessage("Test", SignozSeverity.Info)

      expect(result).toBe(false)
      expect(console.debug).toHaveBeenCalledWith("API Error: Error details")
    })

    it("should return true when API call succeeds", async () => {
      mockFetchOk()

      const result = await (signozAdapter as any).captureMessage("Test", SignozSeverity.Info)

      expect(result).toBe(true)
    })

    it("should return false when fetch throws", async () => {
      global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error("Network failure"))

      const result = await (signozAdapter as any).captureMessage("Test", SignozSeverity.Info)

      expect(result).toBe(false)
      expect(console.debug).toHaveBeenCalledWith("SignozAdapter fetch error:", expect.any(Error))
    })

    it("should return false and log timeout when fetch is aborted", async () => {
      jest.useFakeTimers()
      global.fetch = jest.fn<typeof fetch>().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted")
            err.name = "AbortError"
            reject(err)
          })
        })
      })

      const capturePromise = (signozAdapter as any).captureMessage("Test", SignozSeverity.Info)
      jest.advanceTimersByTime(6000)
      const result = await capturePromise

      expect(result).toBe(false)
      expect(console.debug).toHaveBeenCalledWith("SignozAdapter fetch timeout")
      jest.useRealTimers()
    })
  })

  describe("Unserializable data", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)
    })

    it("should not reject when extraData contains a circular reference", async () => {
      const circular: any = { name: "loop" }
      circular.self = circular

      await expect(signozAdapter.info("Test message", { extraData: { circular } })).resolves.toBeUndefined()

      const attributes = lastFetchBody().resourceLogs[0].scopeLogs[0].logRecords[0].attributes
      expect(attributes).toContainEqual({ key: "circular", value: { stringValue: '{"name":"loop","self":"[Circular]"}' } })
    })

    it("should keep shared references that are not circular", async () => {
      const shared = { id: 1 }

      await signozAdapter.info("Test message", { extraData: { pair: { a: shared, b: shared } } })

      const attributes = lastFetchBody().resourceLogs[0].scopeLogs[0].logRecords[0].attributes
      expect(attributes).toContainEqual({ key: "pair", value: { stringValue: '{"a":{"id":1},"b":{"id":1}}' } })
    })

    it("should send BigInt values as intValue", async () => {
      await signozAdapter.info("Test message", { extraData: { big: BigInt("9007199254740993"), nested: { n: BigInt(5) } } })

      const attributes = lastFetchBody().resourceLogs[0].scopeLogs[0].logRecords[0].attributes
      expect(attributes).toContainEqual({ key: "big", value: { intValue: "9007199254740993" } })
      expect(attributes).toContainEqual({ key: "nested", value: { stringValue: '{"n":"5"}' } })
    })
  })

  describe("Severity numbers", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Trace)
    })

    it.each([
      ["trace", 1],
      ["debug", 5],
      ["info", 9],
      ["warn", 13],
      ["error", 17],
    ] as const)("should default severityNumber for %s to %i", async (level, expected) => {
      await signozAdapter[level]("Test message")

      expect(lastFetchBody().resourceLogs[0].scopeLogs[0].logRecords[0].severityNumber).toBe(expected)
    })

    it("should default severityNumber for exceptions to 21", async () => {
      await signozAdapter.exception("Test message", new Error("boom"))

      expect(lastFetchBody().resourceLogs[0].scopeLogs[0].logRecords[0].severityNumber).toBe(21)
    })
  })

  describe("Config", () => {
    it("should send custom headers alongside Content-Type", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug, {
        headers: { "signoz-ingestion-key": "ingest-key" },
      })

      await signozAdapter.info("Test message")

      const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
      expect(init.headers).toEqual({ "Content-Type": "application/json", "signoz-ingestion-key": "ingest-key" })
    })

    it("should default the timeout to 5000ms", () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs")

      expect(signozAdapter.timeoutMs).toBe(5000)
    })

    it("should abort after the configured timeout", async () => {
      jest.useFakeTimers()
      jest.spyOn(console, "debug").mockImplementation(() => {})
      global.fetch = jest.fn<typeof fetch>().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted")
            err.name = "AbortError"
            reject(err)
          })
        })
      })
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug, { timeoutMs: 100 })

      const capturePromise = (signozAdapter as any).captureMessage("Test", SignozSeverity.Info)
      jest.advanceTimersByTime(150)

      expect(await capturePromise).toBe(false)
      expect(console.debug).toHaveBeenCalledWith("SignozAdapter fetch timeout")
      ;(console.debug as jest.Mock).mockRestore()
      jest.useRealTimers()
    })
  })

  describe("flush", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)
    })

    it("should resolve true when nothing is pending", async () => {
      await expect(signozAdapter.flush(100)).resolves.toBe(true)
    })

    it("should wait for in-flight requests", async () => {
      let resolveFetch: (response: Response) => void = () => {}
      global.fetch = jest.fn<typeof fetch>().mockReturnValue(new Promise<Response>((resolve) => (resolveFetch = resolve)))

      signozAdapter.info("Test message")
      const flushed = signozAdapter.flush(1000)
      resolveFetch(new Response(null, { status: 200 }))

      await expect(flushed).resolves.toBe(true)
    })

    it("should resolve false when requests do not finish in time", async () => {
      global.fetch = jest.fn<typeof fetch>().mockReturnValue(new Promise<Response>(() => {}))

      signozAdapter.info("Test message")

      await expect(signozAdapter.flush(10)).resolves.toBe(false)
    })
  })

  describe("Review fixes", () => {
    it("should not send functions or symbols as attributes", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)

      await signozAdapter.info("Test message", { extraData: { callback: () => "secret", tag: Symbol("t"), kept: "yes" } })

      const attributes = lastFetchBody().resourceLogs[0].scopeLogs[0].logRecords[0].attributes
      expect(attributes).toEqual([{ key: "kept", value: { stringValue: "yes" } }])
    })

    it("should not duplicate Content-Type when a custom one is given in another case", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug, {
        headers: { "content-type": "application/json; charset=utf-8" },
      })

      await signozAdapter.info("Test message")

      const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
      expect(init.headers).toEqual({ "content-type": "application/json; charset=utf-8" })
    })

    it("should time out a stalled error response body", async () => {
      jest.useFakeTimers()
      jest.spyOn(console, "debug").mockImplementation(() => {})
      global.fetch = jest.fn<typeof fetch>().mockImplementation(async (_url, init) => {
        return {
          ok: false,
          statusText: "Server Error",
          text: () =>
            new Promise<string>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))
            }),
        } as Response
      })
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug, { timeoutMs: 100 })

      const capturePromise = (signozAdapter as any).captureMessage("Test", SignozSeverity.Info)
      await jest.advanceTimersByTimeAsync(150)

      expect(await capturePromise).toBe(false)
      expect(console.debug).toHaveBeenCalledWith("Server Error: ")
      ;(console.debug as jest.Mock).mockRestore()
      jest.useRealTimers()
    })
  })
})
