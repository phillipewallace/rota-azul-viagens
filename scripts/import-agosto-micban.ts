import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Carregamento manual do .env para evitar dependência do pacote 'dotenv' no ambiente de produção/VPS
function loadEnv() {
  const envPath = path.resolve(process.cwd(), 'backend/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'alchemy_rotas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Script para importar dados do Excel "AGOSTO 26 (2)" para contratos no ERP
// Executado via node no ambiente da VPS após deploy ou via sandbox para teste.

async function importFromExcel() {
  console.log('🚀 Iniciando importação de contratos (Micban - Agosto 26)...');
  
  const rows = [
    {
      empresa: 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA',
      valor: 1100,
      vencimento: 15,
      dados_cadastrais: 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA, CNPJ: 22.091.248/0001-04',
      descricao: 'Locação Mensal - Sanitário Comum'
    },
    {
      empresa: 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA',
      valor: 1100,
      vencimento: 15,
      dados_cadastrais: 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA, CNPJ: 22.091.248/0001-04',
      descricao: 'Locação Mensal - Sanitário Comum'
    },
    {
      empresa: 'CONSTRUTORA SERVCOPA EIRELI',
      valor: 1960,
      vencimento: 22,
      dados_cadastrais: 'CONSTRUTORA SERVCOPA EIRELI, CNPJ: 21.054.432/0001-07',
      descricao: 'Locação Mensal - Sanitário Comum'
    },
    {
      empresa: 'CONSTRUTORA RNV LTDA',
      valor: 2000,
      vencimento: 10,
      dados_cadastrais: 'CONSTRUTORA RNV LTDA, CNPJ: 07.135.295/0001-37',
      descricao: 'Aluguel de Carretinha - Placas RGD-9D72, RGD-9D70, RGD-9D71, RTK6A34'
    },
    {
      empresa: 'CONSTRUTORA RNV LTDA',
      valor: 1400,
      vencimento: 10,
      dados_cadastrais: 'CONSTRUTORA RNV LTDA, CNPJ: 07.135.295/0001-37',
      descricao: 'Locação Mensal - Sanitário Comum'
    },
    {
      empresa: 'SUPERMERCADOS BH COMERCIO DE ALIMENTOS S/A',
      valor: 450,
      vencimento: 20,
      dados_cadastrais: 'SUPERMERCADOS BH COMERCIO DE ALIMENTOS S/A, CNPJ: 04.641.376/0001-36',
      descricao: 'Locação Mensal - Sanitário Comum'
    }
  ];

  const client = await pool.connect();
  try {
    const micbanRes = await client.query("SELECT id FROM erp_companies WHERE razao_social ILIKE '%Micban%' LIMIT 1");
    if (micbanRes.rows.length === 0) {
      throw new Error('Empresa emissora "Micban" não encontrada no sistema.');
    }
    const companyId = micbanRes.rows[0].id;
    console.log(`✅ Empresa emissora identificada: ${companyId}`);

    for (const row of rows) {
      await client.query('BEGIN');
      
      const cnpjMatch = row.dados_cadastrais.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      const docClean = cnpjMatch ? cnpjMatch[0].replace(/\D/g, '') : '';
      
      const existingContract = await client.query(`
        SELECT c.id FROM erp_contracts c
        JOIN customers cust ON c.customer_id = cust.id
        WHERE c.company_id = $1 
        AND (regexp_replace(cust.document, '\\D', 'g', 'g') = $2 OR cust.customer_name ILIKE $3)
        AND c.valor_mensal = $4
        AND c.descricao = $5
        AND c.origem = 'excel_import_agosto'
        LIMIT 1
      `, [companyId, docClean, row.empresa, row.valor, row.descricao]);

      if (existingContract.rows.length > 0) {
        console.log(`⚠️ Contrato já existe para ${row.empresa} (${row.descricao}) - Pulando.`);
        await client.query('ROLLBACK');
        continue;
      }

      let customerId: string;
      const custRes = await client.query("SELECT id FROM customers WHERE regexp_replace(document, '\\D', 'g', 'g') = $1 OR customer_name ILIKE $2 LIMIT 1", [docClean, row.empresa]);
      
      if (custRes.rows.length > 0) {
        customerId = custRes.rows[0].id;
      } else {
        customerId = uuidv4();
        await client.query(`
          INSERT INTO customers (id, customer_name, document, person_type, created_at, updated_at)
          VALUES ($1, $2, $3, 'PJ', NOW(), NOW())
        `, [customerId, row.empresa, cnpjMatch ? cnpjMatch[0] : null]);
      }

      const numRes = await client.query("SELECT erp_next_doc_number('CTR', $1::uuid) AS num", [companyId]);
      const numero = numRes.rows[0].num;

      await client.query(`
        INSERT INTO erp_contracts 
        (numero, company_id, customer_id, descricao, tipo_contrato, data_inicio, dia_vencimento, valor_mensal, ativo, origem)
        VALUES ($1, $2, $3, $4, 'locacao', '2026-08-01', $5, $6, TRUE, 'excel_import_agosto')
      `, [numero, companyId, customerId, row.descricao, row.vencimento || 10, row.valor]);

      await client.query('COMMIT');
      console.log(`✅ Contrato ${numero} registrado para ${row.empresa}: ${row.descricao}`);
    }

    console.log('🎉 Importação concluída com sucesso!');
  } catch (err) {
    console.error('❌ Erro na importação:', err);
    if (client) await client.query('ROLLBACK');
  } finally {
    client.release();
    process.exit();
  }
}

importFromExcel();
