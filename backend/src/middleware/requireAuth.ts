import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthedRequest extends Request {
  user?: { userId: string; username: string; role: string };
}

/**
 * Middleware: exige Bearer token JWT válido.
 * Mobile envia o token sob a chave `auth_token` (localStorage).
 */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Token ausente' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { userId: decoded.userId, username: decoded.username, role: decoded.role };
    next();
  } catch (e: any) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Versão "soft": tenta autenticar, mas não bloqueia se falhar.
 * Útil para endpoints chamados pelo APK quando o usuário esquece de logar
 * — ainda gravam dados, mas registramos quem foi se possível.
 */
export function softAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = { userId: decoded.userId, username: decoded.username, role: decoded.role };
    }
  } catch {}
  next();
}
