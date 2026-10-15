<div align="center">
  <img src="https://cdn.akadenia.com/images/akadenia-webp/logo/horizontal-logo.svg" alt="Akadenia" width="200" />
  
  ## @akadenia/logger
  
  <img src="https://cdn.akadenia.com/images/badges/npm-version-logger.svg" alt="npm version" />
  <img src="https://cdn.akadenia.com/images/badges/license-mit.svg" alt="License: MIT" />
  <img src="https://cdn.akadenia.com/images/badges/typescript.svg" alt="TypeScript" />
  
  A structured TypeScript logging library built for multi-adapter workflows. Wire up Sentry, SignOz, Firebase, or your own adapter — all through a single unified interface. Adapter errors never crash your app.

  [Documentation](https://akadenia.com/packages/akadenia-logger) · [GitHub](https://github.com/akadenia/AkadeniaLogger) · [Issues](https://github.com/akadenia/AkadeniaLogger/issues)
</div>

## Features

- **Multiple Logging Levels**: Trace, Debug, Info, Warn, Error with configurable minimum levels per adapter
- **Extensible Adapter System**: Plug in any logging backend — Sentry, SignOz, Firebase, or your own
- **Built-in Console Logging**: Configurable console output with level filtering
- **Predefined Events**: Common analytics scenarios like Login, Share, AppOpen, Search
- **Exception Handling**: Automatic stack trace capture and error logging
- **Metadata Support**: Rich context via `extraData`, `response`, `signozPayload`, and `attachments`
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
type SensitiveKeyMasking = {
  keys?: string[]     // Replace the default prefix list
  add?: string[]      // Extra prefixes to mask
  exclude?: string[]  // Drop a default prefix, or a specific key
}

type Config = {
  consoleEnabled?: boolean           // Enable/disable console logging
  consoleMinimumLogLevel?: Severity  // Minimum level for console output
  masking?: SensitiveKeyMasking      // Default extraData key masking for Sentry extra / extra-data.json
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
type Attachment = {
  filename: string
  data: string | Uint8Array | ArrayBuffer
  contentType?: string                // Optional MIME type (e.g. text/plain, image/png)
}

type Options = {
  extraData?: any                     // Structured metadata attached to the log
  response?: AkadeniaApiResponse      // API response (trimmed before sending to adapters)
  exception?: Error                   // Error object for exception/fatal captures
  forceConsole?: boolean              // Override consoleEnabled for this call
  signozPayload?: any                 // SignOz-specific OTLP fields (trace_id, span_id, resources, attributes, etc.)
  attachments?: Attachment[]          // Files attached to this log (filename, data, optional contentType)
  masking?: SensitiveKeyMasking       // Per-call masking; merged with Logger config
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

File attachments are part of the shared `Options` API — you attach files to a log, and each adapter decides what to do with them. Sentry uploads each file on the event. SignOz and Firebase ignore attachment bytes for now (the same `attachments` field is the extension point when those backends add file support).

```typescript
logger.exception("PDF export failed", error as Error, {
  extraData: { orderId: "ORD-123" },
  attachments: [
    {
      filename: "export-log.txt",
      data: "log content here",
      contentType: "text/plain",
    },
    {
      filename: "screenshot.png",
      data: pngBytes, // Uint8Array or ArrayBuffer
      contentType: "image/png",
    },
  ],
})

logger.error("Failed to process file", {
  attachments: [{ filename: "input.json", data: JSON.stringify(payload), contentType: "application/json" }],
})
```

> If combined `extraData` + `response` JSON is over 16KB (Sentry's extra-item limit), the full payload is attached as `extra-data.json`. Sentry extra keeps a searchable summary: a notice plus small top-level scalar fields and `response.status` / `statusText`. Auto-attachments over 5MB are stored as a valid JSON envelope (`{ "truncated": true, "data": "..." }`) so a huge dump cannot reject the event.

Sensitive keys are masked in Sentry extra and `extra-data.json`. The default prefixes are `header`, `auth`, `token`, `password`, `passwd`, `passphrase`, `secret`, `credential`, `session`, `cookie`, `signature`, `csrf`, `apikey`, `accesskey`, and `privatekey`, plus `sig`, `pin`, `otp` and `cvv` as whole words (`sig`, `x-sig`, `sigHash` and `pinCode`, but not `signal` or `pinned`). A prefix matches at the start of any word in the key, case-insensitively and ignoring separators, so `token` masks `accessToken` and `refresh_token`, and `apikey` masks `x-api-key`. A bare `key` is not masked, so `cacheKey` and `sortKey` stay visible; add it with `masking.add` if you need it. `exclude` also ignores case and separators, so `sessionId` covers `session_id`. Masking rules are read once per config object and cached, so pass a new object instead of changing one in place. Configure on the logger or per call:

```typescript
const logger = new Logger({
  masking: {
    add: ["ssn"],              // also mask ssn, ssnNumber, user_ssn, ...
    exclude: ["sessionId"],    // leave this exact key visible
  },
})

// Replace the default list for one call
logger.error("Login failed", {
  extraData: { token: "abc", password: "p" },
  masking: { keys: ["token"] },
})

// Drop a default prefix (session, sessionId, ...)
logger.error("Session expired", {
  extraData: { sessionId: "s-1" },
  masking: { exclude: ["session"] },
})
```

> Consumer `attachments` are sent as-is. Sentry enforces roughly 40MB compressed / 200MB uncompressed per event; oversized uploads are rejected with HTTP 413. Unlike auto-promoted extra data, user attachments are not truncated by this library — keep attachment sizes within Sentry's limits.

### SignOz (OpenTelemetry)

```typescript
import { SignozAdapter, Severity } from "@akadenia/logger"

const signozAdapter = new SignozAdapter("https://ingest.signoz.io/logs", Severity.Info, {
  headers: { "signoz-ingestion-key": process.env.SIGNOZ_INGESTION_KEY! }, // optional extra headers
  timeoutMs: 5000, // optional, defaults to 5000
})
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

// Before a short-lived process exits (CLI, serverless), wait for pending requests
await logger.flush(2000)
```

> `severityNumber` defaults to the OpenTelemetry value for the log level (trace 1, debug 5, info 9, warn 13, error 17, exception 21) unless `signozPayload.severity_number` is set.

### Firebase (Crashlytics + Analytics)

```typescript
import { FirebaseAdapter, Severity } from "@akadenia/logger"
import crashlytics from "@react-native-firebase/crashlytics"
import analytics from "@react-native-firebase/analytics"

const firebaseAdapter = new FirebaseAdapter(crashlytics, analytics, Severity.Info, true) // last arg: analytics collection, defaults to true
logger.addLogger(firebaseAdapter)
```

> Info and warn logs become Analytics events. Event and param names are made Firebase-safe (letters, digits and underscores, starting with a letter, max 40 chars); reserved names such as `error` or `session_start` and the `firebase_`/`google_`/`ga_` prefixes get an `e_` (events) or `p_` (params) prefix. `extraData` plus `response.status`/`statusText` are flattened into at most 25 event params (values up to 100 chars, functions skipped). Errors and exceptions go to Crashlytics with the same fields as string custom keys.

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
