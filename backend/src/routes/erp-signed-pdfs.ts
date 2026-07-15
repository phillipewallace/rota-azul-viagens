import { sendError } from '../utils/apiError';
/**
 * ERP → Assinatura → histórico de PDFs assinados.
 * Salva o arquivo em uploads/signed/<uuid>.pdf e registra metadata em erp_signed_pdfs.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const signedDir = path.join(__dirname, '../../uploads/signed');
if (!fs.existsSync(signedDir)) fs.mkdirSync(signedDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, signedDir),
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

router.get('/', async (req: any, res: any) => {
  try {
    const { companyId } = req.query;
    const params: any[] = [];
    let where = '';
    if (companyId) {
      params.push(companyId);
      where = `WHERE s.company_id = $1`;
    }
    const r = await pool.query(
      `SELECT s.id,
              s.company_id      AS "companyId",
              c.razao_social    AS "companyName",
              s.original_filename AS "originalFilename",
              s.stored_filename   AS "storedFilename",
              s.file_url        AS "fileUrl",
              s.pages,
              s.placements_count AS "placementsCount",
              s.size_bytes      AS "sizeBytes",
              s.created_by      AS "createdBy",
              s.created_at      AS "createdAt"
         FROM erp_signed_pdfs s
         LEFT JOIN erp_companies c ON c.id = s.company_id
         ${where}
        ORDER BY s.created_at DESC`,
      params,
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('[erp-signed-pdfs GET]', e);
    sendError(res, e);
  }
});

router.post('/', (req: any, res: any) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      console.error('[erp-signed-pdfs POST] multer', err);
      return res.status(400).json({ error: err.message || 'Erro no upload' });
    }
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      const { companyId, originalFilename, pages, placementsCount } = req.body || {};
      const url = `/uploads/signed/${file.filename}`;
      const r = await pool.query(
        `INSERT INTO erp_signed_pdfs
           (company_id, original_filename, stored_filename, file_url, pages, placements_count, size_bytes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, company_id AS "companyId", original_filename AS "originalFilename",
                   stored_filename AS "storedFilename", file_url AS "fileUrl",
                   pages, placements_count AS "placementsCount",
                   size_bytes AS "sizeBytes", created_by AS "createdBy", created_at AS "createdAt"`,
        [
          companyId || null,
          originalFilename || file.originalname,
          file.filename,
          url,
          pages ? parseInt(pages, 10) : null,
          placementsCount ? parseInt(placementsCount, 10) : null,
          file.size || null,
          req.user?.username || req.user?.name || null,
        ],
      );
      res.json(r.rows[0]);
    } catch (e: any) {
      console.error('[erp-signed-pdfs POST]', e);
      sendError(res, e);
    }
  });
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    const r = await pool.query(
      'DELETE FROM erp_signed_pdfs WHERE id = $1 RETURNING stored_filename',
      [req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    const fp = path.join(signedDir, r.rows[0].stored_filename);
    if (fs.existsSync(fp)) {
      try { fs.unlinkSync(fp); } catch (e) { console.warn('[signed-pdfs] unlink falhou', e); }
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[erp-signed-pdfs DELETE]', e);
    sendError(res, e);
  }
});

export default router;
