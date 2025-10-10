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

      // Access private method for testing
      const trimmedResponse = (sentryAdapter as any).trimResponse(response)

      expect(trimmedResponse).toEqual({
        status: 404,
        statusText: "Not Found",
        message: "API Error",
        data: { error: "Details" },
      })

      // Verify unwanted fields are not included
      expect(trimmedResponse).not.toHaveProperty("success")
      expect(trimmedResponse).not.toHaveProperty("error")
      expect(trimmedResponse).not.toHaveProperty("headers")
      expect(trimmedResponse).not.toHaveProperty("config")
      expect(trimmedResponse).not.toHaveProperty("extraField")
    })

    it("should handle response with undefined fields", () => {
      const response = {
        status: 500,
        statusText: undefined,
        message: undefined,
        data: undefined,
        extraField: "should be ignored",
      } as any

      const trimmedResponse = (sentryAdapter as any).trimResponse(response)

      expect(trimmedResponse).toEqual({
        status: 500,
      })

      expect(trimmedResponse).not.toHaveProperty("statusText")
      expect(trimmedResponse).not.toHaveProperty("message")
      expect(trimmedResponse).not.toHaveProperty("data")
    })

    it("should return empty object for null response", () => {
      const trimmedResponse = (sentryAdapter as any).trimResponse(null)

      expect(trimmedResponse).toEqual({})
    })

    it("should return empty object for non-object response", () => {
      const trimmedResponse = (sentryAdapter as any).trimResponse("string response")

      expect(trimmedResponse).toEqual({})
    })
  })

  describe("processData", () => {
    it("should combine extraData and trimmed response", () => {
      const extraData = {
        userId: "12345",
        action: "fetch_data",
      }

      const response = {
        status: 404,
        statusText: "Not Found",
        message: "API Error",
        data: { error: "Details" },
        extraField: "should be ignored",
      } as any

      const processedData = (sentryAdapter as any).processData(extraData, response)

      expect(processedData).toEqual({
        userId: "12345",
        action: "fetch_data",
        response: {
          status: 404,
          statusText: "Not Found",
          message: "API Error",
          data: { error: "Details" },
        },
      })
    })

    it("should handle extraData without response", () => {
      const extraData = {
        userId: "12345",
        action: "fetch_data",
      }

      const processedData = (sentryAdapter as any).processData(extraData, undefined)

      expect(processedData).toEqual({
        userId: "12345",
        action: "fetch_data",
      })

      expect(processedData).not.toHaveProperty("response")
    })

    it("should handle response without extraData", () => {
      const response = {
        status: 500,
        message: "Server Error",
        data: { error: "Internal error" },
      } as any

      const processedData = (sentryAdapter as any).processData(undefined, response)

      expect(processedData).toEqual({
        response: {
          status: 500,
          message: "Server Error",
          data: { error: "Internal error" },
        },
      })
    })

    it("should handle empty response object", () => {
      const extraData = { userId: "12345" }
      const response = {} as any

      const processedData = (sentryAdapter as any).processData(extraData, response)

      expect(processedData).toEqual({
        userId: "12345",
      })

      expect(processedData).not.toHaveProperty("response")
    })
  })

  describe("truncateDataIfNeeded", () => {
    it("should not truncate small data", () => {
      const processedData = {
        userId: "12345",
        response: {
          status: 200,
          data: { message: "Success" },
        },
      }

      const result = (sentryAdapter as any).truncateDataIfNeeded(processedData)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual(processedData)
      expect(parsed.response._dataTruncated).toBeUndefined()
    })

    it("should truncate large response data", () => {
      const largeData = "x".repeat(20 * 1024) // 20KB of data
      const processedData = {
        userId: "12345",
        response: {
          status: 500,
          data: largeData,
        },
      }

      const result = (sentryAdapter as any).truncateDataIfNeeded(processedData)
      const parsed = JSON.parse(result)

      expect(parsed.userId).toBe("12345")
      expect(parsed.response.status).toBe(500)
      expect(parsed.response._dataTruncated).toBe(true)
      expect(parsed.response.data).toContain("... [TRUNCATED]")
      expect(parsed.response.data.length).toBeLessThan(largeData.length)
    })

    it("should remove response data if no space available", () => {
      // Create a scenario where base data is close to limit
      const largeBaseData = "x".repeat(16 * 1024 - 50) // Almost at 16KB limit
      const processedData = {
        largeField: largeBaseData,
        response: {
          status: 500,
          data: "This should be removed entirely",
        },
      }

      const result = (sentryAdapter as any).truncateDataIfNeeded(processedData)
      const parsed = JSON.parse(result)

      expect(parsed.response.status).toBe(500)
      expect(parsed.response.data).toBe("[Removed - Exceeds size limit]")
      expect(parsed.response._dataTruncated).toBe(true)
    })

    it("should handle data without response", () => {
      const processedData = {
        userId: "12345",
        message: "Some message",
      }

      const result = (sentryAdapter as any).truncateDataIfNeeded(processedData)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual(processedData)
    })

    it("should handle response without data field", () => {
      const processedData = {
        userId: "12345",
        response: {
          status: 404,
          statusText: "Not Found",
        },
      }

      const result = (sentryAdapter as any).truncateDataIfNeeded(processedData)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual(processedData)
    })
  })

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
      expect(mockScope.setExtra).toHaveBeenCalledWith("extra-data", expect.stringContaining('"statusText": "Not Found"'))
      expect(mockSentry.captureMessage).toHaveBeenCalledWith("Test error", SentrySeverity.Error)
    })

    it("should call setExtra with simple string when no response", () => {
      const extraData = { userId: "12345" }

      sentryAdapter.error("Test error", { extraData })

      expect(mockSentry.withScope).toHaveBeenCalled()
      expect(mockScope.setExtra).toHaveBeenCalledWith("extra-data", '{\n    "userId": "12345"\n}')
      expect(mockSentry.captureMessage).toHaveBeenCalledWith("Test error", SentrySeverity.Error)
    })

    it("should handle large response data in captureMessage", () => {
      const largeData = "x".repeat(20 * 1024) // 20KB
      const response = {
        status: 500,
        data: largeData,
      } as any

      sentryAdapter.error("Large response error", { response })

      expect(mockSentry.withScope).toHaveBeenCalled()
      expect(mockScope.setExtra).toHaveBeenCalledWith("extra-data", expect.stringContaining("... [TRUNCATED]"))
      expect(mockScope.setExtra).toHaveBeenCalledWith("extra-data", expect.stringContaining('"_dataTruncated": true'))
    })

    it("should not call setExtra when no extraData or response", () => {
      sentryAdapter.error("Simple error")

      expect(mockSentry.withScope).toHaveBeenCalled()
      expect(mockScope.setExtra).not.toHaveBeenCalled()
      expect(mockSentry.captureMessage).toHaveBeenCalledWith("Simple error", SentrySeverity.Error)
    })
  })
})
