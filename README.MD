<div align="center">
  <img src="https://cdn.akadenia.com/images/akadenia-webp/logo/horizontal-logo.svg" alt="Akadenia" width="200" style="filter: drop-shadow(0 0 1px rgba(0,0,0,1)) drop-shadow(0 0 1px rgba(255,255,255,1));" />
  
  # @akadenia/logger
  
  [![npm version](https://badge.fury.io/js/%40akadenia%2Flogger.svg)](https://badge.fury.io/js/%40akadenia%2Flogger)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
  
  A flexible and extensible logging library for TypeScript applications, part of the Akadenia ecosystem.
  
  [Documentation](https://akadenia.com/packages/akadenia-logger) • [GitHub](https://github.com/akadenia/AkadeniaLogger) • [Issues](https://github.com/akadenia/AkadeniaLogger/issues)
</div>

## Features

- **Multiple Logging Levels**: Trace, Debug, Info, Warn, Error with configurable minimum levels
- **Extensible Adapter System**: Support for different logging backends and services
- **Built-in Console Logging**: Configurable console output with level filtering
- **Predefined Events**: Common logging scenarios like Login, Share, AppOpen, Search
- **Exception Handling**: Automatic stack trace capture and error logging
- **Metadata Support**: Rich context with extra data and metadata
- **Multiple Adapters**: Built-in support for Sentry, SignOz, Azure Functions, and Firebase
- **TypeScript Support**: Full type definitions and type safety

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Logging Levels](#logging-levels)
- [Predefined Events](#predefined-events)
- [Adapters](#adapters)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install @akadenia/logger
```

## Quick Start

```typescript
import { Logger, Severity } from '@akadenia/logger';

// Create a logger instance
const logger = new Logger({
  consoleEnabled: true,
  consoleMinimumLogLevel: Severity.Info
});

// Basic logging
logger.info('Application started');
logger.error('An error occurred');

// Logging with extra data
logger.debug('User action', { extraData: { userId: '123', action: 'click' } });

// Exception logging
try {
  // Some code that might throw
} catch (error) {
  logger.exception('Failed to process request', error as Error);
}
```

## Configuration

The logger can be configured with the following options:

```typescript
type Config = {
  consoleEnabled?: boolean;      // Enable/disable console logging
  consoleMinimumLogLevel?: Severity;  // Minimum level for console output
}
```

## Logging Levels

The logger supports the following severity levels (in ascending order):

1. `Trace` - Most detailed logging
2. `Debug` - Detailed information for debugging
3. `Info` - General information about application flow
4. `Warn` - Warning messages for potential issues
5. `Error` - Error messages for actual problems

## Predefined Events

The logger includes predefined events for common scenarios:

```typescript
enum PredefinedLogEvents {
  Login = "LOGIN",
  Share = "SHARE",
  AppOpen = "APP_OPEN",
  Search = "SEARCH"
}
```

Example usage:
```typescript
logger.predefinedEvent({
  type: PredefinedLogEvents.Login,
  extraData: { userId: '123' }
});

logger.predefinedEvent({
  type: PredefinedLogEvents.Search,
  extraData: { searchTerm: 'query' }
});
```

## Adapters

### Sentry Adapter
For error tracking and monitoring:
```typescript
import { SentryAdapter } from '@akadenia/logger/adapters';

const sentryAdapter = new SentryAdapter({
  dsn: 'your-sentry-dsn'
});
logger.addLogger(sentryAdapter);
```

### SignOz Adapter
For application monitoring:
```typescript
import { SignOzAdapter } from '@akadenia/logger/adapters';

const signOzAdapter = new SignOzAdapter({
  // SignOz configuration
});
logger.addLogger(signOzAdapter);
```

### Azure Functions Adapter
For Azure Functions logging:
```typescript
import { AzureFunctionsAdapter } from '@akadenia/logger/adapters';

const azureAdapter = new AzureFunctionsAdapter(context);
logger.addLogger(azureAdapter);
```

### Firebase Adapter
For Firebase logging:
```typescript
import { FirebaseAdapter } from '@akadenia/logger/adapters';

const firebaseAdapter = new FirebaseAdapter({
  // Firebase configuration
});
logger.addLogger(firebaseAdapter);
```

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

## License

MIT

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

We follow [Conventional Commits](https://www.conventionalcommits.org/) for our semantic release process. **We prefer commit messages to include a scope in parentheses** for better categorization and changelog generation.

### Preferred Format
```
type(scope): description

[optional body]

[optional footer]
```

### Examples
```bash
## ✅ Preferred - with scope
feat(adapters): add new Sentry adapter configuration
fix(logger): resolve exception handling issue
docs(readme): add troubleshooting section
chore(deps): update dependencies

## ❌ Less preferred - without scope
feat: add new Sentry adapter configuration
fix: resolve exception handling issue
docs: add troubleshooting section
chore: update dependencies
```

### Common Scopes
- `logger` - Core logger functionality
- `adapters` - Adapter implementations
- `events` - Predefined event handling
- `docs` - Documentation updates
- `deps` - Dependency updates
- `test` - Test-related changes
- `build` - Build and build tooling
- `ci` - CI/CD configuration

### Commit Types
- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

## License

[MIT](https://github.com/akadenia/AkadeniaLogger/blob/main/LICENSE)

## Support

For support, please open an issue on [GitHub](https://github.com/akadenia/AkadeniaLogger/issues).