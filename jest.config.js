// const { defaults: tsjPreset } = require("ts-jest/presets")

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  transform: {
    "^.+\\.tsx?$": ["ts-jest"],
  },
}
