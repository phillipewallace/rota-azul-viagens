-- Funcionários: senha para login no Ponto (CPF + senha)
-- Idempotente.

ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Índice para lookup por CPF no login (não força unique por segurança:
-- pode haver CPF nulo ou duplicado histórico).
CREATE INDEX IF NOT EXISTS idx_funcionarios_cpf ON funcionarios(cpf);
