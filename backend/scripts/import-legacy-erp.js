#!/usr/bin/env node
/**
 * Importa contratos legados (DSR + MIC BAN) do ERP antigo.
 *
 * Regras:
 *  - Cliente: dedupe por CPF/CNPJ. Se já existe em `customers`, reutiliza o id.
 *             Se não, insere com os campos mínimos.
 *  - Contrato: chave = numero prefixado (`DSR-2025/00026` ou `MIC-2025/00026`).
 *              Se já existe em `erp_contracts`, PULA (não sobrescreve nada).
 *  - Empresas emissoras: lookup por CNPJ em `erp_companies`. Se não achar, aborta.
 *  - NUNCA deleta, nunca faz UPDATE em registro existente.
 *  - Tudo dentro de uma transação com --apply. Modo padrão é dry-run.
 *
 * Uso:
 *   node backend/scripts/import-legacy-erp.js            # dry-run
 *   node backend/scripts/import-legacy-erp.js --apply    # executa de verdade
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const DATA_DIR = path.join(__dirname, 'legacy-data');

const SOURCES = [
  { file: 'dsr.json',    prefix: 'DSR', cnpj: '26907815000142', label: 'DSR (Debora de S Rodrigues)' },
  { file: 'micban.json', prefix: 'MIC', cnpj: '42264001000193', label: 'MIC BAN' },
];

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const c = {
  b:  s => `\x1b[34m${s}\x1b[0m`,
  g:  s => `\x1b[32m${s}\x1b[0m`,
  y:  s => `\x1b[33m${s}\x1b[0m`,
  r:  s => `\x1b[31m${s}\x1b[0m`,
  dim:s => `\x1b[2m${s}\x1b[0m`,
};

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}
function parseNumber(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^\d,.\-]/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}
function parseDia(v) {
  const n = parseInt(v, 10);
  if (!isFinite(n) || n < 1) return 10;
  return Math.min(n, 28);
}
function personType(doc) {
  return doc && doc.length === 11 ? 'PF' : 'PJ';
}
function situacaoToAtivo(s) {
  const norm = (s || '').toLowerCase();
  if (norm.startsWith('ativ'))   return { ativo: true,  motivo: null };
  if (norm.startsWith('susp'))   return { ativo: false, motivo: 'Migração: Suspenso no ERP anterior' };
  if (norm.startsWith('cancel')) return { ativo: false, motivo: 'Migração: Cancelado no ERP anterior' };
  return { ativo: true, motivo: null };
}

async function findOrCreateCustomer(client, row, stats) {
  const doc = row.documento;
  const name = row.razao_social || 'Cliente sem nome';

  if (doc) {
    const found = await client.query(
      `SELECT id FROM customers WHERE regexp_replace(coalesce(document,''),'\\D','','g') = $1 LIMIT 1`,
      [doc]
    );
    if (found.rows[0]) {
      stats.customersReused++;
      return found.rows[0].id;
    }
  } else {
    // Sem documento, tenta bater por nome exato (case-insensitive) pra não duplicar
    const found = await client.query(
      `SELECT id FROM customers WHERE lower(customer_name) = lower($1) LIMIT 1`,
      [name]
    );
    if (found.rows[0]) {
      stats.customersReused++;
      return found.rows[0].id;
    }
  }

  if (!APPLY) {
    stats.customersNew++;
    return '00000000-0000-0000-0000-000000000000';
  }

  const ins = await client.query(
    `INSERT INTO customers (customer_name, document, person_type, email, contact_phone, address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [name, doc, personType(doc), row.email, row.telefone, row.endereco]
  );
  stats.customersNew++;
  return ins.rows[0].id;
}

async function importSource(client, src, stats) {
  const rows = JSON.parse(fs.readFileSync(path.join(DATA_DIR, src.file), 'utf8'));
  console.log(c.b(`\n[${src.label}]`) + ` ${rows.length} linhas`);

  const comp = await client.query(
    `SELECT id, razao_social FROM erp_companies
      WHERE regexp_replace(cnpj,'\\D','','g') = $1 LIMIT 1`,
    [src.cnpj]
  );
  if (!comp.rows[0]) {
    throw new Error(`erp_companies: CNPJ ${src.cnpj} (${src.label}) não encontrado. Cadastre a empresa antes.`);
  }
  const companyId = comp.rows[0].id;
  console.log(c.dim(`  empresa: ${comp.rows[0].razao_social} (${companyId})`));

  for (const r of rows) {
    try {
      const customerId = await findOrCreateCustomer(client, r, stats);

      const numeroPrefixado = `${src.prefix}-${r.numero}`;
      const exists = await client.query(
        `SELECT 1 FROM erp_contracts WHERE numero = $1 LIMIT 1`,
        [numeroPrefixado]
      );
      if (exists.rows[0]) {
        stats.contractsSkipped++;
        continue;
      }

      const { ativo, motivo } = situacaoToAtivo(r.situacao);
      const dataInicio = parseDate(r.vigencia_inicial) || new Date().toISOString().slice(0, 10);

      if (APPLY) {
        await client.query(
          `INSERT INTO erp_contracts
             (numero, company_id, customer_id, origem, tipo_contrato,
              data_inicio, dia_vencimento, valor_mensal,
              ativo, encerrado_em, motivo_encerramento, observacoes)
           VALUES ($1,$2,$3,'importacao','locacao',
                   $4,$5,$6,
                   $7, CASE WHEN $7=FALSE THEN NOW() ELSE NULL END, $8, $9)`,
          [numeroPrefixado, companyId, customerId,
           dataInicio, parseDia(r.dia_faturamento), parseNumber(r.valor_total),
           ativo, motivo, r.observacoes]
        );
      }
      stats.contractsNew++;
    } catch (e) {
      stats.errors.push({ numero: r.numero, msg: e.message });
      console.log(c.r(`  ✗ ${r.numero}: ${e.message}`));
    }
  }
}

(async () => {
  console.log(c.b(`\n=== Importação legada ERP — modo: ${APPLY ? c.g('APPLY') : c.y('DRY-RUN')} ===`));
  const client = await pool.connect();
  const stats = { customersNew: 0, customersReused: 0, contractsNew: 0, contractsSkipped: 0, errors: [] };
  try {
    await client.query('BEGIN');
    for (const src of SOURCES) await importSource(client, src, stats);
    if (APPLY) {
      await client.query('COMMIT');
      console.log(c.g('\n✅ COMMIT — dados persistidos.'));
    } else {
      await client.query('ROLLBACK');
      console.log(c.y('\n⚪ ROLLBACK (dry-run — nada foi gravado). Rode com --apply para persistir.'));
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(c.r(`\n❌ ROLLBACK: ${e.message}`));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n' + c.b('Resumo:'));
  console.log(`  Clientes novos:        ${stats.customersNew}`);
  console.log(`  Clientes reaproveitados: ${stats.customersReused}`);
  console.log(`  Contratos novos:       ${stats.contractsNew}`);
  console.log(`  Contratos pulados:     ${stats.contractsSkipped} (já existiam)`);
  console.log(`  Erros:                 ${stats.errors.length}`);
})();
