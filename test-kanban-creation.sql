-- Script de Teste: Criação Manual de Kanban Cards
-- Execute este script no SQL Editor do Supabase Dashboard após aplicar a migration

-- 1. Buscar uma sessão existente (substitua o user_id pelo seu)
DO $$
DECLARE
  v_sessao_id uuid;
  v_jornada_id uuid;
  v_acao_id uuid;
BEGIN
  -- Buscar primeira sessão disponível
  SELECT id, jornada_id INTO v_sessao_id, v_jornada_id
  FROM consultor_sessoes
  WHERE ativo = true
  LIMIT 1;

  IF v_sessao_id IS NULL THEN
    RAISE NOTICE 'Nenhuma sessão ativa encontrada';
    RETURN;
  END IF;

  RAISE NOTICE 'Sessão encontrada: % | Jornada: %', v_sessao_id, v_jornada_id;

  -- Criar uma ação de teste em acoes_plano
  INSERT INTO acoes_plano (
    sessao_id,
    area_id,  -- Agora pode ser NULL
    what,
    why,
    where_field,
    who,
    how,
    how_much,
    status,
    prioridade
  ) VALUES (
    v_sessao_id,
    NULL,  -- Testando com NULL
    'Teste de Ação para Kanban',
    'Validar criação de cards',
    'Sistema',
    'Desenvolvedor',
    'Executar teste manual',
    'Sem custo',
    'a_fazer',
    'alta'
  )
  RETURNING id INTO v_acao_id;

  RAISE NOTICE 'Ação criada: %', v_acao_id;

  -- Criar card no Kanban
  INSERT INTO kanban_cards (
    sessao_id,
    jornada_id,
    area_id,  -- Pode ser NULL
    titulo,
    descricao,
    responsavel,
    prazo,
    status,  -- Testando com 'todo'
    ordem,
    dados_5w2h
  ) VALUES (
    v_sessao_id,
    v_jornada_id,
    NULL,  -- Testando com NULL
    'Teste de Card Kanban',
    'Este é um card de teste para validar a criação',
    'Desenvolvedor',
    '+7d',
    'todo',  -- Novo constraint permite este valor
    1,
    jsonb_build_object(
      'o_que', 'Teste de Ação',
      'por_que', 'Validar sistema',
      'quem', 'Desenvolvedor',
      'quando', '+7d',
      'onde', 'Sistema',
      'como', 'Teste manual',
      'quanto', 'Sem custo'
    )
  );

  RAISE NOTICE 'Card criado com sucesso!';

  -- Verificar criação
  RAISE NOTICE 'Total de cards na sessão: %', (
    SELECT COUNT(*) FROM kanban_cards WHERE sessao_id = v_sessao_id
  );

  RAISE NOTICE 'Total de ações na sessão: %', (
    SELECT COUNT(*) FROM acoes_plano WHERE sessao_id = v_sessao_id
  );

END $$;

-- 2. Consultar os cards criados
SELECT
  kc.id,
  kc.titulo,
  kc.status,
  kc.responsavel,
  kc.prazo,
  kc.sessao_id,
  kc.jornada_id,
  kc.created_at
FROM kanban_cards kc
ORDER BY kc.created_at DESC
LIMIT 5;

-- 3. Consultar as ações criadas
SELECT
  ap.id,
  ap.what,
  ap.status,
  ap.who,
  ap.sessao_id,
  ap.area_id,  -- Deve aceitar NULL agora
  ap.created_at
FROM acoes_plano ap
ORDER BY ap.created_at DESC
LIMIT 5;
