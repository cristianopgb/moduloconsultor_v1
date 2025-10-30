// /supabase/functions/chat-assistant/index.ts
// ✅ SSE robusto para geração (stream)
// ✅ Geração usa TEMPLATE do master e retorna APENAS HTML completo (merge + limpeza de blocos vazios no backend)
// ✅ Chat normal NUNCA retorna HTML; pede CONTEXTO e sinaliza [ready-to-generate]
// ✅ Usa referências anexadas (uploads/URL) quando enviadas via `reference_ids`
// ✅ Logs de progresso
// ✅ Reconhece template selecionado e não pede novamente
// ✅ CORRIGIDO: Preserva elementos com style, class e id (não remove cores)
// ✅ NOVO: Roteamento automático para Analytics (chama chat-analyze quando houver planilhas + pedido genérico/analítico bem formado)

import { createClient } from "npm:@supabase/supabase-js@2

// ---------------- CORS ----------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, accept",
};

// ---------------- Supabase ----------------
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false } });

// ---------------- OpenAI ----------------
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-4o-mini";

// ---------------- Helpers de HTML ----------------
function stripFences(s: string) {
  if (!s) return "";
  let out = s.trim();
  out = out.replace(/^```(?:json|html|htm)?\s*/i, "");
  out = out.replace(/\s*```$/i, "");
  const idx = out.search(/<!doctype html|<html[\s>]|^\s*\{/i);
  if (idx >= 0) out = out.slice(idx);
  return out.trim();
}

function ensureClosedHtml(s: string) {
  if (!s) return s;
  const hasHtml = /<html[\s\S]*?>/i.test(s);
  const hasBody = /<body[\s\S]*?>/i.test(s);
  const endsHtml = /<\/html>\s*$/i.test(s);
  if (hasHtml && hasBody && endsHtml) return s;

  const head = `
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Documento</title>
<style>
  html,body{height:100%}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial;line-height:1.6}
</style>`.trim();

  if (!hasHtml) {
    return `<!DOCTYPE html><html lang="pt-BR"><head>${head}</head><body>${s}</body></html>`;
  }
  let body = s;
  if (!hasBody) body = body.replace(/<\/head>/i, `</head><body>`) + `</body>`;
  if (!endsHtml) body += `</html>`;
  return body;
}

function sanitizeModelHtml(text: string) {
  const t = stripFences(text || "");
  return ensureClosedHtml(t);
}

function extractPlaceholders(html: string) {
  const set = new Set<string>();
  const re = /{{\s*([\w.-]+)\s*}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[1]);
  return [...set];
}

// ---------- Preenche placeholders ----------
function fillPlaceholders(html: string, data: Record<string, string>) {
  if (!html) return html;
  return html.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => {
    const k = String(key || "").trim();
    const v = data && Object.prototype.hasOwnProperty.call(data, k) ? String((data as any)[k] ?? "") : "";
    return v;
  });
}

// ---------- REMOVE blocos vazios pós-merge (CORRIGIDO: PRESERVA elementos com style/class/id) ----------
function pruneEmptyBlocks(inputHtml: string) {
  if (!inputHtml) return inputHtml;
  let html = inputHtml;

  // Remove placeholders não preenchidos
  html = html.replace(/{{\s*[\w.-]+\s*}}/g, "");

  const emptyInline = String.raw`(?:\s|&nbsp;|<br\s*\/?>|<\/?(?:span|strong|em|b|i|u)[^>]*>)*`;

  // Remove apenas blocos vazios SEM atributos style, class ou id (preserva elementos decorativos)
  const emptyBlockNoStyleOrClass = new RegExp(
    `<(p|li|h[1-6])(?![^>]*(?:style|class|id)=)[^>]*>${emptyInline}<\\/\\1>`,
    "gi"
  );
  for (let i = 0; i < 4; i++) html = html.replace(emptyBlockNoStyleOrClass, "");

  // Remove containers vazios SEM atributos style, class ou id
  const emptyContainerNoStyleOrClass = new RegExp(
    `<(div|section|article)(?![^>]*(?:style|class|id)=)[^>]*>(?:\\s|&nbsp;|<br\\s*\\/?>|<(?:span|strong|em|b|i|u)[^>]*>\\s*<\\/\\w+>)*<\\/\\1>`,
    "gi"
  );
  for (let i = 0; i < 4; i++) html = html.replace(emptyContainerNoStyleOrClass, "");

  // Remove listas vazias
  html = html.replace(/<ul[^>]*>\s*<\/ul>/gi, "");
  html = html.replace(/<ol[^>]*>\s*<\/ol>/gi, "");

  // Normaliza quebras de linha excessivas
  html = html.replace(/\n{3,}/g, "\n\n");

  return html;
}

