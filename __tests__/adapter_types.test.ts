import { describe, expect, it } from "@jest/globals"
import path from "path"
import ts from "typescript"

// ts-jest only transpiles, so compile the consumer fixture with the real type checker
describe("ILogger compatibility", () => {
  it("accepts custom adapters with no flush, sync flush, Promise<void> flush and Promise<boolean> flush", () => {
    const fixture = path.join(__dirname, "fixtures", "custom_adapters.ts")
    const program = ts.createProgram([fixture], {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      skipLibCheck: true,
      types: ["node"],
    })

    const errors = ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))

    expect(errors).toEqual([])
  }, 30000)
})
