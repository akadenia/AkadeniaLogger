// Enhanced object serialization for better logging visibility
// Provides detailed object inspection while maintaining security

// Matched against the start of each word in a key (camelCase, snake_case, kebab-case, dot.case),
// so `token` masks `accessToken` and `refresh_token`, and `apikey` masks `x-api-key`
export const DEFAULT_SENSITIVE_KEY_PREFIXES = [
  "header",
  "auth",
  "token",
  "password",
  "passwd",
  "passphrase",
  "secret",
  "credential",
  "session",
  "cookie",
  "signature",
  "csrf",
  "apikey",
  "accesskey",
  "privatekey",
] as const

// Matched only as a whole word, so `sig` masks `sig`, `x-sig` and `sigHash` but not `signal`,
// and `pin` masks `pinCode` but not `pinned`
export const DEFAULT_SENSITIVE_KEY_WORDS = ["sig", "pin", "otp", "cvv"] as const

export type SensitiveKeyMasking = {
  /** Replace the default prefix list (and the default whole words). Omit to keep the defaults. */
  keys?: string[]
  /** Extra prefixes to mask, on top of the default list or `keys`. Matched at the start of any word in a key. */
  add?: string[]
  /**
   * Do not mask these names (case-insensitive, ignoring separators: `sessionId` also covers `session_id`).
   * A value that matches a resolved prefix drops that prefix (`session` unmasks `sessionId`).
   * A value that is only an exact key unmasks that key (`sessionId` leaves `session` masked).
   */
  exclude?: string[]
}

const MAX_DEPTH = 3
const MAX_STRING_LENGTH = 200
const MAX_ARRAY_ITEMS = 5
const MAX_STRINGIFY_OBJECTS = 10000

export const mergeSensitiveKeyMasking = (
  base?: SensitiveKeyMasking,
  override?: SensitiveKeyMasking,
): SensitiveKeyMasking | undefined => {
  if (!base && !override) return undefined
  // Keep the same object when there is nothing to merge, so resolved rules stay cached across calls
  if (!override) return base
  if (!base) return override

  const keys = override?.keys ?? base?.keys
  const add = [...(base?.add ?? []), ...(override?.add ?? [])]
  const exclude = [...(base?.exclude ?? []), ...(override?.exclude ?? [])]
  const merged: SensitiveKeyMasking = {}

  if (keys) merged.keys = keys
  if (add.length > 0) merged.add = add
  if (exclude.length > 0) merged.exclude = exclude

  return Object.keys(merged).length > 0 ? merged : undefined
}

const normalizeKeyPart = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "")

// "x-api-key" -> ["x", "api", "key"], "accessTokenV2" -> ["access", "token", "v2"], "APIKey" -> ["api", "key"]
const splitKeyWords = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

type MaskingRules = {
  exclude: Set<string>
  prefixes: string[]
  words: Set<string>
}

const resolvedRules = new WeakMap<SensitiveKeyMasking, MaskingRules>()
let defaultRules: MaskingRules | undefined

// Normalized once per masking config instead of once per key; configs are treated as immutable
const resolveMaskingRules = (masking?: SensitiveKeyMasking): MaskingRules => {
  const cached = masking ? resolvedRules.get(masking) : defaultRules
  if (cached) return cached

  const exclude = new Set((masking?.exclude ?? []).map(normalizeKeyPart))
  const keep = (term: string) => term !== "" && !exclude.has(term)
  const rules: MaskingRules = {
    exclude,
    prefixes: [...(masking?.keys ?? DEFAULT_SENSITIVE_KEY_PREFIXES), ...(masking?.add ?? [])].map(normalizeKeyPart).filter(keep),
    words: new Set(masking?.keys ? [] : DEFAULT_SENSITIVE_KEY_WORDS.filter(keep)),
  }

  if (masking) resolvedRules.set(masking, rules)
  else defaultRules = rules
  return rules
}

export const isSensitiveKey = (key: string, masking?: SensitiveKeyMasking): boolean => {
  const rules = resolveMaskingRules(masking)
  const normalizedKey = normalizeKeyPart(key)

  if (rules.exclude.has(normalizedKey)) return false

  const words = splitKeyWords(key)
  if (words.some((word) => rules.words.has(word))) return true

  // A prefix matches when the key, read from the start of any word, begins with it
  return words.some((_, i) => {
    const rest = words.slice(i).join("")
    return rules.prefixes.some((prefix) => rest.startsWith(prefix))
  })
}

