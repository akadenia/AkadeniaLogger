import { jest, describe, expect, it, beforeEach, afterEach } from "@jest/globals"
import { SignozAdapter, SignozSeverity } from "../src/adapters/signoz_adapter"
import { Severity } from "../src/logger"
import { AxiosApiClient, AkadeniaApiResponse } from "@akadenia/api"

jest.mock("@akadenia/api", () => ({
  AxiosApiClient: jest.fn(),
}))

describe("SignozAdapter Tests", () => {
  let mockApiClient: any
  let signozAdapter: SignozAdapter

  beforeEach(() => {
    mockApiClient = {
      post: (jest.fn() as any).mockResolvedValue({
        success: true,
        message: "Success",
        data: {},
      }),
    }
    ;(AxiosApiClient as jest.MockedClass<typeof AxiosApiClient>).mockImplementation(() => {
      return mockApiClient as any
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("Constructor", () => {
    it("should accept a full URL string including path", () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)

      expect(signozAdapter.name).toBe("signoz")
      expect(signozAdapter.minimumLogLevel).toBe(Severity.Debug)
      expect(signozAdapter.url.toString()).toBe("http://collector:4318/v1/logs")
      expect(AxiosApiClient).toHaveBeenCalledWith({
        baseUrl: "http://collector:4318/v1/logs",
        headers: {
          "Content-Type": "application/json",
        },
      })
    })

    it("should accept a URL object", () => {
      const url = new URL("https://signoz.example.com:4318/v1/logs")
      signozAdapter = new SignozAdapter(url, Severity.Info)

      expect(signozAdapter.url.toString()).toBe("https://signoz.example.com:4318/v1/logs")
      expect(AxiosApiClient).toHaveBeenCalledWith({
        baseUrl: "https://signoz.example.com:4318/v1/logs",
        headers: {
          "Content-Type": "application/json",
        },
      })
    })

    it("should accept a custom route endpoint", () => {
      signozAdapter = new SignozAdapter("http://localhost:8082/custom/endpoint", Severity.Warn)

      expect(signozAdapter.url.toString()).toBe("http://localhost:8082/custom/endpoint")
      expect(AxiosApiClient).toHaveBeenCalledWith({
        baseUrl: "http://localhost:8082/custom/endpoint",
        headers: {
          "Content-Type": "application/json",
        },
      })
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

      expect(mockApiClient.post).not.toHaveBeenCalled()
    })

    it("should log info when minimumLogLevel is Info", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Info)

      await signozAdapter.info("Info message")

      expect(mockApiClient.post).toHaveBeenCalledWith("", expect.any(Object))
    })

    it("should not log debug when minimumLogLevel is Info", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Info)

      await signozAdapter.debug("Debug message")

      expect(mockApiClient.post).not.toHaveBeenCalled()
    })

    it("should log error when minimumLogLevel is Warn", async () => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Warn)

      await signozAdapter.error("Error message")

      expect(mockApiClient.post).toHaveBeenCalled()
    })
  })

  describe("Logging Methods", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Trace)
    })

    it("should post trace logs to the provided URL", async () => {
      await signozAdapter.trace("Trace message")

      expect(mockApiClient.post).toHaveBeenCalledWith("", {
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

      expect(mockApiClient.post).toHaveBeenCalledWith("", {
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

      expect(mockApiClient.post).toHaveBeenCalledWith("", {
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

      expect(mockApiClient.post).toHaveBeenCalledWith("", {
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

      expect(mockApiClient.post).toHaveBeenCalledWith("", {
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
      await signozAdapter.exception("Exception message", error)

      expect(mockApiClient.post).toHaveBeenCalledWith("", {
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  expect.objectContaining({
                    severityText: SignozSeverity.Fatal,
                    body: { stringValue: "Exception message" },
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

      expect(mockApiClient.post).toHaveBeenCalledWith("", {
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
  })

  describe("API Error Handling", () => {
    beforeEach(() => {
      signozAdapter = new SignozAdapter("http://collector:4318/v1/logs", Severity.Debug)
      jest.spyOn(console, "log").mockImplementation(() => {})
    })

    afterEach(() => {
      ;(console.log as jest.Mock).mockRestore()
    })

    it("should log error when API call fails", async () => {
      mockApiClient.post.mockResolvedValue({
        success: false,
        message: "API Error",
        data: "Error details",
      })

      const result = await (signozAdapter as any).captureMessage("Test", SignozSeverity.Info)

      expect(result).toBe(false)
      expect(console.log).toHaveBeenCalledWith("API Error: Error details")
    })

    it("should return true when API call succeeds", async () => {
      mockApiClient.post.mockResolvedValue({
        success: true,
        message: "Success",
        data: {},
      })

      const result = await (signozAdapter as any).captureMessage("Test", SignozSeverity.Info)

      expect(result).toBe(true)
    })
  })
})
