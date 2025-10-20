// /src/hooks/useAgentStream.ts
import { useEffect, useRef, useState } from 'react';

type AgentState = 'idle' | 'streaming' | 'done' | 'error';

type StartOptions = {
  url: string; // SSE URL com query param ?auth=TOKEN (Edge Function precisa aceitar)
};

export function useAgentStream() {
  const [state, setState] = useState<AgentState>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ html?: string } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function append(line: string) {
    setLog((prev) => [...prev, line]);
  }

  function start(opts: StartOptions) {
    close();
    setState('streaming');
    setError(null);
    setDone(null);
    append('[DEBUG] useAgentStream.start: ' + opts.url);

    const es = new EventSource(opts.url);
    esRef.current = es;

    es.onmessage = (ev) => {
      // Protocolo simples: data com JSON {event,type,chunk,html}
      try {
        const data = JSON.parse(ev.data);
        if (data.event === 'log') {
          append('[AGENT] ' + (data.message || ''));
        } else if (data.event === 'chunk') {
          append('[CHUNK] ' + (data.size || 0) + ' bytes');
        } else if (data.event === 'done') {
          append('[DONE] html recebido');
          setDone({ html: data.html });
          setState('done');
          close();
        }
      } catch (e) {
        append('[WARN] Evento não-JSON recebido');
      }
    };

    es.onerror = (err) => {
      console.error('[DEBUG] SSE error', err);
      setError('Falha no streaming da geração.');
      setState('error');
      close();
    };
  }

  function close() {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      append('[DEBUG] SSE fechado');
    }
  }

  useEffect(() => () => close(), []);

  return { state, log, error, done, start, close };
}
