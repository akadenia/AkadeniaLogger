import { describe, expect, it } from "@jest/globals"
import {
  createDetailedObjectSummary,
  createEnhancedResponseSummary,
  safeStringify,
  serializeObjectDetailed,
} from "../src/serialization"

describe("serializeObjectDetailed", () => {
  it("should serialize shared references that are not circular", () => {
    const shared = { n: 1 }

    expect(serializeObjectDetailed({ a: shared, b: shared })).toBe("{a: {n: 1}, b: {n: 1}}")
    expect(serializeObjectDetailed([shared, shared])).toBe("[{n: 1}, {n: 1}]")
  })

  it("should still detect circular references", () => {
    const circular: any = { name: "loop" }
    circular.self = circular
    const list: any[] = [1]
    list.push(list)

    expect(serializeObjectDetailed(circular)).toBe('{name: "loop", self: [Circular Reference]}')
    expect(serializeObjectDetailed(list)).toBe("[1, [Circular Reference]]")
  })

  it("should serialize dates and errors", () => {
    expect(serializeObjectDetailed(new Date("2026-01-01T00:00:00.000Z"))).toBe("Date(2026-01-01T00:00:00.000Z)")
    expect(createDetailedObjectSummary(new TypeError("bad"), "exception")).toBe("exception: Error(TypeError: bad)")
  })
})

describe("safeStringify", () => {
  it("should replace circular references", () => {
    const obj: any = { name: "Test" }
    obj.self = obj

    expect(safeStringify(obj, 2)).toBe('{\n  "name": "Test",\n  "self": "[Circular]"\n}')
  })

  it("should keep shared references that are not circular", () => {
    const shared = { id: 1 }

    expect(JSON.parse(safeStringify({ a: shared, b: [shared], c: { d: shared } }))).toEqual({
      a: { id: 1 },
      b: [{ id: 1 }],
      c: { d: { id: 1 } },
    })
  })

  it("should convert BigInt values to strings", () => {
    expect(safeStringify({ id: BigInt("1234567890123456789") })).toBe('{"id":"1234567890123456789"}')
  })

  it("should fall back to String() for values JSON cannot represent", () => {
    expect(safeStringify(undefined)).toBe("undefined")
  })

  it("should return a placeholder when serialization throws", () => {
    const value = {
      toJSON() {
        throw new Error("boom")
      },
    }

    expect(safeStringify(value)).toBe("[Unserializable value]")
  })

  it("should not output a function's source", () => {
    expect(safeStringify(() => "secret")).toBe("[Unserializable value]")
    expect(safeStringify({ callback: () => "secret" })).toBe("{}")
  })

  it("should stay bounded on heavily shared object graphs", () => {
    let node: any = { leaf: true }
    for (let i = 0; i < 40; i++) node = { l: node, r: node }

    const start = Date.now()
    const result = safeStringify(node)

    expect(Date.now() - start).toBeLessThan(2000)
    expect(result).toContain('"[Truncated]"')
  })
})

describe("createEnhancedResponseSummary", () => {
  it("should not throw on BigInt values", () => {
    expect(createEnhancedResponseSummary({ status: 200, size: BigInt(10) })).toBe('status: 200, size: "10"')
  })
})
