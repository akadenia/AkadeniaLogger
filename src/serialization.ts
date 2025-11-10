// Enhanced object serialization for better logging visibility
// Provides detailed object inspection while maintaining security

const SENSITIVE_KEY_PATTERNS = /^(header|auth|token|password|secret|key|credential|session|cookie|sig|csrf)/i
const MAX_DEPTH = 3
const MAX_STRING_LENGTH = 200
const MAX_ARRAY_ITEMS = 5

/**
 * Enhanced object serialization that shows more details than the basic "[object with X keys]"
 * @param obj - Object to serialize
 * @param depth - Current recursion depth (internal use)
 * @param visited - Set of visited objects to prevent circular references
 * @returns Detailed string representation of the object
 */
export const serializeObjectDetailed = (obj: any, depth: number = 0, visited: WeakSet<object> = new WeakSet()): string => {
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
      .map((item) => (depth < MAX_DEPTH ? serializeObjectDetailed(item, depth + 1, visited) : "[...]"))

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
      if (SENSITIVE_KEY_PATTERNS.test(key)) {
        entries.push(`${key}: [MASKED]`)
        continue
      }

      // Serialize the value
      const serializedValue = serializeObjectDetailed(value, depth + 1, visited)
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
 * Create a safe but detailed summary of an object for logging
 * @param obj - Object to summarize
 * @param label - Optional label for the object
 * @returns Detailed string representation
 */
export const createDetailedObjectSummary = (obj: any, label?: string): string => {
  const prefix = label ? `${label}: ` : ""

  try {
    return `${prefix}${serializeObjectDetailed(obj)}`
  } catch (error) {
    return `${prefix}[Error serializing object: ${error}]`
  }
}

/**
 * Enhanced response summary that shows more details
 * @param response - Response object to summarize
 * @returns Detailed string representation of response
 */
export const createEnhancedResponseSummary = (response: any): string => {
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
        .filter((key) => !SENSITIVE_KEY_PATTERNS.test(key) && !key.toLowerCase().includes("authorization"))
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
    (key) =>
      !["status", "statusText", "ok", "url", "type", "headers", "bodyUsed"].includes(key) && !SENSITIVE_KEY_PATTERNS.test(key),
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
