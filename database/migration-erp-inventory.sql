-- ============================================================
-- ERP INTERNO - MÓDULO DE ESTOQUE
-- Categorias dinâmicas, itens, funcionários, movimentações e PDFs
-- ============================================================

-- Categorias dinâmicas (Papel Higiênico, EPI, Produtos Químicos, ...)
CREATE TABLE IF NOT EXISTS erp_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120) NOT NULL UNIQUE,
  description  TEXT,
  icon         VARCHAR(40)  DEFAULT 'package',
  tracks_expiry BOOLEAN     NOT NULL DEFAULT FALSE, -- ex.: EPIs
  requires_signed_term BOOLEAN NOT NULL DEFAULT FALSE, -- ex.: EPIs precisam termo
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Itens de estoque
CREATE TABLE IF NOT EXISTS erp_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES erp_categories(id) ON DELETE RESTRICT,
  name            VARCHAR(200) NOT NULL,
  sku             VARCHAR(80),
  unit            VARCHAR(20)  NOT NULL DEFAULT 'un', -- un, cx, L, kg, par
  current_qty     NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_qty         NUMERIC(12,2) NOT NULL DEFAULT 0,
  expiry_date     DATE, -- validade (EPIs / químicos)
  expiry_alert_days INT NOT NULL DEFAULT 30,
  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_items_category ON erp_items(category_id);
CREATE INDEX IF NOT EXISTS idx_erp_items_expiry   ON erp_items(expiry_date);

-- Funcionários do ERP (independente)
CREATE TABLE IF NOT EXISTS erp_employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  role        VARCHAR(100),
  cpf         VARCHAR(20),
  phone       VARCHAR(30),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Movimentações (entrada / retirada / ajuste / descarte)
CREATE TABLE IF NOT EXISTS erp_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES erp_items(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('in','out','adjust','discard')),
  qty           NUMERIC(12,2) NOT NULL,
  employee_id   UUID REFERENCES erp_employees(id) ON DELETE SET NULL,
  performed_by  VARCHAR(150), -- usuário admin que registrou
  notes         TEXT,
  signed_pdf_url TEXT, -- termo assinado (quando aplicável)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_mov_item ON erp_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_erp_mov_emp  ON erp_movements(employee_id);
CREATE INDEX IF NOT EXISTS idx_erp_mov_date ON erp_movements(created_at);

-- Seed inicial de categorias (idempotente)
INSERT INTO erp_categories (name, icon, tracks_expiry, requires_signed_term)
VALUES
  ('Papel Higiênico', 'scroll-text', FALSE, FALSE),
  ('EPI',             'hard-hat',    TRUE,  TRUE),
  ('Produtos Químicos','flask-conical', TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Permissões
GRANT ALL ON erp_categories, erp_items, erp_employees, erp_movements TO lipe;
