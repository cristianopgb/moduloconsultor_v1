/*
  # Add service role policies for all consultor tables

  1. Changes
    - Service role can manage all records in all tables
    - This allows edge functions to work properly
  
  2. Security
    - Service role is already restricted in Supabase
    - Users still have their own restrictive policies
*/

-- consultor_mensagens
DROP POLICY IF EXISTS "Service role full access messages" ON consultor_mensagens;
CREATE POLICY "Service role full access messages"
  ON consultor_mensagens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- timeline_consultor
DROP POLICY IF EXISTS "Service role full access timeline" ON timeline_consultor;
CREATE POLICY "Service role full access timeline"
  ON timeline_consultor FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- entregaveis_consultor  
DROP POLICY IF EXISTS "Service role full access entregaveis" ON entregaveis_consultor;
CREATE POLICY "Service role full access entregaveis"
  ON entregaveis_consultor FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- orquestrador_acoes
DROP POLICY IF EXISTS "Service role full access orch" ON orquestrador_acoes;
CREATE POLICY "Service role full access orch"
  ON orquestrador_acoes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
