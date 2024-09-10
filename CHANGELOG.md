# [1.4.0](https://github.com/akadenia/AkadeniaLogger/compare/1.3.0...1.4.0) (2024-09-10)


### Features

* **sentry,azure-functions:** add support for sentry types and trace ([#17](https://github.com/akadenia/AkadeniaLogger/issues/17)) ([f55a8b4](https://github.com/akadenia/AkadeniaLogger/commit/f55a8b49f1c022da4fd67f4447127bbf4d93dcf4))

# [1.3.0](https://github.com/akadenia/AkadeniaLogger/compare/1.2.1...1.3.0) (2024-07-30)


### Features

* **node:** bump to node 20 ([#15](https://github.com/akadenia/AkadeniaLogger/issues/15)) ([e7e2eda](https://github.com/akadenia/AkadeniaLogger/commit/e7e2eda52d4529f921fa726ab5b5ffad74bd7737))

## [1.2.1](https://github.com/akadenia/AkadeniaLogger/compare/1.2.0...1.2.1) (2024-07-01)


### Bug Fixes

* **console-log:** exclude extraData from console log if extraData is not defined ([#13](https://github.com/akadenia/AkadeniaLogger/issues/13)) ([494281a](https://github.com/akadenia/AkadeniaLogger/commit/494281a1dad3ac359b18e78f1d1c29b494c4d4a4))

# [1.2.0](https://github.com/akadenia/AkadeniaLogger/compare/1.1.0...1.2.0) (2024-06-21)

### Features

* **core:** include extraData when logging to console ([#7](https://github.com/akadenia/AkadeniaLogger/issues/7)) ([41c4fb3](https://github.com/akadenia/AkadeniaLogger/commit/41c4fb3f0253dc492e8daa0092bccc79f3372686))

* **node-upgrade:** bump node to version 20 by @guy-shahine in ([#10](https://github.com/akadenia/AkadeniaLogger/issues/10))

# [1.1.0](https://github.com/akadenia/AkadeniaLogger/compare/1.0.1...1.1.0) (2024-06-20)

### Features

* **signoz:** implement signoz adapter by @guy-shahine in ([#9](https://github.com/akadenia/AkadeniaLogger/issues/9)) ([1b850c3](https://github.com/akadenia/AkadeniaLogger/commit/1b850c3fc70a25961347c4edb08616d4b6ef0141))

# [1.0.1](https://github.com/akadenia/AkadeniaLogger/compare/1.0.0...1.0.1) (2024-04-03)

### Features

* **semantic-release:** implement semantic release by @tsatsujnr139 in ([#8](https://github.com/akadenia/AkadeniaLogger/issues/8))

### Fixes

* **ci:** allow wild characters in PR title checker by @king-d-dev in ([#6](https://github.com/akadenia/AkadeniaLogger/issues/6))

# [1.0.0](https://github.com/akadenia/AkadeniaLogger/commits/v1.0.0) (2024-04-03)

### Features

* **core:** gracefully handle situations where a non Error instance is passed to sentry captureException by @king-d-dev in ([#3](https://github.com/akadenia/AkadeniaLogger/issues/3))
* **core:** setup firebase crashlytics adapter by @king-d-dev in ([#4](https://github.com/akadenia/AkadeniaLogger/issues/4))

### Fixes

* **core:** fix issue with logger not including extra data in sentry log by @king-d-dev in ([#2](https://github.com/akadenia/AkadeniaLogger/issues/2))
* **core:** fix import issue by @king-d-dev in ([#5](https://github.com/akadenia/AkadeniaLogger/issues/5))
