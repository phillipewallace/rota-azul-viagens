import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

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
  console.log(`📂 Diretório atual: ${process.cwd()}`);
  console.log(`🔍 Procurando .env em: ${path.resolve(process.cwd(), 'backend/.env')}`);
  
  // Dados extraídos anteriormente via Python/openpyxl (6 linhas sem destaque)
  const rows = [
    {
      empresa: 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA',
      valor: 1100,
      vencimento: 15,
      dados_cadastrais: 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA, CNPJ: 22.091.248/0001-04'
    },
    {
      empresa: 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA',
      valor: 1100,
      vencimento: 15,
      dados_cadastrais: 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA, CNPJ: 22.091.248/0001-04'
    },
    {
      empresa: 'CONSTRUTORA SERVCOPA EIRELI',
      valor: 1960,
      vencimento: 22,
      dados_cadastrais: 'CONSTRUTORA SERVCOPA EIRELI, CNPJ: 21.054.432/0001-07'
    },
    {
      empresa: 'CONSTRUTORA RNV LTDA',
      valor: 2000,
      vencimento: 10, // Default ou detectado
      dados_cadastrais: 'CONSTRUTORA RNV LTDA, CNPJ: 07.135.295/0001-37'
    },
    {
      empresa: 'CONSTRUTORA RNV LTDA',
      valor: 1400,
      vencimento: 10,
      dados_cadastrais: 'CONSTRUTORA RNV LTDA, CNPJ: 07.135.295/0001-37'
    },
    {
      empresa: 'SUPERMERCADOS BH COMERCIO DE ALIMENTOS S/A',
      valor: 450,
      vencimento: 20,
      dados_cadastrais: 'SUPERMERCADOS BH COMERCIO DE ALIMENTOS S/A, CNPJ: 04.641.376/0001-36'
    }
  ];

  const client = await pool.connect();
  try {
    // 1. Localizar Empresa Emissora (Micban)
    const micbanRes = await client.query("SELECT id FROM erp_companies WHERE razao_social ILIKE '%Micban%' LIMIT 1");
    if (micbanRes.rows.length === 0) {
      throw new Error('Empresa emissora "Micban" não encontrada no sistema.');
    }
    const companyId = micbanRes.rows[0].id;
    console.log(`✅ Empresa emissora identificada: ${companyId}`);

    for (const row of rows) {
      await client.query('BEGIN');
      
      // Limpeza de CNPJ para busca
      const cnpjMatch = row.dados_cadastrais.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      const docClean = cnpjMatch ? cnpjMatch[0].replace(/\D/g, '') : '';
      
      // 2. Buscar ou criar cliente
      let customerId: string;
      const custRes = await client.query("SELECT id FROM customers WHERE regexp_replace(document, '\\D', 'g', 'g') = $1 LIMIT 1", [docClean]);
      
      if (custRes.rows.length > 0) {
        customerId = custRes.rows[0].id;
        console.log(`ℹ️ Cliente existente: ${row.empresa} (${docClean})`);
      } else {
        customerId = uuidv4();
        await client.query(`
          INSERT INTO customers (id, customer_name, document, person_type, created_at, updated_at)
          VALUES ($1, $2, $3, 'PJ', NOW(), NOW())
        `, [customerId, row.empresa, cnpjMatch ? cnpjMatch[0] : null]);
        console.log(`🆕 Novo cliente criado: ${row.empresa}`);
      }

      // 3. Gerar número de contrato
      const numRes = await client.query("SELECT erp_next_doc_number('CTR', $1::uuid) AS num", [companyId]);
      const numero = numRes.rows[0].num;

      // 4. Inserir Contrato
      await client.query(`
        INSERT INTO erp_contracts 
        (numero, company_id, customer_id, descricao, tipo_contrato, data_inicio, dia_vencimento, valor_mensal, ativo, origem)
        VALUES ($1, $2, $3, $4, 'locacao', CURRENT_DATE, $5, $6, TRUE, 'excel_import')
      `, [
        numero, 
        companyId, 
        customerId, 
        `Locação Mensal - Importado Excel Agosto`, 
        row.vencimento || 10, 
        row.valor
      ]);

      await client.query('COMMIT');
      console.log(`✅ Contrato ${numero} registrado para ${row.empresa}`);
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
