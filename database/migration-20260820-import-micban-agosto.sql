-- Migration: Importação de Contratos Micban (Agosto 2026)
-- Objetivo: Injeção direta de 6 contratos via SQL one-shot para evitar falhas no script Bun/Node.
-- Esta migration é protegida por um CHECK de existência para rodar apenas uma vez com sucesso.

DO $$
DECLARE
    v_company_id UUID;
    v_customer_id UUID;
    v_next_num TEXT;
BEGIN
    -- 1. Garantir Empresa Emissora (Micban)
    SELECT id INTO v_company_id FROM public.erp_companies 
    WHERE document = '42.264.001/0001-93' OR razao_social ILIKE '%MIC BAN LOCACOES%' LIMIT 1;

    IF v_company_id IS NULL THEN
        v_company_id := gen_random_uuid();
        INSERT INTO public.erp_companies (id, razao_social, nome_fantasia, document, sigla, ativo, created_at, updated_at)
        VALUES (v_company_id, 'MIC BAN LOCACOES & SERVICOS LTDA', 'MIC BAN', '42.264.001/0001-93', 'MIC', TRUE, NOW(), NOW());
    END IF;

    -- 2. Inserção dos Contratos (Verificando duplicidade por origem/descrição/valor)
    
    -- Contrato 1: FLAT ENGENHARIA (1)
    IF NOT EXISTS (SELECT 1 FROM public.erp_contracts WHERE company_id = v_company_id AND descricao = 'Locação Mensal - Sanitário Comum' AND valor_mensal = 1100.00 AND origem = 'sql_import_agosto_v1') THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE document = '22.091.248/0001-04' OR customer_name ILIKE 'FLAT ENGENHARIA%' LIMIT 1;
        IF v_customer_id IS NULL THEN
            v_customer_id := gen_random_uuid();
            INSERT INTO public.customers (id, customer_name, document, person_type, created_at, updated_at)
            VALUES (v_customer_id, 'FLAT ENGENHARIA E CONSTRUÇÃO LTDA', '22.091.248/0001-04', 'PJ', NOW(), NOW());
        END IF;
        SELECT erp_next_doc_number('CTR', v_company_id) INTO v_next_num;
        INSERT INTO public.erp_contracts (numero, company_id, customer_id, descricao, tipo_contrato, data_inicio, dia_vencimento, valor_mensal, ativo, origem, metadata)
        VALUES (v_next_num, v_company_id, v_customer_id, 'Locação Mensal - Sanitário Comum', 'locacao', '2026-08-01', 15, 1100.00, TRUE, 'sql_import_agosto_v1', '{"quantidade": 1, "tipo_item": "Sanitário Comum"}');
    END IF;

    -- Contrato 2: FLAT ENGENHARIA (2) - Nota: Se forem dois contratos idênticos, a lógica de NOT EXISTS acima pode falhar se não tivermos ID único.
    -- Para evitar duplicidade errônea, usamos o contador de registros atuais.
    IF (SELECT COUNT(*) FROM public.erp_contracts WHERE company_id = v_company_id AND customer_id = (SELECT id FROM public.customers WHERE document = '22.091.248/0001-04') AND valor_mensal = 1100.00 AND origem = 'sql_import_agosto_v1') < 2 THEN
        SELECT erp_next_doc_number('CTR', v_company_id) INTO v_next_num;
        INSERT INTO public.erp_contracts (numero, company_id, customer_id, descricao, tipo_contrato, data_inicio, dia_vencimento, valor_mensal, ativo, origem, metadata)
        VALUES (v_next_num, v_company_id, v_customer_id, 'Locação Mensal - Sanitário Comum', 'locacao', '2026-08-01', 15, 1100.00, TRUE, 'sql_import_agosto_v1', '{"quantidade": 1, "tipo_item": "Sanitário Comum"}');
    END IF;

    -- Contrato 3: CONSTRUTORA SERVCOPA
    IF NOT EXISTS (SELECT 1 FROM public.erp_contracts WHERE company_id = v_company_id AND descricao = 'Locação Mensal - Sanitário Comum' AND valor_mensal = 1960.00 AND origem = 'sql_import_agosto_v1') THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE document = '21.054.432/0001-07' OR customer_name ILIKE 'CONSTRUTORA SERVCOPA%' LIMIT 1;
        IF v_customer_id IS NULL THEN
            v_customer_id := gen_random_uuid();
            INSERT INTO public.customers (id, customer_name, document, person_type, created_at, updated_at)
            VALUES (v_customer_id, 'CONSTRUTORA SERVCOPA EIRELI', '21.054.432/0001-07', 'PJ', NOW(), NOW());
        END IF;
        SELECT erp_next_doc_number('CTR', v_company_id) INTO v_next_num;
        INSERT INTO public.erp_contracts (numero, company_id, customer_id, descricao, tipo_contrato, data_inicio, dia_vencimento, valor_mensal, ativo, origem, metadata)
        VALUES (v_next_num, v_company_id, v_customer_id, 'Locação Mensal - Sanitário Comum', 'locacao', '2026-08-01', 22, 1960.00, TRUE, 'sql_import_agosto_v1', '{"quantidade": 1, "tipo_item": "Sanitário Comum"}');
    END IF;

    -- Contrato 4: CONSTRUTORA RNV (Carretinhas)
    IF NOT EXISTS (SELECT 1 FROM public.erp_contracts WHERE company_id = v_company_id AND descricao LIKE 'Aluguel de Carretinha%' AND valor_mensal = 2000.00 AND origem = 'sql_import_agosto_v1') THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE document = '07.135.295/0001-37' OR customer_name ILIKE 'CONSTRUTORA RNV%' LIMIT 1;
        IF v_customer_id IS NULL THEN
            v_customer_id := gen_random_uuid();
            INSERT INTO public.customers (id, customer_name, document, person_type, created_at, updated_at)
            VALUES (v_customer_id, 'CONSTRUTORA RNV LTDA', '07.135.295/0001-37', 'PJ', NOW(), NOW());
        END IF;
        SELECT erp_next_doc_number('CTR', v_company_id) INTO v_next_num;
        INSERT INTO public.erp_contracts (numero, company_id, customer_id, descricao, tipo_contrato, data_inicio, dia_vencimento, valor_mensal, ativo, origem, metadata)
        VALUES (v_next_num, v_company_id, v_customer_id, 'Aluguel de Carretinha - Placas RGD-9D72, RGD-9D70, RGD-9D71, RTK6A34', 'locacao', '2026-08-01', 10, 2000.00, TRUE, 'sql_import_agosto_v1', '{"quantidade": 4, "tipo_item": "Carretinha"}');
    END IF;

    -- Contrato 5: CONSTRUTORA RNV (Sanitário)
    IF NOT EXISTS (SELECT 1 FROM public.erp_contracts WHERE company_id = v_company_id AND descricao = 'Locação Mensal - Sanitário Comum' AND valor_mensal = 1400.00 AND origem = 'sql_import_agosto_v1') THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE document = '07.135.295/0001-37' OR customer_name ILIKE 'CONSTRUTORA RNV%' LIMIT 1;
        SELECT erp_next_doc_number('CTR', v_company_id) INTO v_next_num;
        INSERT INTO public.erp_contracts (numero, company_id, customer_id, descricao, tipo_contrato, data_inicio, dia_vencimento, valor_mensal, ativo, origem, metadata)
        VALUES (v_next_num, v_company_id, v_customer_id, 'Locação Mensal - Sanitário Comum', 'locacao', '2026-08-01', 10, 1400.00, TRUE, 'sql_import_agosto_v1', '{"quantidade": 1, "tipo_item": "Sanitário Comum"}');
    END IF;

    -- Contrato 6: SUPERMERCADOS BH
    IF NOT EXISTS (SELECT 1 FROM public.erp_contracts WHERE company_id = v_company_id AND customer_id IN (SELECT id FROM public.customers WHERE customer_name ILIKE 'SUPERMERCADOS BH%') AND valor_mensal = 450.00 AND origem = 'sql_import_agosto_v1') THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE document = '04.641.376/0001-36' OR customer_name ILIKE 'SUPERMERCADOS BH%' LIMIT 1;
        IF v_customer_id IS NULL THEN
            v_customer_id := gen_random_uuid();
            INSERT INTO public.customers (id, customer_name, document, person_type, created_at, updated_at)
            VALUES (v_customer_id, 'SUPERMERCADOS BH COMERCIO DE ALIMENTOS S/A', '04.641.376/0001-36', 'PJ', NOW(), NOW());
        END IF;
        SELECT erp_next_doc_number('CTR', v_company_id) INTO v_next_num;
        INSERT INTO public.erp_contracts (numero, company_id, customer_id, descricao, tipo_contrato, data_inicio, dia_vencimento, valor_mensal, ativo, origem, metadata)
        VALUES (v_next_num, v_company_id, v_customer_id, 'Locação Mensal - Sanitário Comum', 'locacao', '2026-08-01', 20, 450.00, TRUE, 'sql_import_agosto_v1', '{"quantidade": 1, "tipo_item": "Sanitário Comum"}');
    END IF;

END $$;
