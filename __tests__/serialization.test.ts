import { describe, expect, it } from "@jest/globals"
import { createEnhancedResponseSummary, isSensitiveKey, maskSensitiveData, mergeSensitiveKeyMasking } from "../src/serialization"

describe("isSensitiveKey", () => {
  it("masks default prefixes and not vague key names", () => {
    expect(isSensitiveKey("token")).toBe(true)
    expect(isSensitiveKey("passwordHash")).toBe(true)
    expect(isSensitiveKey("Authorization")).toBe(true)
    expect(isSensitiveKey("userId")).toBe(false)
    expect(isSensitiveKey("key")).toBe(false)
    expect(isSensitiveKey("keyName")).toBe(false)
  })

  it("adds prefixes on top of the default list", () => {
    expect(isSensitiveKey("ssn", { add: ["ssn"] })).toBe(true)
    expect(isSensitiveKey("ssnNumber", { add: ["ssn"] })).toBe(true)
    expect(isSensitiveKey("token", { add: ["ssn"] })).toBe(true)
  })

  it("replaces the default list when keys is set", () => {
    expect(isSensitiveKey("token", { keys: ["token"] })).toBe(true)
    expect(isSensitiveKey("password", { keys: ["token"] })).toBe(false)
    expect(isSensitiveKey("ssn", { keys: ["token"], add: ["ssn"] })).toBe(true)
  })

  it("excludes a default prefix so related keys are not masked", () => {
    expect(isSensitiveKey("session", { exclude: ["session"] })).toBe(false)
    expect(isSensitiveKey("sessionId", { exclude: ["session"] })).toBe(false)
    expect(isSensitiveKey("token", { exclude: ["session"] })).toBe(true)
  })

  it("excludes a specific key without dropping the prefix", () => {
    expect(isSensitiveKey("sessionId", { exclude: ["sessionId"] })).toBe(false)
    expect(isSensitiveKey("session", { exclude: ["sessionId"] })).toBe(true)
    expect(isSensitiveKey("sessionToken", { exclude: ["sessionId"] })).toBe(true)
  })

  it("masks nothing when keys is an empty override", () => {
    expect(isSensitiveKey("token", { keys: [] })).toBe(false)
    expect(isSensitiveKey("ssn", { keys: [], add: ["ssn"] })).toBe(true)
  })
})

describe("maskSensitiveData", () => {
  it("uses the resolved masking rules", () => {
    const masked = maskSensitiveData(
      { userId: "u1", token: "abc", ssn: "111", sessionId: "keep" },
      { add: ["ssn"], exclude: ["sessionId"] },
    )

    expect(masked).toEqual({
      userId: "u1",
      token: "[MASKED]",
      ssn: "[MASKED]",
      sessionId: "keep",
    })
  })
})

describe("mergeSensitiveKeyMasking", () => {
  it("lets a per-call config override keys and concat add/exclude", () => {
    expect(
      mergeSensitiveKeyMasking({ add: ["ssn"], exclude: ["session"] }, { keys: ["token"], exclude: ["authorization"] }),
    ).toEqual({
      keys: ["token"],
      add: ["ssn"],
      exclude: ["session", "authorization"],
    })
  })
})

describe("isSensitiveKey word matching", () => {
  it.each([
    "apiKey",
    "APIKey",
    "api_key",
    "x-api-key",
    "accessToken",
    "refresh_token",
    "userPassword",
    "db.passwd",
    "privateKey",
    "aws_access_key_id",
    "webhookSignature",
    "keySecret",
  ])("masks %s", (key) => {
    expect(isSensitiveKey(key)).toBe(true)
  })

  it.each(["signal", "significant", "keyName", "cacheKey", "sortKey", "monkey", "userId", "description"])(
    "does not mask %s",
    (key) => {
      expect(isSensitiveKey(key)).toBe(false)
    },
  )

  it("matches custom multi-word prefixes regardless of separators", () => {
    expect(isSensitiveKey("user-ssn-number", { add: ["ssn"] })).toBe(true)
    expect(isSensitiveKey("stripeCustomerId", { add: ["customer_id"] })).toBe(true)
    expect(isSensitiveKey("customer", { add: ["customer_id"] })).toBe(false)
  })

  it("excludes a default prefix even when written with separators", () => {
    expect(isSensitiveKey("x-api-key", { exclude: ["api_key"] })).toBe(false)
    expect(isSensitiveKey("accessToken", { exclude: ["api_key"] })).toBe(true)
  })
})

describe("maskSensitiveData values", () => {
  it("serializes values with toJSON the way JSON.stringify would", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z")
    const url = new URL("https://example.com/path")
    const withToJSON = { toJSON: () => ({ id: 1, token: "secret" }) }

    expect(maskSensitiveData({ createdAt, url, withToJSON })).toEqual({
      createdAt: "2026-01-01T00:00:00.000Z",
      url: "https://example.com/path",
      withToJSON: { id: 1, token: "[MASKED]" },
    })
  })

  it("keeps typed arrays as they are", () => {
    const bytes = new Uint8Array([1, 2, 3])

    expect(maskSensitiveData({ bytes }).bytes).toBe(bytes)
  })

  it("does not report shared references as circular", () => {
    const shared = { id: 1, token: "secret" }

    expect(maskSensitiveData({ a: shared, b: shared, list: [shared] })).toEqual({
      a: { id: 1, token: "[MASKED]" },
      b: { id: 1, token: "[MASKED]" },
      list: [{ id: 1, token: "[MASKED]" }],
    })
  })

  it("still replaces real cycles", () => {
    const parent: any = { name: "parent" }
    parent.child = { parent }

    expect(maskSensitiveData(parent)).toEqual({ name: "parent", child: { parent: "[Circular]" } })
  })

  it("stays bounded on heavily shared object graphs", () => {
    let node: any = { leaf: true }
    for (let i = 0; i < 40; i++) node = { l: node, r: node }

    const start = Date.now()
    maskSensitiveData(node)

    expect(Date.now() - start).toBeLessThan(1000)
  })
})

describe("isSensitiveKey whole words and excludes", () => {
  it.each(["sig", "x-sig", "sigHash", "SIG"])("masks %s as a whole word", (key) => {
    expect(isSensitiveKey(key)).toBe(true)
  })

  it("drops the sig word when keys replaces the defaults or it is excluded", () => {
    expect(isSensitiveKey("sig", { keys: ["token"] })).toBe(false)
    expect(isSensitiveKey("sig", { exclude: ["sig"] })).toBe(false)
  })

  it.each(["session_id", "session-id", "SESSION_ID", "sessionId"])("excludes %s via sessionId", (key) => {
    expect(isSensitiveKey(key, { exclude: ["sessionId"] })).toBe(false)
  })

  it("resolves rules per masking config", () => {
    const masking = { add: ["ssn"] }

    expect(isSensitiveKey("ssn", masking)).toBe(true)
    expect(isSensitiveKey("ssn")).toBe(false)
    expect(isSensitiveKey("user_ssn", masking)).toBe(true)
  })
})

describe("masking config plumbing", () => {
  it("keeps the same config object when there is nothing to merge", () => {
    const base = { add: ["ssn"] }

    expect(mergeSensitiveKeyMasking(base, undefined)).toBe(base)
    expect(mergeSensitiveKeyMasking(undefined, base)).toBe(base)
  })

  it("applies masking rules to response summaries", () => {
    const response = { status: 200, ssn: "111", sessionId: "s1" }

    expect(createEnhancedResponseSummary(response, { add: ["ssn"], exclude: ["session"] })).toBe('status: 200, sessionId: "s1"')
  })
})
