export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  private serializeContext(context: any): string {
    if (!context) return '';
    
    // Handle Error objects specially
    if (context instanceof Error) {
      return JSON.stringify({
        name: context.name,
        message: context.message,
        stack: context.stack,
        ...(context as any) // Include any additional properties
      });
    }
    
    // Handle objects that might contain Error objects
    if (typeof context === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(context)) {
        if (value instanceof Error) {
          serialized[key] = {
            name: value.name,
            message: value.message,
            stack: value.stack,
            ...(value as any)
          };
        } else {
          serialized[key] = value;
        }
      }
      return JSON.stringify(serialized);
    }
    
    return JSON.stringify(context);
  }

  private log(level: LogLevel, message: string, context?: any): void {
    if (level <= this.level) {
      const entry: LogEntry = {
        level,
        message,
        timestamp: new Date(),
        context,
      };

      const levelName = LogLevel[level];
      const timestamp = entry.timestamp.toISOString();
      const contextStr = context ? ` ${this.serializeContext(context)}` : '';
      
      console.log(`[${timestamp}] ${levelName}: ${message}${contextStr}`);
    }
  }
}

// Default logger instance
export const logger = new Logger(
  process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG :
  process.env.LOG_LEVEL === 'warn' ? LogLevel.WARN :
  process.env.LOG_LEVEL === 'error' ? LogLevel.ERROR :
  LogLevel.INFO
); 