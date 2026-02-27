<div align="center">
  <img src="https://cdn.akadenia.com/images/akadenia-webp/logo/horizontal-logo.svg" alt="Akadenia" width="200" />

  ## @akadenia/logger

  <img src="https://cdn.akadenia.com/images/badges/npm-version-logger.svg" alt="npm version" />
  <img src="https://cdn.akadenia.com/images/badges/license-mit.svg" alt="License: MIT" />
  <img src="https://cdn.akadenia.com/images/badges/typescript.svg" alt="TypeScript" />

  A structured TypeScript logging library built for multi-adapter workflows. Wire up Sentry, SignOz, Firebase, or Azure Functions — or just console — through a single unified interface. Adapter errors never crash your app.

  [Documentation](https://akadenia.com/packages/akadenia-logger) · [GitHub](https://github.com/akadenia/AkadeniaLogger) · [Issues](https://github.com/akadenia/AkadeniaLogger/issues)
</div>

---

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

logger.info("Server started")
logger.warn("High memory usage", { extraData: { memoryMB: 512 } })
logger.error("Payment failed", { extraData: { orderId: "ORD-123" } })
logger.exception("Unhandled crash", new Error("null reference"), { extraData: { userId: "u42" } })
```

---

## Severity Levels

| Level | Value | Usage |
|---|---|---|
| `Severity.Trace` | 1 | Fine-grained diagnostic info |
| `Severity.Debug` | 2 | Development debugging |
| `Severity.Info` | 3 | Operational events |
| `Severity.Warn` | 4 | Unexpected but recoverable situations |
| `Severity.Error` | 5 | Failures that need attention |

---

## Adapters

Add one or more adapters to fan out logs to external services. Adapter errors are silently absorbed — a broken Sentry integration won't take down your app.

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

> The Sentry adapter handles Sentry's 16KB payload limit automatically — it truncates `response.data` first, then the full payload if needed. Sensitive keys (auth, token, password, secret, etc.) are masked.

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
  },
})
```

### Firebase (Crashlytics + Analytics)

```typescript
import { FirebaseAdapter, Severity } from "@akadenia/logger"
import crashlytics from "@react-native-firebase/crashlytics"
import analytics from "@react-native-firebase/analytics"

const firebaseAdapter = new FirebaseAdapter(crashlytics, analytics, Severity.Info, true)
logger.addLogger(firebaseAdapter)
```

### Azure Functions

```typescript
import { AzureFunctionsAdapter, Severity } from "@akadenia/logger"

// Inside your Azure Function handler:
const azureAdapter = new AzureFunctionsAdapter(context, Severity.Debug)
logger.addLogger(azureAdapter)
```

---

## Logging Options

All log methods accept an optional `Options` object:

```typescript
type Options = {
  extraData?: any                    // Attached as structured metadata
  response?: AkadeniaApiResponse     // API response (trimmed before sending to adapters)
  exception?: Error                  // Used by exception() and Sentry fatal captures
  forceConsole?: boolean             // Override consoleEnabled for this call
  signozPayload?: {                  // SignOz-specific OTLP fields
    trace_id?: string
    span_id?: string
    trace_flags?: number
    severity_number?: number
    resources?: Record<string, any>
    attributes?: Record<string, any>
  }
}
```

---

## Predefined Events

For analytics-style events (Login, Share, AppOpen, Search):

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

> Predefined events are routed to adapters that implement `predefinedEvent()` (e.g., FirebaseAdapter). Other adapters ignore them.

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

## Log Message Sanitization

All messages are automatically sanitized before being sent to adapters — newlines, tabs, carriage returns, and non-printable characters are stripped to prevent log injection attacks.

---

## Requirements

- Node.js >= 22 (runtime)
- Node.js >= 20 (consumer)

## License

[MIT](LICENSE)