// ---------------- DB helpers ----------------
async function getTemplateById(id: string) {
  const { data, error } = await supabase.from("models").select("*").eq("id", id).limit(1).single();
  if (error) return null;
  return data as any;
}
async function getTemplateByNameLike(name: string) {
  const { data, error } = await supabase.from("models").select("*").ilike("name", `%${name}%`).limit(1).single();
  if (error) return null;
  return data as any;
}

type RefRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  title: string;
  type: string;
  storage_bucket: string | null;
  storage_path: string | null;
  source_url: string | null;
  extracted_text: string | null;
  metadata: any;
};

async function loadReferences(userId: string, ids?: string[]): Promise<RefRow[]> {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .in("id", ids)
    .eq("user_id", userId);
  if (error) return [];
  return (data || []) as RefRow[];
}

function buildReferenceContext(refs: RefRow[], maxChars = 30000) {
  if (!refs || refs.length === 0) return "";
  const parts: string[] = [];
  for (const r of refs) {
    const title = r.title || r.source_url || r.storage_path || "(sem título)";
    const kind = r.type || "file";
    const txt = (r.extracted_text || "").replace(/\s+/g, " ").trim();
    parts.push(
      [
        `### Referência: ${title} [${kind}]`,
        txt ? (txt.length > 8000 ? txt.slice(0, 8000) + " …(truncado)" : txt) : "(sem texto extraído)",
      ].join("\n"),
    );
  }
  let joined = parts.join("\n\n");
  if (joined.length > maxChars) joined = joined.slice(0, maxChars) + " …(truncado)";
  return joined;
}

// ---------------- OpenAI caller ----------------
async function callOpenAI(messages: any[], opts?: { temperature?: number; max_tokens?: number }) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI API Key não configurada");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: opts?.temperature ?? 0.2,
      max_tokens: opts?.max_tokens ?? 4000,
      messages,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenAI API Error: ${resp.status} - ${txt}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ---------- Pede SOMENTE o JSON de placeholders ----------
async function buildPlaceholderMap(baseHtml: string, userContext: string, referenceContext: string) {
  const placeholders = extractPlaceholders(baseHtml);
  const sys = {
    role: "system",
    content:
      "Você devolve APENAS um JSON (um único objeto) com as chaves = placeholders do template. " +
      "NUNCA retorne HTML, markdown ou texto fora do JSON. " +
      "Preencha cada campo com conteúdo corporativo breve em pt-BR, adequado ao contexto. " +
      "Se um campo não fizer sentido com o contexto, preencha com string vazia para que o backend remova o bloco. " +
      "CRÍTICO: Se houver 'DADOS ESTATÍSTICOS REAIS' nas referências, USE EXATAMENTE esses números - NUNCA invente dados. " +
      "USE PRIORITARIAMENTE as informações das referências anexadas quando disponíveis.",
  };
  const user = {
    role: "user",
    content: [
      "Template (NÃO reimprima, use apenas para entender campos):\n",
      baseHtml.slice(0, 20000),
      "\n\nPlaceholders detectados:\n",
      JSON.stringify(placeholders, null, 2),
      "\n\nContexto (resumo das mensagens do usuário):\n",
      userContext || "(sem contexto)",
      "\n\nMateriais de referência anexados pelo usuário (USE ESTES DADOS PRIORITARIAMENTE):\n",
      referenceContext || "(sem referências)",
      "\n\nMonte um JSON preenchendo TODOS os placeholders. ",
      "Se faltar dado, desenvolva com base no contexto e referências um texto plausível e profissional. ",
      'Se não for aplicável, use string vazia "".',
    ].join(""),
  };
  let raw = await callOpenAI([sys, user], { temperature: 0.2, max_tokens: 4000 });
  let jsonText = stripFences(String(raw || "").trim());
  const m = jsonText.match(/{[\s\S]*}$/);
  if (m) jsonText = m[0];
  let obj: Record<string, string> = {};
  try {
    obj = JSON.parse(jsonText);
  } catch {
    obj = {};
  }
  return obj;
}

