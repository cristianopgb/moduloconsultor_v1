/*
  # Backfill Jornadas para Sessões Existentes

  1. Objetivo
    - Criar jornadas para todas as sessões que não tem jornada_id
    - Vincular automaticamente cada sessão à sua jornada
    - Garantir integridade referencial

  2. Alterações
    - Insere jornadas_consultor para sessões órfãs
    - Atualiza consultor_sessoes.jornada_id
    - Mantém consistência de dados

  3. Segurança
    - Opera apenas em sessões com jornada_id null
    - Preserva dados existentes
    - Transação atômica
*/

-- Criar jornadas para sessões que não têm jornada_id
DO $$
DECLARE
  v_sessao RECORD;
  v_jornada_id uuid;
BEGIN
  -- Iterar sobre sessões sem jornada
  FOR v_sessao IN
    SELECT
      id,
      user_id,
      conversation_id,
      empresa,
      estado_atual,
      contexto_negocio,
      progresso
    FROM consultor_sessoes
    WHERE jornada_id IS NULL
    ORDER BY created_at
  LOOP
    -- Criar jornada para essa sessão
    INSERT INTO jornadas_consultor (
      user_id,
      conversation_id,
      empresa_nome,
      etapa_atual,
      dados_anamnese,
      areas_priorizadas,
      progresso_geral,
      created_at,
      updated_at
    )
    VALUES (
      v_sessao.user_id,
      v_sessao.conversation_id,
      COALESCE(v_sessao.empresa, 'Empresa'),
      COALESCE(v_sessao.estado_atual, 'anamnese'),
      COALESCE(v_sessao.contexto_negocio, '{}'::jsonb),
      '[]'::jsonb,
      COALESCE(v_sessao.progresso, 0),
      now(),
      now()
    )
    RETURNING id INTO v_jornada_id;

    -- Vincular jornada à sessão
    UPDATE consultor_sessoes
    SET jornada_id = v_jornada_id
    WHERE id = v_sessao.id;

    RAISE NOTICE 'Created jornada % for sessao %', v_jornada_id, v_sessao.id;
  END LOOP;

  -- Estatísticas
  RAISE NOTICE 'Backfill completed. Total sessões processed: %',
    (SELECT COUNT(*) FROM consultor_sessoes WHERE jornada_id IS NOT NULL);
END $$;

-- Verificação final
DO $$
DECLARE
  v_count_orfas integer;
BEGIN
  SELECT COUNT(*) INTO v_count_orfas
  FROM consultor_sessoes
  WHERE jornada_id IS NULL;

  IF v_count_orfas > 0 THEN
    RAISE WARNING 'Still % sessões without jornada_id!', v_count_orfas;
  ELSE
    RAISE NOTICE '✓ All sessões now have jornada_id linked';
  END IF;
END $$;
