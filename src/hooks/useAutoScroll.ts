// /src/hooks/useAutoScroll.ts
import { useEffect, useRef, useState } from 'react';

// Margens de tolerância:
// - Quando chega nova mensagem, consideramos "perto do fim" se faltar menos de 80px.
// - Durante a rolagem manual, zeramos a pendência quando faltar menos de 16px.
const NEAR_BOTTOM_ON_NOTIFY = 80;
const NEAR_BOTTOM_ON_SCROLL = 16;

export function useAutoScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [pending, setPending] = useState(0);
  const rafId = useRef<number | null>(null);
  const debounceId = useRef<number | null>(null);

  function atBottom(el: HTMLElement, margin = NEAR_BOTTOM_ON_SCROLL) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < margin;
  }

  function smoothScrollToBottom(el: HTMLElement) {
    try {
      // Rolagem suave nativa
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } catch {
      // Fallback: step por RAF
      if (rafId.current) cancelAnimationFrame(rafId.current);
      const start = el.scrollTop;
      const end = el.scrollHeight;
      const duration = 220;
      const t0 = performance.now();

      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        // easeOutCubic
        const e = 1 - Math.pow(1 - p, 3);
        el.scrollTop = start + (end - start) * e;
        if (p < 1) {
          rafId.current = requestAnimationFrame(tick);
        } else {
          rafId.current = null;
        }
      };
      rafId.current = requestAnimationFrame(tick);
    }
  }

  function scrollToBottom() {
    const el = ref.current;
    if (!el) return;
    smoothScrollToBottom(el);
    setPending(0);
    // eslint-disable-next-line no-console
    console.log('[DEBUG] scrollToBottom');
  }

  // Chame toda vez que novas mensagens forem renderizadas
  function notifyNew() {
    const el = ref.current;
    if (!el) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_ON_NOTIFY;

    if (nearBottom) {
      // já está perto do fim → rola junto
      scrollToBottom();
    } else {
      // longe do fim → acumula "pendências" (mostra seta)
      if (debounceId.current) window.clearTimeout(debounceId.current);
      debounceId.current = window.setTimeout(() => {
        setPending((p) => Math.min(99, p + 1));
      }, 50);
    }
    // eslint-disable-next-line no-console
    console.log('[DEBUG] notifyNew: nearBottom?', nearBottom);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      // Se o usuário voltar ao fim, limpamos as pendências.
      if (atBottom(el, NEAR_BOTTOM_ON_SCROLL) && pending > 0) {
        setPending(0);
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (debounceId.current) clearTimeout(debounceId.current);
    };
  }, [pending]);

  return { ref, notifyNew, scrollToBottom, pending };
}
