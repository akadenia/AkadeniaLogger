// Type-checked by __tests__/adapter_types.test.ts: custom adapters written against earlier releases must still compile
import { ILogger, Logger, Options, Severity } from "../../src/logger"

class BaseAdapter {
  name = "custom"
  minimumLogLevel = Severity.Debug
  trace(_message: string, _options?: Options): void {}
  debug(_message: string, _options?: Options): void {}
  info(_message: string, _options?: Options): void {}
  warn(_message: string, _options?: Options): void {}
  error(_message: string, _options?: Options): void {}
  exception(_message: string, _exception: Error, _options?: Options): void {}
}

class NoFlushAdapter extends BaseAdapter implements ILogger {}

class SyncFlushAdapter extends BaseAdapter implements ILogger {
  flush(_duration: number): void {}
}

class AsyncVoidFlushAdapter extends BaseAdapter implements ILogger {
  async flush(_duration: number): Promise<void> {}
}

class AsyncBooleanFlushAdapter extends BaseAdapter implements ILogger {
  async flush(_duration: number): Promise<boolean> {
    return true
  }
}

const logger = new Logger()
logger.addLogger(new NoFlushAdapter())
logger.addLogger(new SyncFlushAdapter())
logger.addLogger(new AsyncVoidFlushAdapter())
logger.addLogger(new AsyncBooleanFlushAdapter())

const flushed: Promise<boolean> = logger.flush(100)
export { flushed }
