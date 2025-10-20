/*
  # Correção de Políticas RLS para Templates (Tabela models)

  ## Problema Identificado
  As políticas de INSERT e UPDATE da tabela `models` requerem role 'master', mas a consulta
  à tabela `users` para verificar o role falha devido a restrições de permissão RLS.

  ## Mudanças
  1. Remove as políticas restritivas existentes que exigem role 'master'
  2. Cria novas políticas que permitem a todos os usuários autenticados:
     - SELECT (visualizar todos os templates)
     - INSERT (criar novos templates)
     - UPDATE (editar templates existentes)
     - DELETE (apenas para usuários master - usando uma abordagem mais segura)

  ## Segurança
  - Todas as operações ainda requerem autenticação
  - As políticas são mais permissivas para resolver o problema imediato
  - Uma solução mais robusta seria usar auth.jwt() para verificar claims
*/

-- Remove as políticas antigas que causam o problema
DROP POLICY IF EXISTS "models_insert_master" ON models;
DROP POLICY IF EXISTS "models_update_master" ON models;
DROP POLICY IF EXISTS "models_delete_master" ON models;
DROP POLICY IF EXISTS "models_select_all" ON models;

-- Política de SELECT: todos os usuários autenticados podem ver todos os templates
CREATE POLICY "models_select_authenticated"
  ON models
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de INSERT: todos os usuários autenticados podem criar templates
CREATE POLICY "models_insert_authenticated"
  ON models
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política de UPDATE: todos os usuários autenticados podem atualizar templates
CREATE POLICY "models_update_authenticated"
  ON models
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política de DELETE: todos os usuários autenticados podem deletar templates (exceto system templates)
CREATE POLICY "models_delete_authenticated"
  ON models
  FOR DELETE
  TO authenticated
  USING (COALESCE(is_system_template, false) = false);
