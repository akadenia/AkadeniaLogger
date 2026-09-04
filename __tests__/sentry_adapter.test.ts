import { jest, describe, expect, it, beforeEach, afterEach } from "@jest/globals"
import { SentryAdapter, SentrySeverity } from "../src/adapters/sentry_adapter"
import { Severity } from "../src/logger"

describe("SentryAdapter Tests", () => {
  let mockSentry: any
  let mockScope: any
  let sentryAdapter: SentryAdapter

  beforeEach(() => {
    mockScope = {
      setExtra: jest.fn(),
      addAttachment: jest.fn(),
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
      const obj = { id: BigInt("1234567890123456789"), name: "Test" }
      const result = (sentryAdapter as any).safeStringify(obj, 2)

      expect(result).toContain('"id": "')
      expect(result).toContain('"name": "Test"')
      expect(result).toContain('"id": "1234567890123456789"') // Check for exact BigInt string
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

  describe("prepareExtraData", () => {
    it("should attach oversized extraData and point extra at the attachments section", () => {
      const emojiData = "😊🚀🎉".repeat(5000) // Each emoji is 4 bytes, so this is ~60KB
      const processedData = {
        userId: "12345",
        emojiField: emojiData,
        regularField: "normal text",
      }

      const result = (sentryAdapter as any).prepareExtraData(processedData)

      expect(result.extraString).toBe("EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION")
      expect(result.autoAttachment.filename).toBe("extra-data.json")
      expect(result.autoAttachment.data).toContain(emojiData)
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

  describe("attachments", () => {
    it("should call addAttachment for error() with a text attachment", () => {
      sentryAdapter.error("Test error", {
        attachments: [
          {
            filename: "export-log.txt",
            data: "log content",
            contentType: "text/plain",
          },
        ],
      })

      expect(mockScope.addAttachment).toHaveBeenCalledTimes(1)
      expect(mockScope.addAttachment).toHaveBeenCalledWith({
        filename: "export-log.txt",
        data: "log content",
        contentType: "text/plain",
      })
    })

    it("should call addAttachment for exception() with an attachment", () => {
      const error = new Error("Test error")

      sentryAdapter.exception("Exception message", error, {
        attachments: [{ filename: "stack-dump.txt", data: "stack trace" }],
      })

      expect(mockScope.addAttachment).toHaveBeenCalledTimes(1)
      expect(mockScope.addAttachment).toHaveBeenCalledWith({
        filename: "stack-dump.txt",
        data: "stack trace",
      })
      expect(mockSentry.captureException).toHaveBeenCalledWith(error, undefined, mockScope)
    })

    it("should call addAttachment for each attachment when multiple are provided", () => {
      sentryAdapter.error("Test error", {
        attachments: [
          { filename: "a.txt", data: "first" },
          { filename: "b.txt", data: "second" },
        ],
      })

      expect(mockScope.addAttachment).toHaveBeenCalledTimes(2)
      expect(mockScope.addAttachment).toHaveBeenNthCalledWith(1, { filename: "a.txt", data: "first" })
      expect(mockScope.addAttachment).toHaveBeenNthCalledWith(2, { filename: "b.txt", data: "second" })
    })

    it("should normalize Buffer input to Uint8Array", () => {
      const buffer = Buffer.from("binary content")

      sentryAdapter.error("Test error", {
        attachments: [{ filename: "data.bin", data: buffer }],
      })

      expect(mockScope.addAttachment).toHaveBeenCalledTimes(1)
      const attachment = mockScope.addAttachment.mock.calls[0][0]
      expect(attachment.filename).toBe("data.bin")
      expect(attachment.data).toBeInstanceOf(Uint8Array)
      expect(Buffer.from(attachment.data).toString()).toBe("binary content")
    })

    it("should skip invalid attachments and still add valid ones", () => {
      sentryAdapter.error("Test error", {
        attachments: [
          { filename: "", data: "ignored" } as any,
          { filename: "valid.txt", data: "kept" },
          { filename: "missing-data.txt" } as any,
        ],
      })

      expect(mockScope.addAttachment).toHaveBeenCalledTimes(1)
      expect(mockScope.addAttachment).toHaveBeenCalledWith({
        filename: "valid.txt",
        data: "kept",
      })
    })

    it("should not call addAttachment when attachments is omitted", () => {
      sentryAdapter.error("Test error", { extraData: { userId: "123" } })

      expect(mockScope.addAttachment).not.toHaveBeenCalled()
    })
  })

  describe("oversized extraData auto-attachment", () => {
    const extraDataAttachment = () =>
      mockScope.addAttachment.mock.calls
        .map((call: any[]) => call[0])
        .find((attachment: any) => attachment.filename === "extra-data.json")

    it("should keep extraData under 16KB in extra only", () => {
      sentryAdapter.error("Test error", { extraData: { userId: "12345" } })

      expect(mockScope.setExtra).toHaveBeenCalledWith("extra-data", expect.stringContaining('"userId": "12345"'))
      expect(extraDataAttachment()).toBeUndefined()
    })

    it("should attach extra-data.json and replace extra with a pointer when extraData is over 16KB", () => {
      const payload = "x".repeat(20 * 1024)
      sentryAdapter.error("Test error", { extraData: { payload } })

      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      const attachment = extraDataAttachment()

      expect(extra).toBe("EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION")
      expect(attachment).toEqual({
        filename: "extra-data.json",
        data: expect.stringContaining(payload),
        contentType: "application/json",
      })
      expect(attachment.data).not.toContain("[TRUNCATED - extraData]")
    })

    it("should cap auto-attachments over 5MB", () => {
      const payload = "x".repeat(5 * 1024 * 1024)
      sentryAdapter.error("Test error", { extraData: { payload } })

      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      const attachment = extraDataAttachment()
      const attachmentBytes = new TextEncoder().encode(attachment.data).length

      expect(attachment.data.endsWith("[ATTACHMENT TRUNCATED]")).toBe(true)
      expect(attachmentBytes).toBeLessThanOrEqual(5 * 1024 * 1024)
      expect(extra).toBe("EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION")
    })

    it("should add both user attachments and extra-data.json for oversized extraData", () => {
      sentryAdapter.error("Test error", {
        extraData: { payload: "x".repeat(20 * 1024) },
        attachments: [{ filename: "user.txt", data: "hello" }],
      })

      expect(mockScope.addAttachment).toHaveBeenCalledTimes(2)
      expect(extraDataAttachment()).toMatchObject({ filename: "extra-data.json", contentType: "application/json" })
      expect(mockScope.addAttachment).toHaveBeenCalledWith({ filename: "user.txt", data: "hello" })
    })
  })
})
