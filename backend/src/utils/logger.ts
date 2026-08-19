import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

// Garantir que a pasta de logs existe
const LOGS_DIR = path.join(process.cwd(), 'backend', 'src', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
    AUTH = 'AUTH',
    DB = 'DB'
}

class Logger {
    private getTimestamp() {
        return new Date().toISOString();
    }

    private formatMessage(level: LogLevel, tag: string, message: string, data?: any) {
        const timestamp = this.getTimestamp();
        let formatted = `[${timestamp}] [${level}] [${tag}] ${message}`;
        if (data) {
            try {
                const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
                formatted += `\nData: ${dataStr}`;
            } catch (e) {
                formatted += `\nData: [Unserializable Object]`;
            }
        }
        return formatted;
    }

    private async writeToFile(message: string) {
        const fileName = `${new Date().toISOString().split('T')[0]}.log`;
        const filePath = path.join(LOGS_DIR, fileName);
        fs.appendFile(filePath, message + '\n', (err) => {
            if (err) console.error('❌ [LOGGER] Erro ao escrever no arquivo:', err);
        });
    }

    public log(level: LogLevel, tag: string, message: string, data?: any) {
        const formatted = this.formatMessage(level, tag, message, data);
        
        // Console color based on level
        switch (level) {
            case LogLevel.ERROR: console.error(formatted); break;
            case LogLevel.WARN: console.warn(formatted); break;
            case LogLevel.AUTH: console.log(`\x1b[35m${formatted}\x1b[0m`); break; // Magenta
            case LogLevel.DB: console.log(`\x1b[36m${formatted}\x1b[0m`); break; // Cyan
            default: console.log(formatted);
        }

        this.writeToFile(formatted);
    }

    public info(tag: string, message: string, data?: any) { this.log(LogLevel.INFO, tag, message, data); }
    public warn(tag: string, message: string, data?: any) { this.log(LogLevel.WARN, tag, message, data); }
    public error(tag: string, message: string, data?: any) { this.log(LogLevel.ERROR, tag, message, data); }
    public debug(tag: string, message: string, data?: any) { this.log(LogLevel.DEBUG, tag, message, data); }
    public auth(tag: string, message: string, data?: any) { this.log(LogLevel.AUTH, tag, message, data); }
    public db(tag: string, message: string, data?: any) { this.log(LogLevel.DB, tag, message, data); }
}

export const logger = new Logger();

/**
 * Middleware para logar requisições HTTP
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.get('user-agent') || 'Unknown';

    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const tag = 'HTTP';
        const msg = `${method} ${url} ${status} - ${duration}ms - IP: ${ip} - UA: ${userAgent}`;
        
        if (status >= 500) {
            logger.error(tag, msg);
        } else if (status >= 400) {
            logger.warn(tag, msg);
        } else {
            logger.info(tag, msg);
        }
    });

    next();
}
