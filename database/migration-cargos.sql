-- Cargos dinâmicos, gerenciados via Configurações.
CREATE TABLE IF NOT EXISTS cargos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(40) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO cargos (nome) VALUES
  ('Financeiro'), ('Comercial'), ('Faxineiro'),
  ('Gerente'), ('Motorista'), ('Ajudante')
ON CONFLICT (nome) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON cargos TO lipe;
GRANT USAGE, SELECT ON SEQUENCE cargos_id_seq TO lipe;
