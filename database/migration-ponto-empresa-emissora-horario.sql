-- Ponto Digital — vincula empresa emissora (do ERP) e permite hora sugerida na justificativa.
ALTER TABLE ponto_settings
  ADD COLUMN IF NOT EXISTS empresa_emissora_id UUID REFERENCES erp_companies(id) ON DELETE SET NULL;

ALTER TABLE ponto_justifications
  ADD COLUMN IF NOT EXISTS horario TIME NULL;