/**
 * Enhanced object serialization that shows more details than the basic "[object with X keys]"
 * @param obj - Object to serialize
 * @param depth - Current recursion depth (internal use)
 * @param visited - Set of visited objects to prevent circular references
 * @returns Detailed string representation of the object
 */
export const serializeObjectDetailed = (
  obj: any,
  depth: number = 0,
  visited: WeakSet<object> = new WeakSet(),
  masking?: SensitiveKeyMasking,
): string => {
  // Handle null/undefined
  if (obj === null) return "null"
  if (obj === undefined) return "undefined"

  // Handle primitives
  if (typeof obj !== "object") {
    if (typeof obj === "string") {
      return obj.length > MAX_STRING_LENGTH ? `"${obj.substring(0, MAX_STRING_LENGTH - 3)}..."` : `"${obj}"`
    }
    return String(obj)
  }

  // Prevent circular references
  if (visited.has(obj)) {
    return "[Circular Reference]"
  }
  visited.add(obj)

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]"

    const items = obj
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => (depth < MAX_DEPTH ? serializeObjectDetailed(item, depth + 1, visited, masking) : "[...]"))

    const suffix = obj.length > MAX_ARRAY_ITEMS ? `, ... ${obj.length - MAX_ARRAY_ITEMS} more` : ""
    return `[${items.join(", ")}${suffix}]`
  }

  // Handle special objects
  if (obj instanceof Date) {
    return `Date(${obj.toISOString()})`
  }

  if (obj instanceof Error) {
    return `Error(${obj.name}: ${obj.message})`
  }

  // Handle regular objects
  const keys = Object.keys(obj)
  if (keys.length === 0) return "{}"

  // If we've reached max depth, just show summary
  if (depth >= MAX_DEPTH) {
    return `{${keys.length} keys: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""}}`
  }

  const entries: string[] = []

  for (const key of keys) {
    try {
      const value = obj[key]

      // Check if key is sensitive
      if (isSensitiveKey(key, masking)) {
        entries.push(`${key}: [MASKED]`)
        continue
      }

      // Serialize the value
      const serializedValue = serializeObjectDetailed(value, depth + 1, visited, masking)
      entries.push(`${key}: ${serializedValue}`)

      // Limit number of properties shown at each level
      if (entries.length >= 10) {
        const remaining = keys.length - entries.length
        if (remaining > 0) {
          entries.push(`... ${remaining} more properties`)
        }
        break
      }
    } catch (error) {
      entries.push(`${key}: [Error accessing property]`)
    }
  }

  return `{${entries.join(", ")}}`
}

/**
 * Deep-copy a value, replacing sensitive keys with `[MASKED]`.
 * Used before sending extraData to remote adapters.
 * Values with `toJSON` (Date, Buffer, Luxon, Decimal, URL) are converted first, as JSON.stringify would,
 * and typed arrays are kept as they are. Shared references reuse one masked copy; only real cycles
 * become "[Circular]".
 */
export const maskSensitiveData = (
  value: any,
  masking?: SensitiveKeyMasking,
  inProgress: WeakSet<object> = new WeakSet(),
  done: WeakMap<object, any> = new WeakMap(),
): any => {
  if (value === null || typeof value !== "object") return value
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value
  if (done.has(value)) return done.get(value)
  if (inProgress.has(value)) return "[Circular]"

  // A throwing toJSON, getter or proxy must not drop the whole log event
  inProgress.add(value)
  let masked: any
  try {
    const json = typeof value.toJSON === "function" ? value.toJSON() : value
    if (json !== value) {
      masked = maskSensitiveData(json, masking, inProgress, done)
    } else if (Array.isArray(value)) {
      masked = value.map((item) => maskSensitiveData(item, masking, inProgress, done))
    } else {
      masked = {}
      for (const key of Object.keys(value)) {
        if (isSensitiveKey(key, masking)) {
          masked[key] = "[MASKED]"
          continue
        }
        try {
          masked[key] = maskSensitiveData(value[key], masking, inProgress, done)
        } catch {
          masked[key] = "[Error accessing property]"
        }
      }
    }
  } catch {
    masked = "[Unserializable value]"
  }
  inProgress.delete(value)
  done.set(value, masked)
  return masked
}