// ---------- Geração FINAL (HTML) ----------
async function generateDocument(
  conversationId: string,
  templateRef: { id?: string; name?: string },
  references: RefRow[],
) {
  // 1) histórico (somente conteúdo do usuário)
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (!messages || messages.length === 0) throw new Error("Nenhuma mensagem na conversa");
  const conversationContext = (messages || [])
    .filter((m: any) => m.role === "user")
    .map((m: any) => m.content)
    .join("\n\n");

  // 2) carrega template
  let template: any = null;
  if (templateRef.id) template = await getTemplateById(templateRef.id);
  if (!template && templateRef.name) template = await getTemplateByNameLike(templateRef.name);
  if (!template) throw new Error(`Template não encontrado`);

  const baseHtml =
    template.content_html ||
    template.template_content ||
    `<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{{titulo}}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial;line-height:1.6;max-width:940px;margin:0 auto;padding:32px;color:#111}
    h1{color:#2563eb;margin:0 0 12px}
    section{margin:20px 0;padding:16px;border-left:4px solid #e5e7eb;background:#f9fafb}
    footer{margin-top:28px;color:#6b7280;font-size:14px;text-align:center}
  </style>
</head><body>
  <h1>{{titulo}}</h1>
  <p>{{subtitulo}}</p>
  <section><h2>Resumo</h2><p>{{resumo}}</p></section>
  <section><h2>Detalhes</h2><p>{{detalhes}}</p></section>
  <section><h2>Conclusão</h2><p>{{conclusao}}</p></section>
  <footer>Gerado em {{data}} - {{empresa}} • {{autor}}</footer>
</body></html>`;

  // 3) Referências -> contexto
  const referenceContext = buildReferenceContext(references);

  // 4) pede à IA somente o JSON com os placeholders
  const map = await buildPlaceholderMap(baseHtml, conversationContext, referenceContext);

  // 5) merge
  const merged = fillPlaceholders(baseHtml, map);

  // 6) limpa blocos vazios (COM PRESERVAÇÃO DE ESTILOS)
  const pruned = pruneEmptyBlocks(merged);

  // 7) sanitiza e garante fechamento
  const finalHtml = sanitizeModelHtml(pruned);
  return finalHtml;
}

/* =========================
   NOVO: Roteamento Analytics
   ========================= */
function isSpreadsheetName(s?: string) {
  return /\.(xlsx|xls|csv)$/i.test(s || "");
}

// evita disparar com “analise” genérico
function isBareAnalysisWord(tRaw: string) {
  const t = (tRaw || "").toLowerCase().trim();
  // exemplos de mensagens que NÃO devem disparar analytics
  const short = t.length < 8;
  const trivial = ["ok", "certo", "blz", "beleza", "continue", "pode prosseguir"].includes(t);
  const justWord = /^anali[sz]e[r]?$/.test(t) || /^an[aá]lise$/.test(t);
  return short || trivial || justWord;
}

function isGenericAnalysisPrompt(tRaw: string) {
  const t = (tRaw || "").toLowerCase();
  if (isBareAnalysisWord(t)) return false;
  const terms = [
    "pense por mim",
    "analise para mim",
    "analise por mim",
    "análise automática",
    "analise automaticamente",
    "auto análise",
    "auto analise",
    "principais pontos",
    "visão geral",
    "visao geral",
    "resumo executivo",
    "me mostre o principal",
    "o que você vê",
    "o que voce ve",
  ];
  return terms.some((k) => t.includes(k));
}

function wantsDataAnalysisExplicit(tRaw: string) {
  const t = (tRaw || "").toLowerCase();
  if (isBareAnalysisWord(t)) return false;
  // precisa ter pelo menos um termo “estrutural” (operações ou dimensões) além de “analise”
  const ops = [
    "média", "media", "mediana", "desvio", "percentil",
    "somar", "soma", "total", "contagem", "contar",
    "top", "ranking", "grupo", "por ", "comparar", "comparativo", "variação", "variacao",
    "mensal", "por mês", "por mes", "semanal", "diário", "diario",
    "tabela", "gráfico", "grafico", "chart", "visualize",
    "faturamento", "receita", "ticket", "volume",
  ];
  return /\banali[sz]/.test(t) && ops.some((k) => t.includes(k));
}

