
interface LogLevel {
  ERROR: number;
  WARN: number;
  INFO: number;
  DEBUG: number;
}

const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  private currentLevel: number;

  constructor() {
    // Em produção, usar apenas ERROR e WARN
    this.currentLevel = process.env.NODE_ENV === 'production' 
      ? LOG_LEVELS.WARN 
      : LOG_LEVELS.DEBUG;
  }

  private log(level: number, prefix: string, ...args: any[]) {
    if (level <= this.currentLevel) {
      console.log(`${prefix}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.ERROR, '❌ [ERROR]', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.WARN, '⚠️ [WARN]', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.INFO, 'ℹ️ [INFO]', message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.DEBUG, '🔍 [DEBUG]', message, ...args);
  }
}

export const logger = new Logger();
