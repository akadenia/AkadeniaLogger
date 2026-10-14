import { describe, expect, it } from "@jest/globals"
import { createDetailedObjectSummary, serializeObjectDetailed } from "../src/serialization"

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
