<div align="center">
  <img src="https://cdn.akadenia.com/images/akadenia-webp/logo/horizontal-logo.svg" alt="Akadenia" width="200" />
  
  ## @akadenia/logger
  
  <img src="https://cdn.akadenia.com/images/badges/npm-version-logger.svg" alt="npm version" />
  <img src="https://cdn.akadenia.com/images/badges/license-mit.svg" alt="License: MIT" />
  <img src="https://cdn.akadenia.com/images/badges/typescript.svg" alt="TypeScript" />
  
  A structured TypeScript logging library built for multi-adapter workflows. Wire up Sentry, SignOz, Firebase, or Azure Functions — or just console — through a single unified interface. Adapter errors never crash your app.

  [Documentation](https://akadenia.com/packages/akadenia-logger) · [GitHub](https://github.com/akadenia/AkadeniaLogger) · [Issues](https://github.com/akadenia/AkadeniaLogger/issues)
</div>

## Features

- **Multiple Logging Levels**: Trace, Debug, Info, Warn, Error with configurable minimum levels per adapter
- **Extensible Adapter System**: Plug in any logging backend — Sentry, SignOz, Firebase, Azure Functions, or your own
- **Built-in Console Logging**: Configurable console output with level filtering
- **Predefined Events**: Common analytics scenarios like Login, Share, AppOpen, Search
- **Exception Handling**: Automatic stack trace capture and error logging
- **Metadata Support**: Rich context via `extraData`, `response`, and `signozPayload`
- **Log Sanitization**: Newlines, tabs, and non-printable characters are stripped before sending to adapters to prevent log injection
- **Resilient Adapters**: Adapter errors are silently absorbed — a broken integration won't crash your app
- **TypeScript Support**: Full type definitions and type safety

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Logging Levels](#logging-levels)
- [Predefined Events](#predefined-events)
- [Adapters](#adapters)
- [Custom Adapter](#custom-adapter)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install @akadenia/logger
```

## Quick Start

```typescript
import { Logger, Severity } from "@akadenia/logger"

const logger = new Logger({
  consoleEnabled: true,
  consoleMinimumLogLevel: Severity.Info,
})

// Basic logging
logger.info("Application started")
logger.warn("High memory usage", { extraData: { memoryMB: 512 } })
logger.error("Payment failed", { extraData: { orderId: "ORD-123" } })

// With API response context
logger.error("Failed to fetch data", {
  extraData: {
    userId: "1234",
    response: {
      status: 500,
      statusText: "Internal Server Error",
      message: "Server error",
      data: { errorCode: "ERR_500" },
    },
  },
})

// Exception logging
try {
  // ...
} catch (error) {
  logger.exception("Failed to process request", error as Error, {
    extraData: { userId: "u42" }
  })
}
```

---

## Configuration

```typescript
type Config = {
  consoleEnabled?: boolean           // Enable/disable console logging
  consoleMinimumLogLevel?: Severity  // Minimum level for console output
}
```

---

## Logging Levels

Severity levels in ascending order:

| Level | Value | Usage |
|---|---|---|
| `Severity.Trace` | 1 | Fine-grained diagnostic info |
| `Severity.Debug` | 2 | Development debugging |
| `Severity.Info` | 3 | Operational events |
| `Severity.Warn` | 4 | Unexpected but recoverable situations |
| `Severity.Error` | 5 | Failures that need attention |

Each adapter has its own `minimumLogLevel` — messages below the threshold are silently skipped.

---

## Logging Options

All log methods accept an optional `Options` object:

```typescript
type Options = {
  extraData?: any                     // Structured metadata attached to the log
  response?: AkadeniaApiResponse      // API response (trimmed before sending to adapters)
  exception?: Error                   // Error object for exception/fatal captures
  forceConsole?: boolean              // Override consoleEnabled for this call
  signozPayload?: any                 // SignOz-specific OTLP fields (trace_id, span_id, resources, attributes, etc.)
}
```

---

## Predefined Events

For analytics-style events:

```typescript
enum PredefinedLogEvents {
  Login   = "LOGIN",
  Share   = "SHARE",
  AppOpen = "APP_OPEN",
  Search  = "SEARCH",
}
```

```typescript
logger.predefinedEvent({ type: PredefinedLogEvents.Login })

logger.predefinedEvent({
  type: PredefinedLogEvents.Share,
  extraData: { contentType: "article", itemId: "post-1", method: "link" },
})

logger.predefinedEvent({
  type: PredefinedLogEvents.Search,
  extraData: { searchTerm: "typescript logging" },
})

logger.predefinedEvent({ type: PredefinedLogEvents.AppOpen })
```

> Predefined events are routed to adapters that implement `predefinedEvent()` (e.g. FirebaseAdapter). Other adapters ignore them gracefully.

---

## Adapters

Add one or more adapters to fan out logs to external services:

```typescript
logger.addLogger(adapter)
```

### Sentry

```typescript
import * as Sentry from "@sentry/node"
import { SentryAdapter, Severity } from "@akadenia/logger"

Sentry.init({ dsn: "https://..." })

const sentryAdapter = new SentryAdapter(Sentry, Severity.Warn)
logger.addLogger(sentryAdapter)
```

> The Sentry adapter automatically handles Sentry's 16KB payload limit — it truncates `response.data` first, then the full payload if needed. Sensitive keys (`auth`, `token`, `password`, `secret`, etc.) are masked before sending.

### SignOz (OpenTelemetry)

```typescript
import { SignozAdapter, Severity } from "@akadenia/logger"

const signozAdapter = new SignozAdapter("https://ingest.signoz.io/logs", Severity.Info)
logger.addLogger(signozAdapter)

// With trace context
logger.info("Request processed", {
  extraData: { userId: "u42" },
  signozPayload: {
    trace_id: "abc123",
    span_id: "def456",
    resources: { service: "api-server", env: "production" },
    attributes: { "http.method": "GET", "http.route": "/users" },
  },
})
```

### Azure Functions

```typescript
import { AzureFunctionsAdapter, Severity } from "@akadenia/logger"

// Inside your Azure Function handler:
const azureAdapter = new AzureFunctionsAdapter(context, Severity.Debug)
logger.addLogger(azureAdapter)
```

### Firebase (Crashlytics + Analytics)

```typescript
import { FirebaseAdapter, Severity } from "@akadenia/logger"
import crashlytics from "@react-native-firebase/crashlytics"
import analytics from "@react-native-firebase/analytics"

const firebaseAdapter = new FirebaseAdapter(crashlytics, analytics, Severity.Info, true)
logger.addLogger(firebaseAdapter)
```

---

## Custom Adapter

Implement the `ILogger` interface to build your own:

```typescript
import { ILogger, Severity, Options } from "@akadenia/logger"

class MyAdapter implements ILogger {
  name = "my-adapter"
  minimumLogLevel = Severity.Info

  trace(message: string, options?: Options) {}
  debug(message: string, options?: Options) {}
  info(message: string, options?: Options) { console.log("[INFO]", message) }
  warn(message: string, options?: Options) { console.warn("[WARN]", message) }
  error(message: string, options?: Options) { console.error("[ERROR]", message) }
  exception(message: string, exception: Error, options?: Options) {
    console.error("[EXCEPTION]", message, exception)
  }
}

logger.addLogger(new MyAdapter())
```

---

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Formatting

```bash
npm run format
```

### Linting

```bash
npm run lint
```

---

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

### Development Setup

```bash
git clone https://github.com/akadenia/AkadeniaLogger.git
cd AkadeniaLogger
npm install
npm run build
npm test
```

### Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/). Scope is required.

```text
type(scope): description
```

**Common scopes:** `logger` · `adapters` · `events` · `docs` · `deps` · `test` · `build` · `ci`

**Types:** `feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore`

## Requirements

- Node.js >= 22 (runtime)
- Node.js >= 20 (consumer)

## License

[MIT](https://github.com/akadenia/AkadeniaLogger/blob/main/LICENSE)

## Support

For support, please open an issue on [GitHub](https://github.com/akadenia/AkadeniaLogger/issues).
