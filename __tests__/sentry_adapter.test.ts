import { jest, describe, expect, it, beforeEach, afterEach } from "@jest/globals"
import { SentryAdapter, SentrySeverity } from "../src/adapters/sentry_adapter"
import { Logger, Severity } from "../src/logger"

describe("SentryAdapter Tests", () => {
  let mockSentry: any
  let mockScope: any
  let sentryAdapter: SentryAdapter

  beforeEach(() => {
    mockScope = {
      setExtra: jest.fn(),
    }

    mockSentry = {
      withScope: jest.fn((callback: any) => callback(mockScope)),
      captureMessage: jest.fn(),
      captureException: jest.fn(),
    }

    sentryAdapter = new SentryAdapter(mockSentry, Severity.Debug)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // Essential tests for byte-based truncation
  describe("truncateToByteSize", () => {
    it("should handle multi-byte characters correctly", () => {
      const str = "😊🚀🎉".repeat(50) // Each emoji is 4 bytes
      const result = (sentryAdapter as any).truncateToByteSize(str, 100) // 100 bytes = 25 emojis max
      const resultBytes = new TextEncoder().encode(result).length

      expect(resultBytes).toBeLessThanOrEqual(100)
      expect(resultBytes).toBeGreaterThan(90) // Should be close to the limit
    })
  })

  // Essential tests for safe JSON stringify
  describe("safeStringify", () => {
    it("should handle circular references", () => {
      const obj: any = { name: "Test" }
      obj.self = obj // Create circular reference

      const result = (sentryAdapter as any).safeStringify(obj, 2)

      expect(result).toContain('"name": "Test"')
      expect(result).toContain('"self": "[Circular]"')
    })

    it("should handle BigInt values", () => {
      const obj = { id: BigInt(1234567890123456789), name: "Test" }
      const result = (sentryAdapter as any).safeStringify(obj, 2)

      expect(result).toContain('"id": "')
      expect(result).toContain('"name": "Test"')
      expect(result).toContain("1234567890123456") // Check for partial BigInt value
    })

    it("should return fallback string on complete failure", () => {
      // Mock JSON.stringify to throw an error using jest.spyOn for automatic restoration
      const stringifySpy = jest.spyOn(JSON, "stringify").mockImplementation(() => {
        throw new Error("Complete failure")
      })

      const obj = { test: "value" }
      const result = (sentryAdapter as any).safeStringify(obj)

      expect(result).toBe("[Unserializable extra-data]")

      // Automatically restore original JSON.stringify
      stringifySpy.mockRestore()
    })
  })

  // Essential test for response trimming
  describe("trimResponse", () => {
    it("should trim response to essential fields only", () => {
      const response = {
        success: false,
        message: "API Error",
        error: new Error("Something went wrong"),
        status: 404,
        statusText: "Not Found",
        data: { error: "Details" },
        headers: { "content-type": "application/json" },
        config: { url: "/api/test" },
        extraField: "should be ignored",
      } as any

      const trimmedResponse = (sentryAdapter as any).trimResponse(response)

      expect(trimmedResponse).toEqual({
        status: 404,
        statusText: "Not Found",
        message: "API Error",
        data: { error: "Details" },
      })
    })
  })

  // Essential test for data processing
  describe("processData", () => {
    it("should combine extraData and trimmed response", () => {
      const extraData = { userId: "12345" }
      const response = {
        status: 404,
        statusText: "Not Found",
        message: "API Error",
        data: { error: "Details" },
      } as any

      const processedData = (sentryAdapter as any).processData(extraData, response)

      expect(processedData).toEqual({
        userId: "12345",
        response: {
          status: 404,
          statusText: "Not Found",
          message: "API Error",
          data: { error: "Details" },
        },
      })
    })
  })

  // Essential test for truncation
  describe("truncateDataIfNeeded", () => {
    it("should handle multi-byte characters correctly in truncation", () => {
      const emojiData = "😊🚀🎉".repeat(5000) // Each emoji is 4 bytes, so this is ~60KB
      const processedData = {
        userId: "12345",
        emojiField: emojiData,
        regularField: "normal text",
      }

      const result = (sentryAdapter as any).truncateDataIfNeeded(processedData)
      const resultBytes = new TextEncoder().encode(result).length

      expect(result).toContain("... [TRUNCATED - extraData]")
      expect(resultBytes).toBeLessThan(16 * 1024) // Should be under 16KB in actual bytes
    })
  })

  // Essential integration test
  describe("captureMessage integration", () => {
    it("should call setExtra with processed data when response exists", () => {
      const extraData = { userId: "12345" }
      const response = {
        status: 404,
        statusText: "Not Found",
        data: { error: "Details" },
      } as any

      sentryAdapter.error("Test error", { extraData, response })

      expect(mockSentry.withScope).toHaveBeenCalled()
      expect(mockScope.setExtra).toHaveBeenCalledWith("extra-data", expect.stringContaining('"userId": "12345"'))
      expect(mockScope.setExtra).toHaveBeenCalledWith("extra-data", expect.stringContaining('"status": 404'))
      expect(mockSentry.captureMessage).toHaveBeenCalledWith("Test error", SentrySeverity.Error)
    })
  })
})
