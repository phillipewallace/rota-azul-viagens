import { pool } from './config/database';

async function run() {
  try {
    console.log('--- EXECUTING DIRECT DB FIX ---');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS erp_doc_counters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
        doc TEXT NOT NULL,
        ano INTEGER NOT NULL,
        ultimo INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS erp_doc_settings_company (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES erp_companies(id) ON DELETE CASCADE,
        doc_type TEXT NOT NULL,
        prefix TEXT,
        last_number INTEGER DEFAULT 0,
        year INTEGER,
        UNIQUE(company_id, doc_type, year)
      );
      CREATE OR REPLACE FUNCTION erp_next_doc_number(p_doc TEXT, p_company_id UUID)
      RETURNS TEXT AS \$\$
      DECLARE
        v_start   INT;
        v_year_f  BOOLEAN;
        v_pad     INT;
        v_prefix  TEXT;
        v_ano     INT;
        v_n       INT;
        v_sigla   TEXT;
        v_sig_p   TEXT := '';
      BEGIN
        IF p_company_id IS NULL THEN
          RAISE EXCEPTION 'company_id obrigatorio' USING ERRCODE = '23502';
        END IF;
        SELECT COALESCE(start_number, 0), COALESCE(include_year, p_doc IN ('ORC','OS','MED')),
               COALESCE(padding, 4), COALESCE(prefix, CASE WHEN p_doc = 'REC_SV' THEN NULL ELSE p_doc END)
          INTO v_start, v_year_f, v_pad, v_prefix
          FROM erp_doc_settings_company
         WHERE company_id = p_company_id AND doc_type = p_doc;
        IF NOT FOUND THEN
          v_start := 0; v_year_f := p_doc IN ('ORC','OS','MED'); v_pad := 4;
          v_prefix := CASE WHEN p_doc = 'REC_SV' THEN NULL ELSE p_doc END;
        END IF;
        SELECT UPPER(sigla) INTO v_sigla FROM erp_companies WHERE id = p_company_id;
        IF v_sigla IS NOT NULL AND v_sigla <> '' THEN v_sig_p := v_sigla || '-'; END IF;
        v_ano := CASE WHEN v_year_f THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT ELSE 0 END;
        INSERT INTO erp_doc_counters(doc, ano, ultimo, company_id)
             VALUES (p_doc, v_ano, v_start + 1, p_company_id)
        ON CONFLICT (company_id, doc, ano) WHERE company_id IS NOT NULL DO UPDATE
             SET ultimo = GREATEST(erp_doc_counters.ultimo + 1, EXCLUDED.ultimo)
        RETURNING ultimo INTO v_n;
        IF v_year_f THEN
          RETURN v_sig_p || COALESCE(v_prefix, p_doc) || '-' || v_ano || '-' || LPAD(v_n::TEXT, v_pad, '0');
        END IF;
        RETURN v_sig_p || COALESCE(v_prefix, p_doc) || '-' || LPAD(v_n::TEXT, v_pad, '0');
      END;
      \$\$ LANGUAGE plpgsql;
    `);
    console.log('✅ DB Fixed Successfully');
  } catch (e) {
    console.error('❌ DB Fix Failed:', e);
  } finally {
    process.exit(0);
  }
}
run();
