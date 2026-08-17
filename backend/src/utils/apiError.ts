/**
 * Tradução centralizada de erros do Postgres → mensagens amigáveis + status.
 * Evita vazar nome de constraints/colunas em `res.status(500).json({ error: e.message })`.
 *
 * Uso:
 *   } catch (e: any) { return sendError(res, e, '[erp-invoices POST]'); }
 */
import type { Response } from 'express';

const PG_MAP: Record<string, { status: number; msg: string }> = {
  '23505': { status: 409, msg: 'Registro duplicado.' },        // unique_violation
  '23503': { status: 409, msg: 'Referência inválida ou em uso.' }, // foreign_key_violation
  '23502': { status: 400, msg: 'Campo obrigatório ausente.' }, // not_null_violation
  '23514': { status: 400, msg: 'Valor não permitido para o campo.' }, // check_violation
  '22001': { status: 400, msg: 'Valor excede o tamanho permitido.' }, // string_data_right_truncation
  '22P02': { status: 400, msg: 'Formato inválido para um dos campos.' }, // invalid_text_representation
};

export function sendError(res: Response, e: any, logTag = '[api]') {
  // Log completo somente no servidor.
  // eslint-disable-next-line no-console
  console.error(logTag, e);

  const code: string | undefined = e?.code;
  if (code && PG_MAP[code]) {
    return res.status(PG_MAP[code].status).json({ error: PG_MAP[code].msg });
  }
  // Erros de validação lançados no handler com .status
  if (typeof e?.status === 'number') {
    return res.status(e.status).json({ error: e.message || 'Erro na requisição' });
  }
  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}
