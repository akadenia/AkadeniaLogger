# MDX Documentation Rules

When working with README.MD files that will be converted to MDX:

## Heading Structure Rules
- **Only ONE H1 heading per document** - The main title should be the only H1
- **No H1 headings in examples or code blocks** - Use H2, H3, or regular text instead
- **Maintain proper heading hierarchy** - H1 → H2 → H3 → H4 (no skipping levels)
- **Convert H4 headings in examples to H3 or regular text** - MDX doesn't handle nested H4s well

## Specific Fixes for MDX Conversion
1. **Package title H1**: Keep only the main package title as H1 (e.g., `# @akadenia/logger`)
2. **Example headings**: Convert H1 headings in examples to H2 or regular text
3. **Code block headings**: Use H3 instead of H4 for headings within examples
4. **Commit message examples**: Convert H1 headings in commit examples to H2 or regular text

## Examples to Fix
- Convert `# ✅ Preferred - with scope` to `## ✅ Preferred - with scope`
- Convert `# ❌ Less preferred - without scope` to `## ❌ Less preferred - without scope`
- Convert `#### Preferred Format` to `### Preferred Format`
- Convert `#### Examples` to `### Examples`
- Convert `#### Common Scopes` to `### Common Scopes`
- Convert `#### Commit Types` to `### Commit Types`

## Code Block Rules
- Use proper TypeScript syntax highlighting for code examples
- Ensure all examples are properly formatted and executable
- Use consistent indentation and formatting

## Documentation Standards
- Maintain comprehensive documentation with examples
- Keep the professional Akadenia branding and formatting
- Ensure all code examples are type-safe and follow best practices
- Use proper markdown formatting for better MDX conversion