/**
 * Create a safe but detailed summary of an object for logging
 * @param obj - Object to summarize
 * @param label - Optional label for the object
 * @returns Detailed string representation
 */
export const createDetailedObjectSummary = (obj: any, label?: string, masking?: SensitiveKeyMasking): string => {
  const prefix = label ? `${label}: ` : ""

  try {
    return `${prefix}${serializeObjectDetailed(obj, 0, new WeakSet(), masking)}`
  } catch (error) {
    return `${prefix}[Error serializing object: ${error}]`
  }
}

/**
 * Enhanced response summary that shows more details
 * @param response - Response object to summarize
 * @param masking - Optional masking rules for header and property names
 * @returns Detailed string representation of response
 */
export const createEnhancedResponseSummary = (response: any, masking?: SensitiveKeyMasking): string => {
  if (!response || typeof response !== "object") {
    return "No response"
  }

  const details: string[] = []

  // Basic response info
  if (response.status !== undefined) details.push(`status: ${response.status}`)
  if (response.statusText !== undefined) details.push(`statusText: "${response.statusText}"`)
  if (response.ok !== undefined) details.push(`ok: ${response.ok}`)
  if (response.url) details.push(`url: "${response.url}"`)
  if (response.type) details.push(`type: "${response.type}"`)

  // Headers (show count and some safe headers)
  if (response.headers) {
    if (typeof response.headers === "object") {
      const headerKeys = Object.keys(response.headers)
      const safeHeaders = headerKeys
        .filter((key) => !isSensitiveKey(key, masking) && !key.toLowerCase().includes("authorization"))
        .slice(0, 3)

      if (safeHeaders.length > 0) {
        const headerSummary = safeHeaders.map((key) => `${key}: "${response.headers[key]}"`).join(", ")
        details.push(`headers: {${headerSummary}${headerKeys.length > safeHeaders.length ? ", ..." : ""}}`)
      } else {
        details.push(`headers: {${headerKeys.length} headers (sensitive)}`)
      }
    } else {
      details.push(`headers: [${typeof response.headers}]`)
    }
  }

  // Body info (if available and safe)
  if (response.bodyUsed !== undefined) details.push(`bodyUsed: ${response.bodyUsed}`)

  // Other safe properties
  const otherKeys = Object.keys(response).filter(
    (key) => !["status", "statusText", "ok", "url", "type", "headers", "bodyUsed"].includes(key) && !isSensitiveKey(key, masking),
  )

  for (const key of otherKeys.slice(0, 5)) {
    const value = response[key]
    if (typeof value === "object" && value !== null) {
      details.push(`${key}: {${Object.keys(value).length} keys}`)
    } else if (typeof value === "string" && value.length > 50) {
      details.push(`${key}: "${value.substring(0, 47)}..."`)
    } else {
      details.push(`${key}: ${JSON.stringify(value)}`)
    }
  }

  return details.join(", ")
}

/**
 * JSON.stringify that never throws: BigInt values become strings, circular references become "[Circular]"
 * (shared non-circular references are kept), objects past the first 10000 become "[Truncated]", and anything
 * else unserializable returns a placeholder
 * @param value - Value to serialize
 * @param space - Optional indentation, as in JSON.stringify
 * @returns JSON string, "undefined" for undefined, or "[Unserializable value]" (functions, symbols, errors)
 */
export const safeStringify = (value: any, space?: number): string => {
  const ancestors: object[] = []
  let objectCount = 0
  try {
    const json = JSON.stringify(
      value,
      function (this: any, _key, val) {
        if (typeof val === "bigint") return val.toString()
        if (typeof val === "object" && val !== null) {
          // Track the current path only: pop back to this value's parent before checking
          while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop()
          if (ancestors.includes(val)) return "[Circular]"
          if (++objectCount > MAX_STRINGIFY_OBJECTS) return "[Truncated]"
          ancestors.push(val)
        }
        return val
      },
      space,
    )
    // JSON.stringify returns undefined for undefined, functions and symbols; never fall back to a function's source
    if (json !== undefined) return json
    return value === undefined ? "undefined" : "[Unserializable value]"
  } catch {
    return "[Unserializable value]"
  }
}
