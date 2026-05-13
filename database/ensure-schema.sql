-- ============================================================================
-- ENSURE SCHEMA — arquivo único, 100% idempotente.
-- Roda em TODO deploy. NUNCA faz DROP/DELETE/TRUNCATE.
-- Apenas CRIA o que falta (tabelas, colunas, índices).
-- Preserva todos os dados existentes.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================== USERS =======================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================== DRIVERS =====================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  license TEXT,
  license_expiry DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_expiry DATE;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================== ROUTES ======================================
CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  total_distance NUMERIC,
  estimated_time INTEGER,
  estimated_duration INTEGER,
  optimized_order JSONB,
  polyline TEXT,
  status TEXT DEFAULT 'active',
  optimization_mode TEXT DEFAULT 'optimized',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS total_distance NUMERIC;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS estimated_time INTEGER;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS estimated_duration INTEGER;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS optimized_order JSONB;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS polyline TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS optimization_mode TEXT DEFAULT 'optimized';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- Coluna legada 'points' (JSONB) — mantida por compatibilidade com builds antigos
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS points JSONB DEFAULT '[]'::jsonb;

-- ============================== ROUTE_POINTS ================================
CREATE TABLE IF NOT EXISTS public.route_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  point_order INTEGER NOT NULL,
  type TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  customer_name TEXT,
  restrooms_qty INTEGER,
  cleanings_qty INTEGER,
  contact_name TEXT,
  contact_phone TEXT,
  notes TEXT,
  cep TEXT,
  stop_type TEXT,
  point_category TEXT DEFAULT 'obra',
  operation_type TEXT DEFAULT 'entrega',
  recolhido_qty INTEGER,
  auto_removed BOOLEAN DEFAULT FALSE,
  sanitario_numbers TEXT[] DEFAULT ARRAY[]::TEXT[],
  sanitario_recolhidos TEXT[] DEFAULT ARRAY[]::TEXT[]
);
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS restrooms_qty INTEGER;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS cleanings_qty INTEGER;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS stop_type TEXT;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS point_category TEXT DEFAULT 'obra';
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'entrega';
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS recolhido_qty INTEGER;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS auto_removed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS sanitario_numbers TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS sanitario_recolhidos TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ============================== TRUCKS ======================================
CREATE TABLE IF NOT EXISTS public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plate TEXT UNIQUE NOT NULL,
  model TEXT,
  year INTEGER,
  status TEXT DEFAULT 'available',
  current_route TEXT,
  driver TEXT,
  current_route_id UUID,
  current_driver_id UUID,
  location_lat NUMERIC,
  location_lng NUMERIC,
  mileage INTEGER DEFAULT 0,
  last_maintenance DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS current_route TEXT;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS driver TEXT;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS current_route_id UUID;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS current_driver_id UUID;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS location_lat NUMERIC;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS location_lng NUMERIC;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS mileage INTEGER DEFAULT 0;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS last_maintenance DATE;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================== TRUCK LOCATION HISTORY ======================
CREATE TABLE IF NOT EXISTS public.truck_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================== SCHEDULES ===================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID,
  truck_id UUID,
  driver_id UUID,
  scheduled_date DATE,
  scheduled_time TIME,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================== CUSTOMERS ===================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================== MAINTENANCE =================================
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID,
  type TEXT,
  description TEXT,
  cost NUMERIC,
  performed_at DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS maintenance_date DATE;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS truck_id UUID;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================== SANITARIOS ==================================
CREATE TABLE IF NOT EXISTS public.sanitarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  modelo TEXT,
  status TEXT NOT NULL DEFAULT 'disponivel',
  current_route_point_id UUID,
  current_customer_name TEXT,
  current_address TEXT,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  installed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sanitarios_status ON public.sanitarios(status);
CREATE INDEX IF NOT EXISTS idx_sanitarios_numero ON public.sanitarios(numero);

