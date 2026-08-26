-- ============================================================================
-- IMPORTAÇÃO ONE-SHOT: CONSTRUTORA DRAGAGEM PARAOPEBA LTDA — Setembro/2026
-- Emissora: MIC BAN (nas duas planilhas)
--
-- Origem 1: "PARAOPEBA CAPINA.xlsx" — aba SETEMBRO 26 (14 itens, R$ 47.600,00)
--           Períodos que não alcançavam setembro foram deslocados +1 mês.
-- Origem 2: "PLANILHA PARAOPEBA - COBRANÇA - 2024.xlsx" — aba AGOSTO 26
--           (17 itens, R$ 29.220,00). Todos os períodos deslocados +1 mês
--           (agosto -> setembro), conforme solicitado.
--
-- Todos os contratos entram com primeira_competencia = '2026-09', ou seja:
-- só começam a ser faturados em setembro/2026 (agosto já foi faturado fora
-- do sistema), e seguem o ciclo mensal normal a partir daí.
--
-- Idempotência: chave "[import:paraopeba-set26#N]" em observacoes.
-- O deploy.sh executa este arquivo UMA única vez (marca de sucesso em
-- database/.imported-paraopeba-set26).
-- ============================================================================

DO $$
DECLARE
  v_company uuid;
  v_company_snap jsonb;
  v_customer uuid;
  v_customer_snap jsonb;
  r RECORD;
  v_inseridos int := 0;
