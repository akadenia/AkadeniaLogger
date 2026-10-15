import { jest, describe, expect, it, beforeEach, afterEach } from "@jest/globals"
import { SentryAdapter, SentrySeverity } from "../src/adapters/sentry_adapter"
import { Severity } from "../src/logger"
import { safeStringify } from "../src/serialization"

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

    it("never splits a surrogate pair", () => {
      const result = (sentryAdapter as any).truncateToByteSize("a😊😊", 7) // 1 + 4 bytes fit, the next emoji does not

      expect(result).toBe("a😊")
    })

    it("counts lone surrogates as the 3 bytes they encode to", () => {
      const str = "\ud800ab"

      expect((sentryAdapter as any).truncateToByteSize(str, 4)).toBe("\ud800a")
      expect(new TextEncoder().encode("\ud800a").length).toBe(4)
    })
  })

  // Essential tests for safe JSON stringify
  describe("safeStringify", () => {
    it("should handle circular references", () => {
      const obj: any = { name: "Test" }
      obj.self = obj // Create circular reference

      const result = safeStringify(obj, 2)

      expect(result).toContain('"name": "Test"')
      expect(result).toContain('"self": "[Circular]"')
    })

    it("keeps shared references that are not circular", () => {
      const shared = { id: 1 }

      expect(JSON.parse(safeStringify({ a: shared, b: shared }))).toEqual({ a: { id: 1 }, b: { id: 1 } })
    })

    it("should handle BigInt values", () => {
      const obj = { id: BigInt("1234567890123456789"), name: "Test" }
      const result = safeStringify(obj, 2)

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
      const result = safeStringify(obj)

      expect(result).toBe("[Unserializable value]")

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

    it("should mask sensitive keys in extraData", () => {
      const processedData = (sentryAdapter as any).processData({
        userId: "12345",
        token: "super-secret",
        key: "order-42",
        keyName: "checkout",
        nested: { password: "hunter2", ok: true },
      })

      expect(processedData).toEqual({
        userId: "12345",
        token: "[MASKED]",
        key: "order-42",
        keyName: "checkout",
        nested: { password: "[MASKED]", ok: true },
      })
    })

    it("should apply add, keys override, and exclude from masking options", () => {
      const added = (sentryAdapter as any).processData({ ssn: "111", token: "abc" }, undefined, { add: ["ssn"] })
      expect(added).toEqual({ ssn: "[MASKED]", token: "[MASKED]" })

      const overridden = (sentryAdapter as any).processData({ ssn: "111", token: "abc", password: "p" }, undefined, {
        keys: ["token"],
      })
      expect(overridden).toEqual({ ssn: "111", token: "[MASKED]", password: "p" })

      const excluded = (sentryAdapter as any).processData({ token: "abc", sessionId: "keep" }, undefined, {
        exclude: ["sessionId"],
      })
      expect(excluded).toEqual({ token: "[MASKED]", sessionId: "keep" })
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

      expect(result.extraString).toContain("EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION")
      expect(result.extraString).toContain('"userId": "12345"')
      expect(result.extraString).toContain('"regularField": "normal text"')
      expect(result.extraString).not.toContain(emojiData)
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

    it("should not send unmasked extraData in the options extra for non-Error exceptions", () => {
      sentryAdapter.exception("Failed", "string thrown" as unknown as Error, {
        extraData: { userId: "u1", password: "hunter2", accessToken: "tok" },
        response: { status: 500, data: { secret: "s" } },
        signozPayload: { trace_id: "t1", authHeader: "Bearer x" },
      })

      const optionsExtra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "options")?.[1] as string
      expect(JSON.parse(optionsExtra)).toEqual({ signozPayload: { trace_id: "t1", authHeader: "[MASKED]" } })
      expect(JSON.stringify(mockScope.setExtra.mock.calls)).not.toContain("hunter2")
      expect(mockSentry.captureException).toHaveBeenCalled()
    })

    it("should cap the options extra and leave out the masking rules", () => {
      sentryAdapter.exception("Failed", "string thrown" as unknown as Error, {
        signozPayload: { attributes: { blob: "x".repeat(40 * 1024) } },
        masking: { exclude: ["session"] },
      })

      const optionsExtra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "options")?.[1] as string
      expect(new TextEncoder().encode(optionsExtra).length).toBeLessThanOrEqual(16 * 1024)
      expect(optionsExtra).not.toContain("exclude")
    })

    it("should send the non-Error notice outside the scope that holds the attachments", () => {
      const order: string[] = []
      mockSentry.withScope = jest.fn((callback: any) => {
        order.push("scope:start")
        callback(mockScope)
        order.push("scope:end")
      })
      mockSentry.captureMessage = jest.fn(() => order.push("notice"))
      mockSentry.captureException = jest.fn(() => order.push("exception"))

      sentryAdapter.exception("Failed", "string thrown" as unknown as Error, {
        attachments: [{ filename: "log.txt", data: "log" }],
      })

      expect(order).toEqual(["scope:start", "exception", "scope:end", "notice"])
    })

    it("should still capture the event when addAttachment throws", () => {
      mockScope.addAttachment = jest.fn(() => {
        throw new Error("attachment rejected")
      })

      sentryAdapter.error("Test error", {
        extraData: { payload: "x".repeat(20 * 1024) },
        attachments: [{ filename: "log.txt", data: "log" }],
      })

      expect(mockSentry.captureMessage).toHaveBeenCalledWith("Test error", SentrySeverity.Error)
      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      expect(extra).toContain("[TRUNCATED]")
    })

    it("should keep the attachment notice when extraData has a notice field", () => {
      sentryAdapter.error("Test error", { extraData: { notice: "maintenance", payload: "x".repeat(20 * 1024) } })

      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      expect(JSON.parse(extra).notice).toBe("EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION")
    })

    it("should still capture the event when extraData has a throwing toJSON or getter", () => {
      const badToJSON = {
        toJSON() {
          throw new Error("bad toJSON")
        },
      }
      const badGetter = Object.defineProperty({}, "value", {
        enumerable: true,
        get() {
          throw new Error("bad getter")
        },
      })

      sentryAdapter.error("Test error", { extraData: { badToJSON, badGetter, userId: "u1" } })

      expect(mockSentry.captureMessage).toHaveBeenCalledWith("Test error", SentrySeverity.Error)
      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      expect(JSON.parse(extra)).toEqual({
        badToJSON: "[Unserializable value]",
        badGetter: { value: "[Error accessing property]" },
        userId: "u1",
      })
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

    it("should copy Buffer input so later mutation does not change the attachment", () => {
      const buffer = Buffer.from("binary content")

      sentryAdapter.error("Test error", {
        attachments: [{ filename: "data.bin", data: buffer }],
      })

      expect(mockScope.addAttachment).toHaveBeenCalledTimes(1)
      const attachment = mockScope.addAttachment.mock.calls[0][0]
      expect(attachment.filename).toBe("data.bin")
      expect(attachment.data).toBeInstanceOf(Uint8Array)
      expect(attachment.data).not.toBe(buffer)
      buffer[0] = 0
      expect(Buffer.from(attachment.data).toString()).toBe("binary content")
    })

    it("should copy ArrayBuffer input into an independent Uint8Array", () => {
      const bytes = new Uint8Array([1, 2, 3, 4])
      const arrayBuffer = bytes.buffer

      sentryAdapter.error("Test error", {
        attachments: [{ filename: "chunk.bin", data: arrayBuffer }],
      })

      expect(mockScope.addAttachment).toHaveBeenCalledTimes(1)
      const attachment = mockScope.addAttachment.mock.calls[0][0]
      expect(attachment.data).toBeInstanceOf(Uint8Array)
      expect(Array.from(attachment.data)).toEqual([1, 2, 3, 4])
      expect(attachment.data.buffer).not.toBe(arrayBuffer)
      bytes[0] = 9
      expect(Array.from(attachment.data)).toEqual([1, 2, 3, 4])
    })

    it("should still capture when addAttachment is missing", () => {
      delete mockScope.addAttachment

      expect(() =>
        sentryAdapter.error("Test error", {
          extraData: { userId: "123" },
          attachments: [{ filename: "a.txt", data: "hello" }],
        }),
      ).not.toThrow()

      expect(mockSentry.captureMessage).toHaveBeenCalledWith("Test error", SentrySeverity.Error)
      expect(mockScope.setExtra).toHaveBeenCalledWith("extra-data", expect.stringContaining('"userId": "123"'))
    })

    it("should not serialize attachment bytes into the options extra on a non-Error exception", () => {
      const data = new Uint8Array(256).fill(120)

      sentryAdapter.exception("boom", "not-an-error" as any, {
        extraData: { userId: "u1" },
        attachments: [{ filename: "dump.bin", data }],
      })

      const optionsExtra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "options")?.[1]
      expect(optionsExtra).toBeDefined()
      expect(optionsExtra.attachments).toBeUndefined()
      expect(optionsExtra.exception).toBeUndefined()
      expect(JSON.stringify(optionsExtra)).not.toContain('"0":')
      expect(mockSentry.captureException).toHaveBeenCalled()
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

    it("should attach extra-data.json and keep a searchable extra summary when extraData is over 16KB", () => {
      const payload = "x".repeat(20 * 1024)
      sentryAdapter.error("Test error", {
        extraData: { userId: "12345", payload },
        response: { status: 404, statusText: "Not Found", data: { body: payload } },
      })

      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      const attachment = extraDataAttachment()

      expect(extra).toContain("EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION")
      expect(extra).toContain('"userId": "12345"')
      expect(extra).toContain('"status": 404')
      expect(extra).toContain('"statusText": "Not Found"')
      expect(extra).not.toContain(payload)
      expect(attachment).toEqual({
        filename: "extra-data.json",
        data: expect.stringContaining(payload),
        contentType: "application/json",
      })
      expect(attachment.data).not.toContain("[TRUNCATED - extraData]")
    })

    it("should cap auto-attachments over 5MB as valid JSON", () => {
      const payload = "x".repeat(5 * 1024 * 1024)
      sentryAdapter.error("Test error", { extraData: { payload } })

      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      const attachment = extraDataAttachment()
      const attachmentBytes = new TextEncoder().encode(attachment.data).length
      const parsed = JSON.parse(attachment.data)

      expect(parsed.truncated).toBe(true)
      expect(typeof parsed.data).toBe("string")
      expect(parsed.data).toContain("x".repeat(100))
      expect(attachmentBytes).toBeLessThanOrEqual(5 * 1024 * 1024)
      expect(extra).toContain("EXTRA DATA INCLUDED AS FILE ATTACHMENT, CHECK ATTACHMENTS SECTION")
    })

    it("should truncate extra inline when addAttachment is missing and extraData is oversized", () => {
      delete mockScope.addAttachment
      const payload = "x".repeat(20 * 1024)

      expect(() => sentryAdapter.error("Test error", { extraData: { payload } })).not.toThrow()

      expect(mockSentry.captureMessage).toHaveBeenCalledWith("Test error", SentrySeverity.Error)
      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      expect(extra).toContain("[TRUNCATED]")
      expect(extra).toContain("xxx")
      expect(new TextEncoder().encode(extra).length).toBeLessThanOrEqual(16 * 1024)
    })

    it("should keep shared references in extra instead of marking them circular", () => {
      const address = { city: "Beirut" }
      sentryAdapter.error("Test error", { extraData: { billing: address, shipping: address } })

      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string

      expect(JSON.parse(extra)).toEqual({ billing: { city: "Beirut" }, shipping: { city: "Beirut" } })
    })

    it("should mask sensitive keys in extra and extra-data.json", () => {
      const payload = "x".repeat(20 * 1024)
      sentryAdapter.error("Test error", {
        extraData: { userId: "12345", token: "super-secret", password: "hunter2", payload },
      })

      const extra = mockScope.setExtra.mock.calls.find((call: any[]) => call[0] === "extra-data")?.[1] as string
      const attachment = extraDataAttachment()

      expect(extra).toContain('"userId": "12345"')
      expect(extra).toContain("[MASKED]")
      expect(extra).not.toContain("super-secret")
      expect(extra).not.toContain("hunter2")
      expect(attachment.data).toContain("[MASKED]")
      expect(attachment.data).not.toContain("super-secret")
      expect(attachment.data).not.toContain("hunter2")
      expect(attachment.data).toContain(payload)
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

  describe("buildTruncatedJsonEnvelope", () => {
    it("should stay valid JSON and within 5MB when cutting through escapes and multi-byte characters", () => {
      const chunk = 'a"b\\c\n😊é\u0001'
      const dataString = chunk.repeat(Math.ceil((6 * 1024 * 1024) / chunk.length))

      const start = Date.now()
      const envelope = (sentryAdapter as any).buildTruncatedJsonEnvelope(dataString)
      const elapsed = Date.now() - start

      const parsed = JSON.parse(envelope)
      expect(parsed.truncated).toBe(true)
      expect(dataString.startsWith(parsed.data)).toBe(true)
      expect(new TextEncoder().encode(envelope).length).toBeLessThanOrEqual(5 * 1024 * 1024)
      expect(new TextEncoder().encode(envelope).length).toBeGreaterThan(5 * 1024 * 1024 - 16)
      expect(elapsed).toBeLessThan(1000)
    })
  })
})
