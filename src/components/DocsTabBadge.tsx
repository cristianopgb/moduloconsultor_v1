import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";

// Tabela de entregáveis do seu backend
const DELIVERABLES_TABLE = "entregaveis_consultor";

export function useNewDeliverableSignal(
  supabase: SupabaseClient,
  jornadaId: string,
  isActiveTab: boolean
) {
  const [hasNew, setHasNew] = useState(false);

  // quando o usuário entra na aba, limpamos a badge
  useEffect(() => {
    if (isActiveTab && hasNew) setHasNew(false);
  }, [isActiveTab, hasNew]);

  // realtime: quando inserir entregável da jornada, liga a badge
  useEffect(() => {
    const channel = supabase
      .channel(`docs:${jornadaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: DELIVERABLES_TABLE,
          filter: `jornada_id=eq.${jornadaId}`,
        },
        () => setHasNew(true)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, jornadaId]);

  return { hasNew, clear: () => setHasNew(false) };
}

export function DocsTabBadge({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0, y: -6 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0, y: -6 }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
          className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[10px] font-medium"
        >
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
          novo
        </motion.span>
      )}
    </AnimatePresence>
  );
}
