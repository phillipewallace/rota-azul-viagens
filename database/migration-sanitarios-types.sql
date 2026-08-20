-- Garantir colunas na tabela sanitarios
ALTER TABLE public.sanitarios ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'comum';
ALTER TABLE public.sanitarios ADD COLUMN IF NOT EXISTS tipo_locacao_alvo TEXT;
ALTER TABLE public.sanitarios ADD COLUMN IF NOT EXISTS estado_atual TEXT DEFAULT 'bom';

-- Tabela de tipos (categorias) de sanitários para o dropdown
CREATE TABLE IF NOT EXISTS public.erp_sanitario_tipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir tipos padrão se vazia
INSERT INTO public.erp_sanitario_tipos (nome)
VALUES 
('Comum'),
('PNE'),
('Pia'),
('Luxo'),
('Banho'),
('Rede Esgoto')
ON CONFLICT (nome) DO NOTHING;

-- Garantir GRANTs (conforme regras do sistema)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sanitarios TO authenticated;
GRANT ALL ON public.sanitarios TO service_role;
GRANT SELECT ON public.erp_sanitario_tipos TO authenticated;
GRANT ALL ON public.erp_sanitario_tipos TO service_role;
