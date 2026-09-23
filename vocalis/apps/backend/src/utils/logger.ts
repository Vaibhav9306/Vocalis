export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  info(message: string, metadata?: Record<string, unknown>, context?: string): void {
    const entry: LogEntry = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
    };
    console.log(this.formatLog(entry));
  }

  warn(message: string, metadata?: Record<string, unknown>, context?: string): void {
    const entry: LogEntry = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
    };
    console.warn(this.formatLog(entry));
  }

  error(message: string, error?: unknown, context?: string): void {
    const metadata: Record<string, unknown> = {};
    if (error instanceof Error) {
      metadata.errorName = error.name;
      metadata.errorMessage = error.message;
      metadata.stack = error.stack;
    } else if (error) {
      metadata.rawError = error;
    }

    const entry: LogEntry = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
    };
    console.error(this.formatLog(entry));
  }

  debug(message: string, metadata?: Record<string, unknown>, context?: string): void {
    if (process.env.NODE_ENV === 'development') {
      const entry: LogEntry = {
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        context,
        metadata,
      };
      console.debug(this.formatLog(entry));
    }
  }
}

export const logger = new Logger();
