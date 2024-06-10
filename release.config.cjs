/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  branches: ["main"],
  tagFormat: "${version}",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    [
      "@semantic-release/exec",
      {
        successCmd: "chmod u+x ./scripts/commit-release-assets.sh && ./scripts/commit-release-assets.sh ${nextRelease.version}",
      },
    ],
  ],
}
