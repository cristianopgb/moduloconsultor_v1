// /src/lib/storagePreview.ts
import { supabase } from './supabase'

type Params = {
  html: string
  title?: string
  conversationId?: string | null
  userId?: string | null
  persistToStorage?: boolean
}

function slugify(s: string) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function stripFences(input: string) {
  let t = (input || '').trim()
  if (!t) return ''
  if (/^```/i.test(t)) {
    t = t.replace(/^```(?:html|htm)?\s*/i, '').replace(/```+$/i, '').trim()
  }
  return t
}

function normalizeHtml(input: string) {
  const raw = stripFences(input)
  const html = raw?.trim() || ''
  const hasHtml = /<\s*html[\s>]/i.test(html)
  const hasBody = /<\s*body[\s>]/i.test(html)
  if (hasHtml && hasBody) return html
  const safe = html.replace(/<\/?(html|head|body)\b[^>]*>/gi, '')
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
  return `<!doctype html><html lang="pt-BR"><head>${head}</head><body>${safe}</body></html>`
}

// Injeta toolbar + lógica de salvar via Edge Function (com handshake de auth)
function enhanceWithToolbar(
  html: string,
  docTitle: string,
  meta: { userId?: string | null; conversationId?: string | null }
) {
  const finalTitle = (docTitle || 'Preview').replace(/</g, '&lt;')

  const script = `
<script>
(function(){
  // ======== Handshake de autenticação com a janela mãe ========
  const AUTH = { token:null, supabaseUrl:null, userId:${JSON.stringify(meta.userId||null)}, conversationId:${JSON.stringify(meta.conversationId||null)}, title:document.title||'documento' };

  function receiveAuth(e){
    try{
      const d = e.data || {};
      if (d && d.type === 'preview:auth') {
        AUTH.token = d.token || null;
        AUTH.supabaseUrl = d.supabaseUrl || null;
        if (d.userId) AUTH.userId = d.userId;
        if (d.conversationId) AUTH.conversationId = d.conversationId;
        if (d.title) AUTH.title = d.title;
        window.removeEventListener('message', receiveAuth);
      }
    }catch{}
  }
  window.addEventListener('message', receiveAuth);
  try { window.opener && window.opener.postMessage({ type:'preview:hello' }, '*'); } catch {}

  function onReady(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded', fn);} else {fn();} }

  onReady(function(){
    try{
      // ====== CSS dos formatos e resets ======
      const style = document.createElement('style');
      style.textContent = \`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { max-width: 100%; overflow-x: hidden; }
        img, svg, video, canvas { max-width: 100%; height: auto; }
        table { width: 100%; border-collapse: collapse; }
        pre, code { overflow: auto; }
        #__preview_wrap__ { margin: 0 auto; padding: 24px; }
        .__page { box-shadow: 0 6px 24px rgba(0,0,0,.1); margin: 24px auto; }
        .__slides169 { width: min(1280px, 96vw); aspect-ratio: 16 / 9; padding: min(48px, 4vw); }
        .__a4 { width: min(800px, 96vw); aspect-ratio: 210 / 297; padding: min(40px, 4vw); }
        .__selectable:hover { outline: 2px dashed rgba(99,102,241,.6); cursor: pointer; }
        .__selected { outline: 3px solid rgba(99,102,241,.9) !important; }
        @media print {
          body { margin: 0; }
          #__preview_toolbar__ { display:none !important; }
          .__page { box-shadow:none; margin:0; width:100%; aspect-ratio:auto; padding:0; }
        }
      \`;
      document.head.appendChild(style);

      // ==== wrap ====
      const wrap = document.createElement('div');
      wrap.id = '__preview_wrap__';
      while (document.body.firstChild) wrap.appendChild(document.body.firstChild);
      document.body.appendChild(wrap);

      // detecta/gera container de página
      let page = wrap.querySelector('.__page');
      if (!page) {
        page = document.createElement('div');
        page.className = '__page __a4';
        while (wrap.firstChild) page.appendChild(wrap.firstChild);
        wrap.appendChild(page);
      }

      // heurística de blocos selecionáveis
      Array.from(page.querySelectorAll('section, article, div, p, li, figure, header, footer')).forEach(el=>{
        if (el.id === '__preview_toolbar__') return;
        el.classList.add('__selectable');
      });

      // ===== Toolbar =====
      const bar = document.createElement('div');
      bar.id = '__preview_toolbar__';
      bar.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;display:flex;flex-wrap:wrap;gap:8px;background:#0f172a;box-shadow:0 6px 20px rgba(0,0,0,.25);border-radius:12px;padding:8px 10px;color:#e2e8f0;font:600 13px/1.2 system-ui';
      const spacer = ()=>{ const s=document.createElement('span'); s.style.cssText='width:8px'; return s; }

      function btn(label){
        const b=document.createElement('button');
        b.textContent=label;
        b.style.cssText='border:0;border-radius:10px;padding:8px 10px;background:#111827;color:#fff;cursor:pointer';
        b.onmouseenter=()=>b.style.background='#1f2937';
        b.onmouseleave=()=>b.style.background='#111827';
        return b;
      }

      // ===== Formato (Slides 16:9 / A4) =====
      const b169 = btn('Slides 16:9');
      b169.onclick = () => { page.classList.remove('__a4'); page.classList.add('__slides169'); };
      const bA4 = btn('Documento A4');
      bA4.onclick = () => { page.classList.remove('__slides169'); page.classList.add('__a4'); };
      bar.appendChild(b169); bar.appendChild(bA4); bar.appendChild(spacer());

      // ===== Editar =====
      let editable = false;
      const bEdit = btn('Editar');
      bEdit.onclick = ()=> {
        editable = !editable;
        page.contentEditable = editable ? 'true' : 'false';
        (page).style.outline = editable ? '2px dashed rgba(99,102,241,.6)' : '';
        bEdit.textContent = editable ? 'Bloquear' : 'Editar';
      };
      bar.appendChild(bEdit);

      // ===== Selecionar/Excluir bloco =====
      let selectedEl = null;
      function clearSelection(){
        document.querySelectorAll('.__selected').forEach(n=>n.classList.remove('__selected'));
        selectedEl = null;
      }
      let selectMode = false;
      wrap.addEventListener('click', (e)=>{
        if (!selectMode) return;
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (!page.contains(target)) return;
        const el = target.closest('.__selectable');
        if (el && el !== page) {
          clearSelection();
          el.classList.add('__selected');
          selectedEl = el;
          e.preventDefault(); e.stopPropagation();
        }
      }, true);

      const bSelect = btn('Selecionar');
      bSelect.onclick = () => {
        selectMode = !selectMode;
        if (!selectMode) clearSelection();
        bSelect.textContent = selectMode ? 'Selecionando…' : 'Selecionar';
      };
      const bDelete = btn('Excluir bloco');
      bDelete.onclick = () => {
        if (selectedEl && page.contains(selectedEl)) { selectedEl.remove(); clearSelection(); }
      };
      bar.appendChild(bSelect); bar.appendChild(bDelete); bar.appendChild(spacer());

      // ===== Inserir imagem =====
      const bImg = btn('Inserir imagem');
      bImg.onclick = async ()=>{
        const input = document.createElement('input');
        input.type='file'; input.accept='image/*';
        input.onchange = async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const img = document.createElement('img');
            img.src = String(reader.result);
            img.style.maxWidth = '100%';
            if (selectedEl && page.contains(selectedEl)) selectedEl.appendChild(img);
            else page.appendChild(img);
          };
          reader.readAsDataURL(file);
        };
        input.click();
      };
      bar.appendChild(bImg);

      // ===== Zoom =====
      const bZoomOut = btn('-');
      const zoomLabel = document.createElement('span');
      zoomLabel.textContent = '100%';
      zoomLabel.style.cssText='padding:8px 10px;background:#0b1220;border-radius:10px;display:inline-block;min-width:52px;text-align:center';
      const bZoomIn = btn('+');
      function setZoom(n){
        (page).style.zoom = String(n);
        zoomLabel.textContent = Math.round(n*100)+'%';
      }
      bZoomOut.onclick = ()=>{ const z=Number((page).style.zoom||'1'); setZoom(Math.max(0.5, z-0.1)); };
      bZoomIn.onclick  = ()=>{ const z=Number((page).style.zoom||'1'); setZoom(Math.min(2,   z+0.1)); };
      bar.appendChild(bZoomOut); bar.appendChild(zoomLabel); bar.appendChild(bZoomIn); bar.appendChild(spacer());

      // ===== Util: consolidar edições antes de serializar =====
      function commitEdits(){
        try {
          const ae = document.activeElement;
          if (ae && 'blur' in ae) { (ae).blur(); }
        } catch {}
        return new Promise(requestAnimationFrame);
      }
      function serializeHtml(){
        const dt = document.doctype;
        const doctype = dt ? '<!DOCTYPE '+(dt.name||'html')+'>' : '<!DOCTYPE html>';
        return doctype + '\\n' + document.documentElement.outerHTML;
      }

      // ===== Salvar (via Edge Function com token) =====
      const bSave = btn('Salvar');
      bSave.onclick = async ()=>{
        try{
          bSave.textContent = 'Salvando…';
          await commitEdits();
          const html = serializeHtml();

          if (AUTH && AUTH.token && AUTH.supabaseUrl) {
            const payload = {
              html,
              title: AUTH.title || document.title || 'documento',
              conversation_id: AUTH.conversationId || undefined,
              user_id: AUTH.userId || undefined,
            };
            const resp = await fetch(AUTH.supabaseUrl + '/functions/v1/save-preview', {
              method:'POST',
              headers: { 'Authorization': 'Bearer ' + AUTH.token, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (resp.ok) {
              bSave.textContent = 'Salvo!';
              setTimeout(()=> bSave.textContent = 'Salvar', 1500);
              return;
            }
          }
          // fallback: download local
          const blob = new Blob([html], {type:'text/html;charset=utf-8'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = (document.title || 'documento') + '-edited.html';
          document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0);
          bSave.textContent = 'Baixado';
          setTimeout(()=> bSave.textContent = 'Salvar', 1500);
        }catch(e){ console.error(e); bSave.textContent='Erro'; setTimeout(()=> bSave.textContent='Salvar', 1500); }
      };
      bar.appendChild(bSave);

      // ===== Copiar / Baixar / Imprimir =====
      const bCopy = btn('Copiar HTML');
      bCopy.onclick = async ()=> {
        try { await commitEdits(); const html = serializeHtml();
          await navigator.clipboard.writeText(html);
          bCopy.textContent = 'Copiado!'; setTimeout(()=> bCopy.textContent='Copiar HTML', 1200);
        } catch (e) { console.error(e); }
      };
      const bDownload = btn('Baixar');
      bDownload.onclick = async ()=>{
        await commitEdits();
        const html = serializeHtml();
        const blob = new Blob([html], {type:'text/html;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (document.title || 'documento') + '.html';
        document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();}, 0);
      };
      const bPrint = btn('Imprimir'); bPrint.onclick = ()=> window.print();
      bar.appendChild(bCopy); bar.appendChild(bDownload); bar.appendChild(bPrint); bar.appendChild(spacer());

      // ===== Voltar ao chat =====
      const bBack = btn('Voltar ao chat');
      bBack.onclick = ()=>{
        try { window.opener && window.opener.postMessage({ type:'preview:close', action:'back_to_chat' }, '*'); } catch {}
        window.close();
      };
      bar.appendChild(bBack);

      document.body.appendChild(bar);
      document.title = ${JSON.stringify(finalTitle)};
    }catch(e){ console.error('[preview] toolbar error:', e); }
  });
})();
</script>`;

  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, script + "\n</body>")
  return html + script
}

export async function uploadHtmlAndOpenPreview({
  html, title, conversationId, userId, persistToStorage = true,
}: Params) {
  if (!html || html.trim().length < 10) throw new Error('HTML vazio ou muito curto.')

  // 1) abre imediatamente
  const win = window.open('', '_blank')
  if (!win) throw new Error('Popup bloqueado pelo navegador.')

  try {
    win.document.open()
    win.document.write(`<!doctype html><html lang="pt-BR"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${(title || 'Preview').replace(/</g, '&lt;')}</title>
      <style>
        html,body{height:100%}
        body{display:flex;align-items:center;justify-content:center;font:14px/1.4 system-ui;background:#0b1220;color:#e2e8f0}
      </style>
    </head><body>Carregando preview…</body></html>`)
    win.document.close()
  } catch {}

  // 2) opcional: histórico antes do preview
  if (persistToStorage) {
    try {
      const safe = slugify(title || 'documento')
      const ts = Date.now()
      const path = `u_${userId || 'anon'}/c_${conversationId || 'sem-conversa'}/${safe}-${ts}.html`

      // Use Edge Function with Service Role to bypass RLS
      const { data: session } = await supabase.auth.getSession()
      if (session?.session?.access_token) {
        const { error: upErr } = await supabase.functions.invoke('save-preview', {
          body: {
            html,
            path,
            conversation_id: conversationId || null,
            user_id: userId || null
          }
        })
        if (upErr) console.warn('[preview][upload] falhou:', upErr.message || upErr)
      } else {
        console.warn('[preview][upload] sem token de autenticação, pulando upload')
      }
    } catch (e) {
      console.warn('[preview][upload] erro inesperado:', e)
    }
  }

  // 3) injeta com toolbar
  const finalHtml = enhanceWithToolbar(
    normalizeHtml(html),
    title || 'Preview',
    { userId: userId || null, conversationId: conversationId || null }
  )
  try {
    win.document.open()
    win.document.write(finalHtml)
    win.document.close()
  } catch (e) {
    console.error('[preview] falha ao escrever HTML no about:blank:', e)
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    win.location.href = url
  }

  // 4) envia o token para o preview (handshake de auth)
  try {
    const { data: s } = await supabase.auth.getSession()
    const token = s?.session?.access_token || null
    // @ts-ignore
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    win.postMessage({
      type: 'preview:auth',
      token,
      supabaseUrl,
      userId: userId || null,
      conversationId: conversationId || null,
      title: title || 'documento'
    }, '*')
  } catch {}
}