async function routeToChatAnalyzeIfNeeded(opts: {
  token: string;
  conversation_id?: string;
  message: string;
  references: RefRow[];
}) {
  const { token, conversation_id, message, references } = opts;
  if (!conversation_id) return null;
  if (!references || references.length === 0) return null;

  // montar attachments a partir de references
  const attachments = references.map((r) => ({
    bucket: r.storage_bucket || "references",
    path: r.storage_path || "",
    mime: r.type || "application/octet-stream",
    title: r.title || "arquivo",
  }));

  // precisa ter ao menos uma planilha
  const hasSheet = attachments.some(
    (a) => isSpreadsheetName(a.title) || /spreadsheet|csv|excel/i.test(a.mime || "")
  );
  if (!hasSheet) return null;

  // só dispara se for genérico OU explícito bem formado
  const isGeneric = isGenericAnalysisPrompt(message);
  const isExplicit = wantsDataAnalysisExplicit(message);
  if (!isGeneric && !isExplicit) return null;

  const url = `${supabaseUrl}/functions/v1/chat-analyze`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversation_id,
      question: isGeneric ? "pense por mim" : message,
      attachments,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    console.warn("[chat-assistant] chat-analyze HTTP", resp.status, txt);
    return {
      message:
        "Não consegui executar análise automática agora. Verifique se a planilha tem dados tabulares ou tente especificar melhor o que deseja analisar.",
      executed_query: false,
    };
  }

  const out = await resp.json().catch(() => ({}));
  if (out?.success && out?.executed_query) {
    return {
      message: out?.explanation || "Análise concluída. Veja os resultados abaixo:",
      analysis_id: out?.analysis_id || null,
      analysisData: out?.result || null,
      executed_query: true,
    };
  }
  return {
    message: out?.message || "Não foi possível executar a análise automática.",
    executed_query: false,
  };
}

// ============ HANDLER PRINCIPAL ============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Authorization token required");
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    const stream = body.stream;
    const conversationId = body.conversation_id as string | undefined;
    const message = (body.message || "") as string;
    const templateId = body.template_id as string | undefined;
    const templateName = body.template as string | undefined;
    const referenceIds = body.reference_ids as string[] | undefined;

    // ============ MODO GERAÇÃO (STREAM) ============
    if (stream === "generate") {
      console.log("[DEBUG] GENERATE mode");

      const references = await loadReferences(user.id, referenceIds);
      const templateRef = { id: templateId, name: templateName };

      const encoder = new TextEncoder();
      const sse = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ event: "log", message: "Iniciando geração..." })}\n\n`)
            );

            const html = await generateDocument(conversationId!, templateRef, references);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "done", html })}\n\n`));
            controller.close();
          } catch (error: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "error", message: error.message })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(sse, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...corsHeaders,
        },
      });
    }

    // ============ MODO CHAT (RESPOSTA NORMAL) ============
    console.log("[DEBUG] CHAT mode");

    // Carrega referências (para contexto e possível roteamento analytics)
    const references = await loadReferences(user.id, referenceIds);

    // 🔁 NOVO: ROTEAMENTO AUTOMÁTICO PARA ANALYTICS
    // Somente quando NÃO há template selecionado (modo apresentação fica intacto)
    if (!templateId && !templateName) {
      const routed = await routeToChatAnalyzeIfNeeded({
        token,
        conversation_id: conversationId,
        message,
        references,
      });
      if (routed) {
        // Retorna no formato que o ChatPage já entende (analysisData/analysis_id/message)
        return new Response(JSON.stringify(routed), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Se não roteou para analytics, segue chat normal:
    const referenceContext = buildReferenceContext(references);
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = (messages || []).map((m: any) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    history.push({ role: "user", content: message });

    const systemPrompt = templateId || templateName
      ? "Você é um assistente que coleta informações para preencher um template. Faça perguntas objetivas e claras."
      : "Você é um assistente conversacional útil e objetivo.";

    const refContext = referenceContext
      ? `\n\n## Materiais de Referência Anexados:\n${referenceContext}\n\nUSE essas informações ao responder quando relevante.`
      : "";

    const aiMessages = [{ role: "system", content: systemPrompt + refContext }, ...history];

    const reply = await callOpenAI(aiMessages, { temperature: 0.7, max_tokens: 1500 });

    return new Response(JSON.stringify({ message: reply }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[ERROR]", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
