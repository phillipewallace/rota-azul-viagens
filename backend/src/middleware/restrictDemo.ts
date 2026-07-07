import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthedRequest, JWT_SECRET } from './requireAuth';

/**
 * Guarda de acesso para a role `demo`.
 *
 * Regras:
 *  - Só pode acessar endpoints do ERP + auxiliares essenciais (auth, health,
 *    clientes usados pelo ERP, configs de aparência).
 *  - Somente leitura (GET). Qualquer mutação → 403.
 *
 * Motivo: o usuário demo/demo1234 é público (divulgado para curiosos) e
 * NÃO pode enxergar dados do sistema de roteirização (rotas, motoristas,
 * caminhões, rastreio, checklists, manutenção, gestão etc.).
 */

// Prefixos que o demo pode consultar (todos GET-only, exceto /api/auth).
const DEMO_ALLOWED_PREFIXES = [
  '/api/auth',
  '/api/health',
  '/api/erp',              // cobre /api/erp e /api/erp/*
  '/api/customers',        // clientes são usados dentro do ERP
  '/api/settings',         // tema/aparência
];

function isAllowedPath(path: string): boolean {
  return DEMO_ALLOWED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'),
  );
}

export function restrictDemo(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  // Só analisa rotas /api/*
  if (!req.path.startsWith('/api/')) return next();

  // Decodifica token de forma "soft" — se não houver, deixa passar
  // (os próprios controllers exigem requireAuth quando precisam).
  let role: string | undefined;
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      role = decoded?.role;
    }
  } catch {
    return next(); // token inválido → deixa requireAuth tratar
  }

  if (role !== 'demo') return next();

  // Auth endpoints sempre liberados (login/verify/logout)
  if (req.path.startsWith('/api/auth')) return next();

  // Demo é read-only
  if (req.method !== 'GET') {
    return res
      .status(403)
      .json({ error: 'Conta demonstrativa: apenas leitura.' });
  }

  if (!isAllowedPath(req.path)) {
    return res
      .status(403)
      .json({ error: 'Conta demonstrativa: acesso restrito ao módulo ERP.' });
  }

  next();
}
