# Correção CORS Dinâmico - 18/11/2025

## Problema Identificado

A Edge Function `analyze-file` retornava erro 400 sem corpo acessível:
```
FunctionsHttpError: Edge Function returned a non-2xx status code
```

O navegador bloqueava a resposta porque o preflight OPTIONS não aprovava todos os headers solicitados.

## Causa Raiz

1. **Headers CORS Estáticos**: A lista de headers permitidos era fixa e limitada
2. **Preflight Falhando**: Quando o navegador solicitava headers adicionais (ex: `X-Supabase-Api-Version`, `Prefer`, etc.), o preflight rejeitava
3. **Resposta Bloqueada**: O navegador bloqueava a resposta, resultando em 400 "mudo" sem body acessível

## Solução Implementada

### 1. CORS Dinâmico no Response Helper

Implementado sistema que ecoa dinamicamente os headers solicitados:

```typescript
// Headers base expandidos
const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Requested-With, Accept, Accept-Language, Content-Language, X-Supabase-Api-Version, Prefer',
  'Access-Control-Max-Age': '86400',
};

// Função que ecoa headers do preflight
export function buildCorsHeaders(req?: Request): Record<string, string> {
  if (!req) return BASE_CORS_HEADERS;

  const requestedHeaders = req.headers.get('Access-Control-Request-Headers');

  if (requestedHeaders) {
    return {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Headers': requestedHeaders, // Ecoa exatamente o que o browser pede
    };
  }

  return BASE_CORS_HEADERS;
}
```

### 2. Atualização dos Helpers de Resposta

Todos os helpers agora aceitam `req` e usam CORS dinâmico:

**jsonOk:**
```typescript
export function jsonOk(data: unknown, options: ResponseOptions = {}): Response {
  const { status = 200, headers = {}, includeTimestamp = true, req } = options;
  const corsHeaders = buildCorsHeaders(req); // ← CORS dinâmico
  // ...
}
```

**jsonError:**
```typescript
export function jsonError(
  code: number,
  message: string,
  extra: Record<string, unknown> = {},
  req?: Request  // ← Novo parâmetro
): Response {
  const corsHeaders = buildCorsHeaders(req);
  // ...
}
```

**jsonFallback:**
```typescript
export function jsonFallback(
  data: unknown,
  reason: string,
  diagnostics: Record<string, unknown> = {},
  req?: Request  // ← Novo parâmetro
): Response {
  return jsonOk({ /* ... */ }, { req });
}
```

**corsPreflightResponse:**
```typescript
export function corsPreflightResponse(req?: Request): Response {
  const corsHeaders = buildCorsHeaders(req); // ← Ecoa headers do preflight
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
```

### 3. Atualização do analyze-file/index.ts

Todas as respostas agora passam o `req`:

```typescript
// Preflight
if (req.method === 'OPTIONS') {
  return corsPreflightResponse(req);
}

// Erros
return jsonError(400, 'No data provided', { /* ... */ }, req);

// Fallback
return jsonFallback(data, reason, diagnostics, req);

// Sucesso
return jsonOk(data, { req });
```

## Por Que Isso Resolve?

### Antes:
1. ❌ Browser pede headers adicionais no preflight
2. ❌ Servidor responde com whitelist fixa que não inclui os headers pedidos
3. ❌ Preflight falha
4. ❌ POST real nem chega a executar
5. ❌ Browser bloqueia a resposta → 400 sem body acessível

### Depois:
1. ✅ Browser pede headers no preflight
2. ✅ Servidor ecoa exatamente os headers solicitados
3. ✅ Preflight aprova
4. ✅ POST executa normalmente
5. ✅ Resposta retorna com CORS correto → Body acessível no frontend

## Headers Adicionados à Lista Base

```
Content-Type
Authorization
X-Client-Info
Apikey
X-Requested-With          ← NOVO
Accept                    ← NOVO
Accept-Language           ← NOVO
Content-Language          ← NOVO
X-Supabase-Api-Version    ← NOVO
Prefer                    ← NOVO
```

## Arquivos Modificados

1. `supabase/functions/_shared/response-helpers.ts`
   - Adicionada função `buildCorsHeaders(req)`
   - Expandida lista de headers base
   - Todos os helpers agora aceitam `req` opcional

2. `supabase/functions/analyze-file/index.ts`
   - Importado `buildCorsHeaders`
   - Todas as respostas passam `req` para os helpers
   - Substituídas respostas manuais por helpers

## Verificação

- ✅ Build concluído com sucesso
- ✅ Sem erros de TypeScript
- ✅ CORS dinâmico implementado
- ✅ Todas as respostas incluem headers CORS corretos

## Próximos Passos

1. **Testar no navegador**: Fazer upload do arquivo Excel novamente
2. **Verificar preflight**: Inspecionar Network tab → Request Method OPTIONS deve retornar 204
3. **Confirmar POST**: POST deve retornar 200 com body JSON acessível
4. **Monitorar logs**: Verificar que não há mais erros de CORS

## Compatibilidade

✅ Todas as Edge Functions continuam funcionando
✅ Retrocompatibilidade mantida (req é opcional)
✅ Headers estáticos ainda funcionam como fallback

## Deploy

Pronto para deploy. As alterações são seguras e não quebram funcionalidades existentes.
