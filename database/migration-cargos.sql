-- Cargos dinâmicos, gerenciados via Configurações.
-- Sem seeds: os cargos são adicionados manualmente pelo usuário.
CREATE TABLE IF NOT EXISTS cargos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(40) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON cargos TO lipe;
GRANT USAGE, SELECT ON SEQUENCE cargos_id_seq TO lipe;
