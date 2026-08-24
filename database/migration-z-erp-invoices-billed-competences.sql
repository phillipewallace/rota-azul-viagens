-- ============================================================
-- ERP · Competências efetivamente faturadas por Nota Fiscal.
--
-- Mantém a competência de cobrança explícita e independente da data de
-- emissão do documento. A carga inicial preserva exatamente a competência
-- já registrada na NF; casos sem evidência segura não são movidos de mês.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS erp_invoice_billed_competences (
  invoice_id UUID NOT NULL REFERENCES erp_invoices(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES erp_contracts(id) ON DELETE CASCADE,
  competencia CHAR(7) NOT NULL,
  reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (invoice_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_invoice_billed_competences TO lipe;

CREATE INDEX IF NOT EXISTS idx_erp_invoice_billed_comp_contract_comp
  ON erp_invoice_billed_competences(contract_id, competencia);

-- Reconcilia todas as NFs históricas sem alterar o mês originalmente salvo.
INSERT INTO erp_invoice_billed_competences
  (invoice_id, contract_id, competencia, reconciled)
SELECT i.id, i.contract_id, i.competencia, TRUE
  FROM erp_invoices i
ON CONFLICT (invoice_id, competencia)
DO UPDATE SET contract_id = EXCLUDED.contract_id;

-- Diagnóstico seguro para revisão manual: NFs cuja competência não coincide
-- com a emissão. A diferença pode ser legítima, portanto não há UPDATE cego.
SELECT COUNT(*) AS invoices_competencia_diferente_da_emissao
  FROM erp_invoices
 WHERE competencia <> TO_CHAR(data_emissao, 'YYYY-MM');