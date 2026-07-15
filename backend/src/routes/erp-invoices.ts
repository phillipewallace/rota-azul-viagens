/**
 * ERP → Notas Fiscais — vinculação de NF emitida no portal do governo
 * a um contrato + competência. Substitui o fluxo antigo de "Marcar pago"
 * quando o cliente pagou por NF (não por recibo do app).
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const invoicesDir = path.join(__dirname, '../../uploads/invoices');
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, invoicesDir),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!/pdf/i.test(file.mimetype) && !/\.pdf$/i.test(file.originalname)) {
      return cb(new Error('Somente PDF é aceito'));
    }
    cb(null, true);
  },
});

const SELECT = `
  i.id, i.contract_id AS "contractId", i.competencia,
  i.numero, i.serie,
  i.data_emissao AS "dataEmissao",
  i.valor,
  i.forma_pagamento AS "formaPagamento",
  i.observacoes,
  i.pdf_url AS "pdfUrl",
  i.pdf_original_filename AS "pdfOriginalFilename",
  i.pdf_stored_filename   AS "pdfStoredFilename",
  i.pdf_size_bytes AS "pdfSizeBytes",
  i.status,
  i.cancelado_em AS "canceladoEm",
  i.motivo_cancelamento AS "motivoCancelamento",
  i.created_by AS "createdBy",
  i.created_at AS "createdAt",
  c.numero AS "contractNumero",
  c.company_id AS "companyId",
  emp.razao_social AS "companyRazaoSocial", emp.cnpj AS "companyCnpj",
  cu.customer_name AS "customerName", cu.document AS "customerDocument"
`;

// ---------- LIST ---------------------------------------------------------
router.get('/', async (req: any, res: any) => {
  try {
    const { contractId, competencia, from, to, status, formaPagamento, companyId, search } =
      req.query || {};
    const conds: string[] = [];
    const params: any[] = [];
    const push = (sql: string, val: any) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };

    if (contractId)     push('i.contract_id = ?', contractId);
    if (competencia)    push('i.competencia = ?', competencia);
    if (from)           push('i.data_emissao >= ?', from);
    if (to)             push('i.data_emissao <= ?', to);
    if (status)         push('i.status = ?', status);
    if (formaPagamento) push('i.forma_pagamento = ?', formaPagamento);
    if (companyId)      push('c.company_id = ?', companyId);
    if (search) {
      const s = `%${String(search).toLowerCase()}%`;
      params.push(s);
      conds.push(`(LOWER(i.numero) LIKE $${params.length}
                OR LOWER(COALESCE(cu.customer_name,'')) LIKE $${params.length}
                OR LOWER(COALESCE(c.numero,'')) LIKE $${params.length}
                OR LOWER(COALESCE(emp.razao_social,'')) LIKE $${params.length})`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT ${SELECT}
         FROM erp_invoices i
         JOIN erp_contracts c ON c.id = i.contract_id
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         ${where}
        ORDER BY i.data_emissao DESC, i.created_at DESC
        LIMIT 5000`,
      params,
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('[erp-invoices GET]', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const r = await pool.query(
      `SELECT ${SELECT}
         FROM erp_invoices i
         JOIN erp_contracts c ON c.id = i.contract_id
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
        WHERE i.id = $1`,
      [req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---------- CREATE (multipart) ------------------------------------------
router.post('/', (req: any, res: any) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Erro no upload' });
    const file = req.file;
    try {
      const {
        contractId, competencia, numero, serie, dataEmissao, valor,
        formaPagamento, observacoes,
      } = req.body || {};
      if (!file)         return res.status(400).json({ error: 'PDF da nota fiscal é obrigatório' });
      if (!contractId)   return res.status(400).json({ error: 'contractId obrigatório' });
      if (!numero)       return res.status(400).json({ error: 'Número da NF obrigatório' });
      if (!dataEmissao)  return res.status(400).json({ error: 'Data de emissão obrigatória' });

      // Deriva competência do dataEmissao quando não informada.
      const comp = competencia || String(dataEmissao).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(comp)) {
        return res.status(400).json({ error: 'Competência inválida' });
      }

      // Impede duplicidade de NF ativa na mesma competência do contrato.
      const dup = await pool.query(
        `SELECT id, numero FROM erp_invoices
          WHERE contract_id = $1 AND competencia = $2 AND status = 'ativa' LIMIT 1`,
        [contractId, comp],
      );
      if (dup.rows[0]) {
        // Remove PDF órfão que acabamos de subir.
        try { fs.unlinkSync(path.join(invoicesDir, file.filename)); } catch {}
        return res.status(409).json({
          error: `Já existe uma NF ativa (${dup.rows[0].numero}) nessa competência para este contrato.`,
        });
      }

      const url = `/uploads/invoices/${file.filename}`;
      const r = await pool.query(
        `INSERT INTO erp_invoices
           (contract_id, competencia, numero, serie, data_emissao, valor,
            forma_pagamento, observacoes,
            pdf_url, pdf_original_filename, pdf_stored_filename, pdf_size_bytes,
            created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          contractId, comp, String(numero).trim(), serie || null,
          dataEmissao, Number(valor || 0),
          formaPagamento || null, observacoes || null,
          url, file.originalname, file.filename, file.size || null,
          req.user?.username || req.user?.name || null,
        ],
      );
      res.json({ ok: true, id: r.rows[0].id });
    } catch (e: any) {
      // Tenta limpar arquivo se algo falhou depois do upload.
      if (file) { try { fs.unlinkSync(path.join(invoicesDir, file.filename)); } catch {} }
      console.error('[erp-invoices POST]', e);
      res.status(500).json({ error: e.message });
    }
  });
});

// ---------- UPDATE metadata ---------------------------------------------
router.patch('/:id', async (req: any, res: any) => {
  try {
    const body = req.body || {};
    const { numero, dataEmissao, valor, formaPagamento } = body;
    // Campos opcionais: usamos `in body` para distinguir "não informado"
    // (mantém valor atual) de "string vazia" (limpa a coluna).
    const serieProvided = Object.prototype.hasOwnProperty.call(body, 'serie');
    const obsProvided   = Object.prototype.hasOwnProperty.call(body, 'observacoes');
    const formaProvided = Object.prototype.hasOwnProperty.call(body, 'formaPagamento');

    const cur = await pool.query('SELECT status FROM erp_invoices WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    if (cur.rows[0].status === 'cancelada') {
      return res.status(409).json({ error: 'NF cancelada — reative para editar (contate um administrador).' });
    }

    const norm = (v: any) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s.length ? s : null;
    };

    await pool.query(
      `UPDATE erp_invoices
          SET numero = COALESCE($2, numero),
              serie  = CASE WHEN $3::boolean THEN $4 ELSE serie END,
              data_emissao = COALESCE($5, data_emissao),
              valor  = COALESCE($6, valor),
              forma_pagamento = CASE WHEN $7::boolean THEN $8 ELSE forma_pagamento END,
              observacoes     = CASE WHEN $9::boolean THEN $10 ELSE observacoes END,
              updated_at = NOW()
        WHERE id = $1`,
      [req.params.id,
       numero ? String(numero).trim() : null,
       serieProvided, serieProvided ? norm(body.serie) : null,
       dataEmissao || null,
       valor === undefined || valor === null ? null : Number(valor),
       formaProvided, formaProvided ? norm(formaPagamento) : null,
       obsProvided, obsProvided ? norm(body.observacoes) : null],
    );

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---------- REPLACE PDF -------------------------------------------------
router.post('/:id/replace-pdf', (req: any, res: any) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Erro no upload' });
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      const cur = await pool.query(
        'SELECT pdf_stored_filename FROM erp_invoices WHERE id=$1',
        [req.params.id],
      );
      if (!cur.rows[0]) {
        try { fs.unlinkSync(path.join(invoicesDir, file.filename)); } catch {}
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
      }
      const url = `/uploads/invoices/${file.filename}`;
      await pool.query(
        `UPDATE erp_invoices
            SET pdf_url = $2,
                pdf_original_filename = $3,
                pdf_stored_filename   = $4,
                pdf_size_bytes        = $5,
                updated_at            = NOW()
          WHERE id = $1`,
        [req.params.id, url, file.originalname, file.filename, file.size || null],
      );
      const old = cur.rows[0].pdf_stored_filename;
      if (old) { try { fs.unlinkSync(path.join(invoicesDir, old)); } catch {} }
      res.json({ ok: true, pdfUrl: url });
    } catch (e: any) {
      if (file) { try { fs.unlinkSync(path.join(invoicesDir, file.filename)); } catch {} }
      res.status(500).json({ error: e.message });
    }
  });
});

// ---------- CANCEL (soft) -----------------------------------------------
router.post('/:id/cancel', async (req: any, res: any) => {
  try {
    const { motivo } = req.body || {};
    if (!motivo || !String(motivo).trim()) {
      return res.status(400).json({ error: 'motivo é obrigatório' });
    }
    const cur = await pool.query('SELECT status FROM erp_invoices WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    if (cur.rows[0].status === 'cancelada') {
      return res.status(409).json({ error: 'NF já está cancelada.' });
    }
    await pool.query(
      `UPDATE erp_invoices
          SET status = 'cancelada',
              cancelado_em = NOW(),
              motivo_cancelamento = $2,
              updated_at = NOW()
        WHERE id = $1`,
      [req.params.id, String(motivo).trim()],
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---------- DELETE (admin/manager) --------------------------------------
router.delete('/:id', requireRole('admin', 'manager'), async (req: any, res: any) => {
  try {
    const r = await pool.query(
      'DELETE FROM erp_invoices WHERE id=$1 RETURNING pdf_stored_filename',
      [req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    const stored = r.rows[0].pdf_stored_filename;
    if (stored) { try { fs.unlinkSync(path.join(invoicesDir, stored)); } catch {} }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