CREATE TABLE IF NOT EXISTS public.sanitario_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanitario_id UUID NOT NULL REFERENCES public.sanitarios(id) ON DELETE CASCADE,
  sanitario_numero TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  route_id UUID,
  route_point_id UUID,
  customer_name TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  driver_id UUID,
  driver_name TEXT,
  truck_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_mov_sanitario ON public.sanitario_movimentacoes(sanitario_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_numero ON public.sanitario_movimentacoes(sanitario_numero);
CREATE INDEX IF NOT EXISTS idx_mov_route ON public.sanitario_movimentacoes(route_id);

-- ============================== TRACKING LOCATIONS ==========================
CREATE TABLE IF NOT EXISTS public.tracking_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID,
  truck_id UUID,
  driver_id UUID,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tracking_route ON public.tracking_locations(route_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_truck ON public.tracking_locations(truck_id, recorded_at DESC);

-- ============================== POINT PHOTOS ================================
CREATE TABLE IF NOT EXISTS public.point_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL,
  point_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  operation_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_point_photos_route ON public.point_photos(route_id);
CREATE INDEX IF NOT EXISTS idx_point_photos_point ON public.point_photos(point_id);

-- ============================== COMPLETED ROUTES ============================
CREATE TABLE IF NOT EXISTS public.completed_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL,
  route_name TEXT NOT NULL,
  truck_id UUID,
  truck_plate TEXT,
  driver_id UUID,
  driver_name TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_distance NUMERIC(10,2),
  total_duration INTEGER,
  points_snapshot JSONB DEFAULT '[]'::jsonb,
  photos_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_completed_routes_route ON public.completed_routes(route_id);
CREATE INDEX IF NOT EXISTS idx_completed_routes_status ON public.completed_routes(status);

-- ============================== ERP INTERNO ================================
-- Módulo de Estoque (papel higiênico, EPIs, produtos químicos, dinâmico)
CREATE TABLE IF NOT EXISTS public.erp_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120) NOT NULL UNIQUE,
  description  TEXT,
  icon         VARCHAR(40)  DEFAULT 'package',
  tracks_expiry BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_signed_term BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.erp_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES public.erp_categories(id) ON DELETE RESTRICT,
  name            VARCHAR(200) NOT NULL,
  sku             VARCHAR(80),
  unit            VARCHAR(20)  NOT NULL DEFAULT 'un',
  current_qty     NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_qty         NUMERIC(12,2) NOT NULL DEFAULT 0,
  expiry_date     DATE,
  expiry_alert_days INT NOT NULL DEFAULT 30,
  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_items_category ON public.erp_items(category_id);
CREATE INDEX IF NOT EXISTS idx_erp_items_expiry   ON public.erp_items(expiry_date);

CREATE TABLE IF NOT EXISTS public.erp_employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  role        VARCHAR(100),
  cpf         VARCHAR(20),
  phone       VARCHAR(30),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.erp_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES public.erp_items(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('in','out','adjust','discard')),
  qty           NUMERIC(12,2) NOT NULL,
  employee_id   UUID REFERENCES public.erp_employees(id) ON DELETE SET NULL,
  performed_by  VARCHAR(150),
  notes         TEXT,
  signed_pdf_url TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_mov_item ON public.erp_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_erp_mov_emp  ON public.erp_movements(employee_id);
CREATE INDEX IF NOT EXISTS idx_erp_mov_date ON public.erp_movements(created_at);

INSERT INTO public.erp_categories (name, icon, tracks_expiry, requires_signed_term)
VALUES
  ('Papel Higiênico', 'scroll-text', FALSE, FALSE),
  ('EPI',             'hard-hat',    TRUE,  TRUE),
  ('Produtos Químicos','flask-conical', TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Módulo de Frota (carros, caminhões, carretinhas, etc) — separado de 'trucks' operacional
CREATE TABLE IF NOT EXISTS public.erp_vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  vehicle_type  VARCHAR(40)  NOT NULL DEFAULT 'caminhao',
  brand         VARCHAR(80),
  model         VARCHAR(120),
  year          INT,
  plate         VARCHAR(20),
  renavam       VARCHAR(40),
  chassis       VARCHAR(40),
  color         VARCHAR(40),
  fuel          VARCHAR(20),
  acquisition_date DATE,
  notes         TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.erp_vehicle_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES public.erp_vehicles(id) ON DELETE CASCADE,
  comment     TEXT NOT NULL,
  category    VARCHAR(40), -- multa, manutencao, abastecimento, observacao, ...
  reference_date DATE,     -- "dia tal" do evento
  amount      NUMERIC(12,2),
  status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  attachment_url TEXT,
  author      VARCHAR(150),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_vehicle_comments_vehicle ON public.erp_vehicle_comments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_erp_vehicle_comments_status  ON public.erp_vehicle_comments(status);

-- ============================== TRUCK CHECKLISTS ===========================
CREATE TABLE IF NOT EXISTS public.truck_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  truck_plate TEXT NOT NULL,
  truck_name TEXT,
  truck_model TEXT,
  signer_name TEXT NOT NULL,
  signer_document TEXT NOT NULL,
  signature_data_url TEXT,
  odometer_km NUMERIC,
  fuel_level TEXT,
  general_notes TEXT,
  summary_status TEXT DEFAULT 'ok',
  critical_count INT DEFAULT 0,
  attention_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checklists_truck   ON public.truck_checklists(truck_id);
CREATE INDEX IF NOT EXISTS idx_checklists_plate   ON public.truck_checklists(truck_plate);
CREATE INDEX IF NOT EXISTS idx_checklists_created ON public.truck_checklists(created_at DESC);

CREATE TABLE IF NOT EXISTS public.truck_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES public.truck_checklists(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON public.truck_checklist_items(checklist_id);

-- Suporte a carretinhas nas checklists
ALTER TABLE public.truck_checklists ADD COLUMN IF NOT EXISTS vehicle_kind TEXT DEFAULT 'truck';
ALTER TABLE public.truck_checklists ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.truck_checklists ADD COLUMN IF NOT EXISTS carretinha_id UUID;

-- Modo de assinatura secundária: 'none' | 'cliente' | 'conferente'
ALTER TABLE public.truck_checklists ADD COLUMN IF NOT EXISTS signature_mode TEXT DEFAULT 'none';
ALTER TABLE public.truck_checklists ADD COLUMN IF NOT EXISTS second_signature_data_url TEXT;
ALTER TABLE public.truck_checklists ADD COLUMN IF NOT EXISTS second_signer_name TEXT;
ALTER TABLE public.truck_checklists ADD COLUMN IF NOT EXISTS second_signer_document TEXT;
ALTER TABLE public.truck_checklists ADD COLUMN IF NOT EXISTS second_signed_at TIMESTAMP;

-- ============================== CARRETINHAS =================================
CREATE TABLE IF NOT EXISTS public.carretinhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plate TEXT UNIQUE NOT NULL,
  model TEXT,
  year INT,
  status TEXT DEFAULT 'galpao', -- galpao | locada | manutencao
  current_customer_name TEXT,
  current_rental_start DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carretinhas_plate ON public.carretinhas(plate);
CREATE INDEX IF NOT EXISTS idx_carretinhas_status ON public.carretinhas(status);

CREATE TABLE IF NOT EXISTS public.carretinha_locacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carretinha_id UUID NOT NULL REFERENCES public.carretinhas(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carr_loc_carr ON public.carretinha_locacoes(carretinha_id, start_date DESC);

-- ============================== OWNERSHIP / GRANTS ==========================
-- Garante que o usuário 'lipe' tenha permissão em tudo, mesmo que as tabelas
-- tenham sido criadas por outro owner (postgres). Sem isso, ALTER/SELECT podem
-- falhar quando o backend tenta migrar colunas como 'lipe'.
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lipe') THEN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('ALTER TABLE public.%I OWNER TO lipe', r.tablename);
    END LOOP;
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA public TO lipe';
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO lipe';
    EXECUTE 'GRANT USAGE ON SCHEMA public TO lipe';
  END IF;
END $$;

-- ============================== ADMIN USER ==================================
INSERT INTO public.users (username, password, name, role, active)
VALUES ('phillipe.sodre', '@Wallace44', 'Phillipe Sodré', 'admin', TRUE)
ON CONFLICT (username) DO UPDATE
  SET password = EXCLUDED.password,
      role = 'admin',
      active = TRUE,
      updated_at = CURRENT_TIMESTAMP;
