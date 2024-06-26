## Getting Started

* Create a `log.ts` file in your project
* here's a sample code

```
import * as Sentry from "@sentry/react-native"
import { Config, Logger, SentryLoggerAdapter, Severity } from "@akadenia/logger"
import { APP_ENV, SENTRY_DSN } from "react-native-dotenv"

class Log extends Logger {
  constructor(defaultConfig?: Config, minimumLogLevel?: Severity) {
    super(defaultConfig, minimumLogLevel)

    Sentry.init({
      dsn: SENTRY_DSN,
      enabled: APP_ENV === "prd",
    })

    this.addLogger(new SentryLoggerAdapter(Sentry))
  }
}

export default new Log(
  {
    console: true,
  },
  __DEV__ ? Severity.Debug : Severity.Error,
)
```

* Import the Log instance : `import Log from "<PATH to log.ts>"`
* Usage example: `Log.debug("Hello World")`