BEGIN
  -- -------------------------------------------------------------------------
  -- 0) Empresa emissora MIC BAN (cria se não existir)
  -- -------------------------------------------------------------------------
  SELECT id INTO v_company
    FROM erp_companies
   WHERE regexp_replace(COALESCE(cnpj,''), '\D', '', 'g') = '42264001000193'
      OR razao_social ILIKE '%MIC%BAN%'
      OR COALESCE(nome_fantasia,'') ILIKE '%MIC%BAN%'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_company IS NULL THEN
    INSERT INTO erp_companies (razao_social, nome_fantasia, cnpj, ativo)
    VALUES ('MIC BAN LOCACOES & SERVICOS LTDA', 'MIC BAN', '42.264.001/0001-93', TRUE)
    RETURNING id INTO v_company;
    RAISE NOTICE 'Empresa emissora MIC BAN criada: %', v_company;
  END IF;

  SELECT to_jsonb(e) INTO v_company_snap FROM erp_companies e WHERE e.id = v_company;

  -- -------------------------------------------------------------------------
  -- 1) Cliente único das duas planilhas (match por CNPJ, depois nome)
  -- -------------------------------------------------------------------------
  SELECT id INTO v_customer
    FROM customers
   WHERE regexp_replace(COALESCE(document,''), '\D', '', 'g') = '18322925000114'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_customer IS NULL THEN
    SELECT id INTO v_customer
      FROM customers
     WHERE customer_name ILIKE '%PARAOPEBA%'
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;

  IF v_customer IS NULL THEN
    INSERT INTO customers (customer_name, document, person_type, address, notes)
    VALUES ('CONSTRUTORA DRAGAGEM PARAOPEBA LTDA',
            '18.322.925/0001-14',
            'PJ',
            'RODOVIA BR 040, KM 523,5, LOTE A, B: GUANABARA, CONTAGEM-MG, CEP: 32150-340',
            '[import:paraopeba-set26]')
    RETURNING id INTO v_customer;
    RAISE NOTICE 'Cliente PARAOPEBA criado: %', v_customer;
  ELSE
    UPDATE customers
       SET document = '18.322.925/0001-14', updated_at = NOW()
     WHERE id = v_customer
       AND COALESCE(btrim(document), '') = '';
  END IF;

  SELECT to_jsonb(c) INTO v_customer_snap FROM customers c WHERE c.id = v_customer;

  -- -------------------------------------------------------------------------
  -- 2) Itens das duas planilhas (períodos já ajustados para setembro/2026)
  -- -------------------------------------------------------------------------
  FOR r IN (
    SELECT * FROM (VALUES
      -- ===== PARAOPEBA CAPINA — aba SETEMBRO 26 (unit. R$ 1.700,00) =====
      (1,  'Locação Mensal - Sanitário Comum (2 un.) + Capina/Limpeza', 3400.00,  DATE '2026-08-10', DATE '2026-09-09', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (2,  'Locação Mensal - Sanitário Comum (2 un.) + Capina/Limpeza', 3400.00,  DATE '2026-08-30', DATE '2026-09-29', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (3,  'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-09-01', DATE '2026-09-30', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (4,  'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-08-26', DATE '2026-09-25', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (5,  'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-08-25', DATE '2026-09-24', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (6,  'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-08-21', DATE '2026-09-20', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (7,  'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-08-18', DATE '2026-09-17', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (8,  'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-08-06', DATE '2026-09-05', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (9,  'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-08-24', DATE '2026-09-23', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (10, 'Locação Mensal - Sanitário Comum (3 un.) + Capina/Limpeza', 5100.00,  DATE '2026-08-27', DATE '2026-09-26', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (11, 'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-08-03', DATE '2026-09-02', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Período original 03/07 a 02/08 deslocado +1 mês | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (12, 'Locação Mensal - Sanitário Comum (5 un.) + Capina/Limpeza', 8500.00,  DATE '2026-08-24', DATE '2026-09-23', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Período original 24/07 a 23/08 deslocado +1 mês | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (13, 'Locação Mensal - Sanitário Comum (7 un.) + Capina/Limpeza', 11900.00, DATE '2026-08-21', DATE '2026-09-20', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Período original 21/07 a 20/08 deslocado +1 mês | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),
      (14, 'Locação Mensal - Sanitário Comum (1 un.) + Capina/Limpeza', 1700.00,  DATE '2026-08-19', DATE '2026-09-18', 'ATERRO SANITÁRIO DE CONTAGEM', '5 LIMPEZAS POR SEMANA | NF: 215 | Período original 19/07 a 18/08 deslocado +1 mês | Planilha: PARAOPEBA CAPINA · SETEMBRO 26'),

      -- ===== PLANILHA PARAOPEBA COBRANÇA — aba AGOSTO 26 (períodos +1 mês) =====
      (15, 'Locação Mensal - Sanitário Comum (1 un.)', 1500.00, DATE '2026-09-18', DATE '2026-10-17', 'RUA JATOBA 242, VALE DO SERENO - NOVA LIMA', 'ENCARREGADO DEMETRIUS | NF: 205 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (16, 'Locação Mensal - Sanitário Comum (1 un.)', 1500.00, DATE '2026-09-16', DATE '2026-10-15', 'BANDEIRINHAS - BETIM - PREMOLDADOS SAMPAIO', 'ENCARREGADO ADRIANO | NF: 207 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (17, 'Locação Mensal - Sanitário Comum (1 un.)', 980.00,  DATE '2026-09-23', DATE '2026-10-22', 'RUA MARIA DA CONCEIÇÃO DE SÃO JOSÉ 281, CENTRO, CONTAGEM - MG, 32041-290', 'NF: 212 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (18, 'Locação Mensal - Sanitário Comum (1 un.)', 980.00,  DATE '2026-10-01', DATE '2026-10-30', 'RUA MONTE CASTELO 1784, VILA REAL (JUSTINÓPOLIS), RIBEIRÃO DAS NEVES', 'ENCARREGADO YURE | NF: 211 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (19, 'Locação Mensal - Sanitário Comum (1 un.)', 1500.00, DATE '2026-09-18', DATE '2026-10-17', 'Pousada Mar Mineiro, Estrada da Servidão, 71 - Macacos, Nova Lima - MG, 34019-899', 'ENCARREGADO DEMETRIUS | NF: 205 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (20, 'Locação Mensal - Sanitário Comum (1 un.)', 1400.00, DATE '2026-10-02', DATE '2026-11-01', 'RUA SAPUCAI 74, VALE DO SERENO, NOVA LIMA - MG', 'ENCARREGADO DEMETRIUS | NF: 205 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (21, 'Locação Mensal - Sanitário Comum (1 un.)', 1300.00, DATE '2026-09-30', DATE '2026-10-29', 'GARUJÁ MANSÕES', 'ENCARREGADO MAGNO | NF: 210 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (22, 'Locação Mensal - Sanitário Comum (1 un.)', 1300.00, DATE '2026-09-15', DATE '2026-10-14', 'RUA DA VEREDA, VILA DA SERRA, NOVA LIMA', 'ENCARREGADO DEMETRIUS | NF: 205 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (23, 'Locação Mensal - Sanitário Comum (2 un.)', 1960.00, DATE '2026-09-09', DATE '2026-10-08', 'RUA WALTER DIAS RIBEIRO 41, VIENA, JUSTINÓPOLIS, RIBEIRÃO DAS NEVES', 'ENCARREGADO YURE | NF: 211 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (24, 'Locação Mensal - Sanitário Comum (1 un.)', 1200.00, DATE '2026-09-09', DATE '2026-10-08', 'R. Cinco, 300-561 - Chácara São Geraldo, Contagem - MG', 'NF: 214 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (25, 'Locação Mensal - Sanitário Comum (1 un.)', 1300.00, DATE '2026-10-05', DATE '2026-11-04', 'Rua Levi Diniz Costa, Quintas Coloniais, Contagem - MG', 'ENCARREGADO IGOR MONTE VERDE | NF: 208 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (26, 'Locação Mensal - Sanitário Comum (1 un.)', 1300.00, DATE '2026-10-05', DATE '2026-11-04', 'Rua Cinco, 23, Chácaras São Geraldo, Contagem - MG', 'ENCARREGADO IGOR MONTE VERDE | NF: 209 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (27, 'Locação Mensal - Sanitário Comum (4 un.)', 5200.00, DATE '2026-09-25', DATE '2026-10-24', 'RUA DOS ARTÍFICES 63, A DEFINIR EM CAMPO, ÁGUA LIMPA', 'ENCARREGADO DEMETRIUS | NF: 205 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (28, 'Locação Mensal - Sanitário Comum (1 un.)', 1300.00, DATE '2026-09-21', DATE '2026-10-20', 'ÁGUA LIMPA, NOVA LIMA', 'ENCARREGADO DEMETRIUS | NF: 205 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (29, 'Locação Mensal - Sanitário Comum (1 un.)', 1300.00, DATE '2026-09-09', DATE '2026-10-08', 'BETIM - MG', 'ENCARREGADO DEMETRIUS | NF: 206 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (30, 'Locação Mensal - Sanitário Comum (1 un.)', 1300.00, DATE '2026-09-10', DATE '2026-10-09', 'VALE DAS ACÁCIAS, RIBEIRÃO DAS NEVES', 'ENCARREGADO YURE | NF: 211 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)'),
      (31, 'Locação Mensal - Sanitário Comum (3 un.)', 3900.00, DATE '2026-09-01', DATE '2026-09-30', 'ÁGUA LIMPA, NOVA LIMA', 'ENCARREGADO DEMETRIUS | NF: 205 | Planilha COBRANÇA · AGOSTO 26 (período deslocado +1 mês)')
    ) AS v(idx, descricao, valor_mensal, periodo_inicio, periodo_fim, endereco_obra, obs_extra)
  ) LOOP
    INSERT INTO erp_contracts
      (numero, company_id, customer_id, origem, descricao,
       data_inicio, dia_vencimento, valor_mensal,
       renovacao_automatica, ativo, endereco_obra, observacoes,
       primeira_competencia, company_snapshot, customer_snapshot)
    SELECT
      erp_next_doc_number('CTR', v_company),
      v_company,
      v_customer,
      'excel_import_paraopeba_setembro',
      r.descricao,
      r.periodo_inicio,
      EXTRACT(DAY FROM r.periodo_inicio)::int,
      r.valor_mensal,
      TRUE,
      TRUE,
      NULLIF(r.endereco_obra, ''),
      concat_ws(' | ',
                NULLIF(r.obs_extra, ''),
                format('Período cobrança: %s a %s',
                       to_char(r.periodo_inicio, 'DD/MM/YYYY'),
                       to_char(r.periodo_fim, 'DD/MM/YYYY')),
                'Cliente planilha: CONSTRUTORA DRAGAGEM PARAOPEBA LTDA (CNPJ 18.322.925/0001-14)',
                format('[import:paraopeba-set26#%s]', r.idx)),
      '2026-09',
      v_company_snap,
      v_customer_snap
    WHERE NOT EXISTS (
      SELECT 1 FROM erp_contracts ec
       WHERE ec.observacoes LIKE format('%%[import:paraopeba-set26#%s]%%', r.idx)
    );
    IF FOUND THEN v_inseridos := v_inseridos + 1; END IF;
  END LOOP;

  RAISE NOTICE 'Importação PARAOPEBA set/26: % novo(s) contrato(s).', v_inseridos;
END $$;

-- Relatório final (aparece no log do deploy)
SELECT COUNT(*) AS contratos_paraopeba_setembro,
       COALESCE(SUM(valor_mensal), 0) AS total_mensal
  FROM erp_contracts
 WHERE COALESCE(observacoes,'') LIKE '%[import:paraopeba-set26#%';
