-- ============================================================
-- Migration: Performance — índices para as listagens paginadas
-- Idempotente. Foco em ILIKE de busca e ORDER BY das rotas /customers,
-- /erp-expenses, /erp-invoices, /erp-receipts, /erp-medicoes, /erp-contracts,
-- /erp-service-orders e /erp-signed-pdfs.
-- ============================================================

-- Extensão para trigram (acelera ILIKE '%foo%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- customers ----------
-- ORDER BY customer_name ASC + ILIKE em nome/endereço/email/contato
CREATE INDEX IF NOT EXISTS idx_customers_name_lower
  ON customers ((lower(customer_name)));

CREATE INDEX IF NOT EXISTS idx_customers_person_type
  ON customers (person_type);

CREATE INDEX IF NOT EXISTS idx_customers_created_at
  ON customers (created_at);

-- GIN trigram para busca livre nas colunas mais consultadas
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (lower(coalesce(customer_name,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_address_trgm
  ON customers USING gin (lower(coalesce(address,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_contact_name_trgm
  ON customers USING gin (lower(coalesce(contact_name,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_email_lower
  ON customers ((lower(coalesce(email,''))));

-- Documento e telefone/CEP: match por dígitos (regexp_replace)
CREATE INDEX IF NOT EXISTS idx_customers_document_digits
  ON customers ((regexp_replace(coalesce(document,''), '\D', '', 'g')));
CREATE INDEX IF NOT EXISTS idx_customers_phone_digits
  ON customers ((regexp_replace(coalesce(contact_phone,''), '\D', '', 'g')));

-- ---------- sanitarios ----------
-- Filtro por status já indexado; adicionamos busca por cliente atual
CREATE INDEX IF NOT EXISTS idx_sanitarios_current_customer_lower
  ON sanitarios ((lower(coalesce(current_customer_name,''))));
CREATE INDEX IF NOT EXISTS idx_sanitarios_status_em_cliente
  ON sanitarios ((lower(coalesce(current_customer_name,''))))
  WHERE status = 'em_cliente';

-- ---------- erp_expenses ----------
-- Já: data DESC, categoria. Falta company/contract usados em joins.
CREATE INDEX IF NOT EXISTS idx_erp_expenses_company
  ON erp_expenses (company_id);
CREATE INDEX IF NOT EXISTS idx_erp_expenses_contract
  ON erp_expenses (contract_id);

-- ---------- erp_invoices ----------
CREATE INDEX IF NOT EXISTS idx_erp_invoices_company
  ON erp_invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_customer
  ON erp_invoices (customer_id);

-- ---------- erp_receipts ----------
CREATE INDEX IF NOT EXISTS idx_erp_receipts_customer
  ON erp_receipts (customer_id);
CREATE INDEX IF NOT EXISTS idx_erp_receipts_created_at
  ON erp_receipts (created_at DESC);

-- ---------- erp_signed_pdfs ----------
CREATE INDEX IF NOT EXISTS idx_erp_signed_pdfs_created_by
  ON erp_signed_pdfs (created_by);

-- ---------- erp_service_orders ----------
CREATE INDEX IF NOT EXISTS idx_erp_so_created_at
  ON erp_service_orders (created_at DESC);

-- ---------- erp_quotes ----------
CREATE INDEX IF NOT EXISTS idx_erp_quotes_created_at
  ON erp_quotes (created_at DESC);

-- ============================================================
-- Fim.  Rode ANALYZE após aplicar em produção:
--   ANALYZE customers, sanitarios, erp_expenses, erp_invoices,
--           erp_receipts, erp_signed_pdfs, erp_service_orders, erp_quotes;
-- ============================================================
