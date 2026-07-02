-- =====================================================================
-- Módulo Ponto Digital + Funcionários compartilhados
-- Portaria MTP 671/2021 · REP-P · CLT
-- =====================================================================

-- ---------- Funcionários (compartilhado com sistema principal) ----------
CREATE TABLE IF NOT EXISTS funcionarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(160) NOT NULL,
  matricula     VARCHAR(40)  NOT NULL UNIQUE,
  cpf           VARCHAR(20),
  pis           VARCHAR(20),
  rg            VARCHAR(30),
  email         VARCHAR(160),
  telefone      VARCHAR(40),
  cargo         VARCHAR(120),
  departamento  VARCHAR(120),
  admissao      DATE,
  desligamento  DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'ativo'
                  CHECK (status IN ('ativo','ferias','afastado','desligado')),
  jornada_id    UUID,
  banco_horas_min INTEGER NOT NULL DEFAULT 0, -- saldo em minutos (+/-)
  salario_base  NUMERIC(12,2),
  observacoes   TEXT,
  user_id       UUID, -- vínculo opcional com users (login)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_funcionarios_status ON funcionarios(status);
CREATE INDEX IF NOT EXISTS idx_funcionarios_dep    ON funcionarios(departamento);

-- ---------- Jornadas (escalas) ----------
CREATE TABLE IF NOT EXISTS ponto_jornadas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(120) NOT NULL,
  carga_semanal NUMERIC(5,2) NOT NULL DEFAULT 44,
  entrada       TIME NOT NULL,
  saida_almoco  TIME,
  volta_almoco  TIME,
  saida         TIME NOT NULL,
  tolerancia_min INTEGER NOT NULL DEFAULT 10, -- Portaria 671 art. 78
  dias_semana   INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ativa         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK depois que ponto_jornadas existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'funcionarios_jornada_fk') THEN
    ALTER TABLE funcionarios
      ADD CONSTRAINT funcionarios_jornada_fk FOREIGN KEY (jornada_id)
      REFERENCES ponto_jornadas(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ---------- Registros de ponto (NSR imutável) ----------
CREATE TABLE IF NOT EXISTS ponto_punches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  timestamp     TIMESTAMPTZ NOT NULL,
  tipo          VARCHAR(20) NOT NULL
                  CHECK (tipo IN ('entrada','saida-almoco','volta-almoco','saida')),
  origem        VARCHAR(20) NOT NULL DEFAULT 'web'
                  CHECK (origem IN ('web','mobile','manual','importado')),
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  endereco      TEXT,
  nsr           BIGINT NOT NULL UNIQUE,     -- Número Sequencial de Registro
  hash          VARCHAR(120) NOT NULL,      -- assinatura HMAC/SHA-256
  foto_url      TEXT,                       -- captura facial (LGPD)
  ajustado      BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_ajuste TEXT,
  ajustado_por  UUID,
  ajustado_em   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_punches_func_ts ON ponto_punches(funcionario_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_punches_ts      ON ponto_punches(timestamp DESC);

-- Sequência global para NSR (nunca reinicia — exigência da Portaria 671)
CREATE SEQUENCE IF NOT EXISTS ponto_nsr_seq START WITH 1000 INCREMENT BY 1;

-- ---------- Justificativas / abonos ----------
CREATE TABLE IF NOT EXISTS ponto_justifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data          DATE NOT NULL,
  tipo          VARCHAR(30) NOT NULL
                  CHECK (tipo IN ('falta','atraso','saida-antecipada','esquecimento','atestado','folga','ferias','licenca')),
  status        VARCHAR(20) NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','aprovada','recusada')),
  motivo        TEXT NOT NULL,
  anexo_url     TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por    UUID,
  revisado_por  VARCHAR(120),
  revisado_em   TIMESTAMPTZ,
  observacao_revisao TEXT
);
CREATE INDEX IF NOT EXISTS idx_just_status ON ponto_justifications(status);
CREATE INDEX IF NOT EXISTS idx_just_func   ON ponto_justifications(funcionario_id, data DESC);

-- ---------- Fechamento mensal (folha) ----------
CREATE TABLE IF NOT EXISTS ponto_closures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia   CHAR(7) NOT NULL UNIQUE,  -- YYYY-MM
  fechado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fechado_por   VARCHAR(120) NOT NULL,
  assinatura    VARCHAR(80) NOT NULL,     -- hash SHA-256 do conjunto
  total_funcionarios INTEGER NOT NULL DEFAULT 0,
  total_horas_min    INTEGER NOT NULL DEFAULT 0,
  observacoes   TEXT
);

-- ---------- Configurações do módulo ----------
CREATE TABLE IF NOT EXISTS ponto_settings (
  id             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  razao_social   VARCHAR(200),
  cnpj           VARCHAR(20),
  cei            VARCHAR(30),
  endereco       TEXT,
  fuso_horario   VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  usar_geoloc    BOOLEAN NOT NULL DEFAULT TRUE,
  exigir_foto    BOOLEAN NOT NULL DEFAULT TRUE,
  banco_horas_ativo BOOLEAN NOT NULL DEFAULT TRUE,
  limite_credito_min INTEGER NOT NULL DEFAULT 6000, -- 100h
  limite_debito_min  INTEGER NOT NULL DEFAULT 3000,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO ponto_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------- Ajustes manuais de banco de horas ----------
CREATE TABLE IF NOT EXISTS ponto_bank_adjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  minutos       INTEGER NOT NULL, -- + crédito / - débito
  motivo        TEXT NOT NULL,
  criado_por    VARCHAR(120) NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_adj_func ON ponto_bank_adjustments(funcionario_id, criado_em DESC);

-- ---------- Trigger updated_at ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_funcionarios_updated') THEN
    CREATE TRIGGER trg_funcionarios_updated BEFORE UPDATE ON funcionarios
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_jornadas_updated') THEN
    CREATE TRIGGER trg_jornadas_updated BEFORE UPDATE ON ponto_jornadas
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- ---------- Seeds mínimos (jornadas padrão) ----------
INSERT INTO ponto_jornadas (nome, carga_semanal, entrada, saida_almoco, volta_almoco, saida, tolerancia_min, dias_semana)
VALUES
  ('Comercial 44h',       44, '08:00', '12:00', '13:00', '17:48', 10, '{1,2,3,4,5}'),
  ('Operacional 6x1',     44, '07:00', '11:00', '12:00', '15:20', 10, '{1,2,3,4,5,6}'),
  ('Administrativa 40h',  40, '09:00', '12:00', '13:00', '18:00', 10, '{1,2,3,4,5}')
ON CONFLICT DO NOTHING;
