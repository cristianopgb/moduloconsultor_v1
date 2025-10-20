// web/src/components/Consultor/Gamificacao/useGamificacaoPorJornada.ts
// Hook para carregar e ouvir a gamificação **da jornada atual** (isolada por jornada_id).
// Não cria linhas novas; apenas lê/escuta a tabela existente.

import { useEffect, useState, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';

export type Gamificacao = { xp_total: number; nivel: number };

export function useGamificacaoPorJornada(jornadaId: string | null) {
  const [gami, setGami] = useState<Gamificacao>({ xp_total: 0, nivel: 1 });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSetRef = useRef<string>('0|1'); // evita setState redundante: `${xp}|${nivel}`

  // Carrega uma vez ao entrar/trocar de jornada
  useEffect(() => {
    let canceled = false;

    async function load() {
      if (!jornadaId) {
        if (!canceled) {
          lastSetRef.current = '0|1';
          setGami({ xp_total: 0, nivel: 1 });
        }
        return;
      }

      const { data, error } = await supabase
        .from('gamificacao_consultor')
        .select('xp_total, nivel')
        .eq('jornada_id', jornadaId) // isolamento por conversa
        .maybeSingle();

      if (canceled) return;

      if (error) {
        // Em caso de jornada nova sem linha de gamificação, apenas zera visualmente
        setGami({ xp_total: 0, nivel: 1 });
        lastSetRef.current = '0|1';
        return;
      }

      const xp = data?.xp_total ?? 0;
      const nivel = data?.nivel ?? 1;
      const key = `${xp}|${nivel}`;
      if (key !== lastSetRef.current) {
        lastSetRef.current = key;
        setGami({ xp_total: xp, nivel });
      }
    }

    load();

    return () => {
      canceled = true;
    };
  }, [jornadaId]);

  // Realtime apenas da jornada atual
  useEffect(() => {
    // limpa canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!jornadaId) return;

    const ch = supabase
      .channel(`gami_jornada_${jornadaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gamificacao_consultor',
          filter: `jornada_id=eq.${jornadaId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { xp_total?: number; nivel?: number; jornada_id?: string } | undefined;
          if (!row || row.jornada_id !== jornadaId) return;

          const xp = row.xp_total ?? 0;
          const nivel = row.nivel ?? 1;
          const key = `${xp}|${nivel}`;
          if (key !== lastSetRef.current) {
            lastSetRef.current = key;
            setGami({ xp_total: xp, nivel });
          }
        }
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [jornadaId]);

  return gami;
}
