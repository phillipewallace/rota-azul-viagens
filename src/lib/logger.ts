import { API_BASE_URL } from "@/services/config";

/**
 * Logger estruturado leve para frontend.
 * Saída em JSON no console e opcionalmente enviada para o servidor.
 */
type Level = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const isDev = import.meta.env.DEV;

async function emit(level: Level, message: string, context?: LogContext) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ?? {}),
  };

  // 1. Console Log
  if (isDev) {
    const fn =
      level === "error" ? console.error
      : level === "warn" ? console.warn
      : level === "debug" ? console.debug
      : console.info;
    fn(`[${level.toUpperCase()}] ${message}`, context ?? "");
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }

  // 2. Enviar para o servidor se for erro crítico ou se estiver no app de funcionários
  // (Poderia ser condicional, mas para rastrear "C.filter" vamos enviar erros)
  if (level === "error" || level === "warn") {
    try {
      fetch(`${API_BASE_URL}/logs/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.toUpperCase(), message, context }),
        keepalive: true // Garante o envio mesmo se a página fechar
      }).catch(() => {}); // Silent catch
    } catch (e) {}
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};


/**
 * Registra handlers globais para erros não tratados.
 * Idempotente: pode ser chamado múltiplas vezes sem duplicar.
 */
let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    logger.error("window.error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    logger.error("unhandledrejection", {
      message: reason?.message ?? String(reason),
      stack: reason?.stack,
    });
  });
}
