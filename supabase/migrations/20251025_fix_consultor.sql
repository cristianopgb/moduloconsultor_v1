-- =====================================================================
-- MIGRAÇÃO: Correções Consultor
-- - entregaveis_consultor.updated_at + trigger
-- - timeline_consultor padronizada com tipo_evento
-- - RPC utilitária para registrar timeline
-- - NOTIFY pgrst para recarregar cache do PostgREST
-- Data: 2025-10-25
-- =====================================================================

-- 1) ENTREGÁVEIS: garantir coluna updated_at e trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='entregaveis_consultor'
       AND column_name='updated_at'
  ) THEN
    ALTER TABLE public.entregaveis_consultor
      ADD COLUMN updated_at timestamptz;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_entregaveis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entregaveis_updated_at_trigger ON public.entregaveis_consultor;
CREATE TRIGGER entregaveis_updated_at_trigger
  BEFORE UPDATE ON public.entregaveis_consultor
  FOR EACH ROW EXECUTE FUNCTION public.update_entregaveis_updated_at();

-- backfill
UPDATE public.entregaveis_consultor
   SET updated_at = COALESCE(updated_at, now());

-- 2) TIMELINE: padronizar para tipo_evento
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='timeline_consultor'
       AND column_name='evento'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='timeline_consultor'
       AND column_name='tipo_evento'
  ) THEN
    ALTER TABLE public.timeline_consultor
      RENAME COLUMN evento TO tipo_evento;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='timeline_consultor'
       AND column_name='tipo_evento'
  ) THEN
    ALTER TABLE public.timeline_consultor
      ADD COLUMN tipo_evento text NOT NULL DEFAULT 'generico';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='timeline_consultor'
       AND column_name='detalhe'
  ) THEN
    ALTER TABLE public.timeline_consultor
      ADD COLUMN detalhe jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='timeline_consultor'
       AND column_name='fase'
  ) THEN
    ALTER TABLE public.timeline_consultor
      ADD COLUMN fase text;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_timeline_consultor_jornada_ts
  ON public.timeline_consultor (jornada_id, created_at DESC);

-- 3) RPC utilitária para registrar eventos de timeline de forma consistente
CREATE OR REPLACE FUNCTION public.consultor_register_timeline(
  p_jornada_id uuid,
  p_tipo_evento text,
  p_fase text,
  p_detalhe jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.timeline_consultor (jornada_id, tipo_evento, fase, detalhe)
  VALUES (p_jornada_id, p_tipo_evento, p_fase, p_detalhe);
END;
$$;

-- 4) Forçar reload do PostgREST (evita cache de esquema desatualizado)
NOTIFY pgrst, 'reload schema';
