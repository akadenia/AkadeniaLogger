import { jest, describe, expect, it, beforeEach, afterEach } from "@jest/globals"
import { FirebaseAdapter } from "../src/adapters/firebase_adapter"
import { PredefinedLogEvents, Severity } from "../src/logger"

describe("FirebaseAdapter Tests", () => {
  let crashlyticsInstance: any
  let analyticsInstance: any
  let crashlytics: any
  let analytics: any
  let firebaseAdapter: FirebaseAdapter

  beforeEach(() => {
    crashlyticsInstance = {
      setAttributes: jest.fn(),
      recordError: jest.fn(),
    }
    analyticsInstance = {
      setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
      logEvent: jest.fn(),
      logLogin: jest.fn(),
      logShare: jest.fn(),
      logAppOpen: jest.fn(),
      logSearch: jest.fn(),
    }
    crashlytics = jest.fn(() => crashlyticsInstance)
    analytics = jest.fn(() => analyticsInstance)

    firebaseAdapter = new FirebaseAdapter(crashlytics, analytics, Severity.Debug, true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("Constructor", () => {
    it("should set analytics collection", () => {
      expect(firebaseAdapter.name).toBe("firebase_crashlytics")
      expect(analyticsInstance.setAnalyticsCollectionEnabled).toHaveBeenCalledWith(true)
    })

    it("should default collectionEnabled to true", () => {
      new FirebaseAdapter(crashlytics, analytics)

      expect(analyticsInstance.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(true)
    })

    it("should record an error when enabling collection fails", async () => {
      const failure = new Error("collection failed")
      analyticsInstance.setAnalyticsCollectionEnabled = jest.fn(() => Promise.reject(failure))

      new FirebaseAdapter(crashlytics, analytics, Severity.Debug, false)
      await new Promise((resolve) => setImmediate(resolve))

      expect(crashlyticsInstance.recordError).toHaveBeenCalledWith(failure, "Failed to enable analytics collection")
    })

    it("should not throw when setAnalyticsCollectionEnabled does not return a promise", () => {
      analyticsInstance.setAnalyticsCollectionEnabled = jest.fn(() => undefined)

      expect(() => new FirebaseAdapter(crashlytics, analytics, Severity.Debug, false)).not.toThrow()
    })
  })

  describe("Analytics events", () => {
    it("should replace spaces in event names with underscores", () => {
      firebaseAdapter.info("Button Clicked")

      expect(analyticsInstance.logEvent).toHaveBeenCalledWith("Button_Clicked", {})
    })

    it("should produce a valid Firebase event name", () => {
      firebaseAdapter.info("  42 users: signed-up! " + "x".repeat(60))

      const [name] = analyticsInstance.logEvent.mock.calls[0]
      expect(name).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/)
      expect(name.length).toBeLessThanOrEqual(40)
      expect(name.startsWith("e_42_users__signed_up_")).toBe(true)
    })

    it("should flatten extraData and response into event params", () => {
      firebaseAdapter.warn("Upload failed", {
        extraData: { fileSize: 1024, "file type": "pdf", retried: true, meta: { a: 1 }, skipped: null },
        response: { status: 500, statusText: "Server Error", data: { big: "payload" } },
        forceConsole: true,
      })

      expect(analyticsInstance.logEvent).toHaveBeenCalledWith("Upload_failed", {
        fileSize: 1024,
        file_type: "pdf",
        retried: "true",
        meta: '{"a":1}',
        response_status: 500,
        response_status_text: "Server Error",
      })
    })

    it("should truncate param values to 100 characters", () => {
      firebaseAdapter.info("Event", { extraData: { long: "y".repeat(150) } })

      const [, params] = analyticsInstance.logEvent.mock.calls[0]
      expect(params.long).toHaveLength(100)
    })

    it("should respect the minimum log level", () => {
      firebaseAdapter = new FirebaseAdapter(crashlytics, analytics, Severity.Warn, true)

      firebaseAdapter.debug("Debug")
      firebaseAdapter.info("Info")
      firebaseAdapter.warn("Warn")

      expect(analyticsInstance.logEvent).toHaveBeenCalledTimes(1)
      expect(analyticsInstance.logEvent).toHaveBeenCalledWith("Warn", {})
    })
  })

  describe("Crashlytics", () => {
    it("should record errors with string-only attributes", () => {
      firebaseAdapter.error("Request failed", {
        extraData: { userId: 42, nested: { a: [1, 2] }, big: BigInt(7) },
        response: { status: 404 },
      })

      expect(crashlyticsInstance.setAttributes).toHaveBeenCalledWith({
        userId: "42",
        nested: '{"a":[1,2]}',
        big: "7",
        response_status: "404",
      })
      const [error, message] = crashlyticsInstance.recordError.mock.calls[0]
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe("Request failed")
      expect(message).toBe("Request failed")
    })

    it("should not fail on circular extraData", () => {
      const circular: any = {}
      circular.self = circular

      expect(() => firebaseAdapter.error("Circular", { extraData: { circular } })).not.toThrow()
      expect(crashlyticsInstance.setAttributes).toHaveBeenCalledWith({ circular: '{"self":"[Circular]"}' })
    })

    it("should record the original exception", () => {
      const exception = new Error("boom")

      firebaseAdapter.exception("Something broke", exception, { extraData: { step: "checkout" } })

      expect(crashlyticsInstance.setAttributes).toHaveBeenCalledWith({ step: "checkout" })
      expect(crashlyticsInstance.recordError).toHaveBeenCalledWith(exception, "Something broke")
    })
  })

  describe("Predefined events", () => {
    it("should log login with the provided method", () => {
      firebaseAdapter.predefinedEvent({ type: PredefinedLogEvents.Login, extraData: { method: "google" } })

      expect(analyticsInstance.logLogin).toHaveBeenCalledWith({ method: "google" })
    })

    it("should default the login method to email", () => {
      firebaseAdapter.predefinedEvent({ type: PredefinedLogEvents.Login })

      expect(analyticsInstance.logLogin).toHaveBeenCalledWith({ method: "email" })
    })

    it("should log share, search and app open", () => {
      firebaseAdapter.predefinedEvent({
        type: PredefinedLogEvents.Share,
        extraData: { contentType: "article", itemId: "1", method: "link" },
      })
      firebaseAdapter.predefinedEvent({ type: PredefinedLogEvents.Search, extraData: { searchTerm: "shoes" } })
      firebaseAdapter.predefinedEvent({ type: PredefinedLogEvents.AppOpen })

      expect(analyticsInstance.logShare).toHaveBeenCalledWith({ content_type: "article", item_id: "1", method: "link" })
      expect(analyticsInstance.logSearch).toHaveBeenCalledWith({ search_term: "shoes" })
      expect(analyticsInstance.logAppOpen).toHaveBeenCalled()
    })
  })
})
