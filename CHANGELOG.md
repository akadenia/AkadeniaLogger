## [1.7.2](https://github.com/akadenia/AkadeniaLogger/compare/1.7.1...1.7.2) (2024-11-08)


### Bug Fixes

* **azure-func-adapter:** fix azure functions context severities ([b11d9aa](https://github.com/akadenia/AkadeniaLogger/commit/b11d9aa8f43fa638eea649ce8ff0161080a6c155))

## [1.7.1](https://github.com/akadenia/AkadeniaLogger/compare/1.7.0...1.7.1) (2024-11-08)


### Bug Fixes

* **azure-functions-adapter:** export adapter ([7faf8fe](https://github.com/akadenia/AkadeniaLogger/commit/7faf8fee7e3168c5588826069e55d54f60fa0339))

# [1.7.0](https://github.com/akadenia/AkadeniaLogger/compare/1.6.1...1.7.0) (2024-11-08)


### Features

* **azure-functions-adapter:** implement azure functions context logger as an adapter ([#29](https://github.com/akadenia/AkadeniaLogger/issues/29)) ([77c3f5d](https://github.com/akadenia/AkadeniaLogger/commit/77c3f5d9807ff6f98774a32ec706bb068ef52fb5))

## [1.6.1](https://github.com/akadenia/AkadeniaLogger/compare/1.6.0...1.6.1) (2024-10-03)


### Bug Fixes

* **npm:** update homepage and upgrade packages ([5d67aee](https://github.com/akadenia/AkadeniaLogger/commit/5d67aeeebc965f32892856b404e12693100d0ccd))

# [1.6.0](https://github.com/akadenia/AkadeniaLogger/compare/1.5.2...1.6.0) (2024-10-01)


### Features

* **config:** refactor config file and logger constructor ([#26](https://github.com/akadenia/AkadeniaLogger/issues/26)) ([2348566](https://github.com/akadenia/AkadeniaLogger/commit/234856671d129f573e42d68402e32399d1af6cb9))

## [1.5.2](https://github.com/akadenia/AkadeniaLogger/compare/1.5.1...1.5.2) (2024-09-12)


### Bug Fixes

* **sentry-types:** make @sentry/types a dependency ([599138c](https://github.com/akadenia/AkadeniaLogger/commit/599138cf79d5ecc71b895c5757b71dc281e2e454))

## [1.5.1](https://github.com/akadenia/AkadeniaLogger/compare/1.5.0...1.5.1) (2024-09-11)


### Bug Fixes

* **npm:** upgrade akadenia api to fix vulnerable dependencies ([#20](https://github.com/akadenia/AkadeniaLogger/issues/20)) ([7dec9a4](https://github.com/akadenia/AkadeniaLogger/commit/7dec9a4ca5919448922e2f1157cd3432b5b5d63f))

# [1.5.0](https://github.com/akadenia/AkadeniaLogger/compare/1.4.0...1.5.0) (2024-09-11)


### Features

* **minimun-log-level:** ability to have different minimum log level per adapter ([#21](https://github.com/akadenia/AkadeniaLogger/issues/21)) ([1648cf7](https://github.com/akadenia/AkadeniaLogger/commit/1648cf7b730bf5d4881edaf220e446c8987014c3))

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
