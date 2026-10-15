/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // Fixtures are compiled by tests, not run as test files
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/fixtures/"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest"],
  },
}
