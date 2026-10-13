import { describe, expect, it } from "@jest/globals"
import { isSensitiveKey, maskSensitiveData, mergeSensitiveKeyMasking } from "../src/serialization"

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
