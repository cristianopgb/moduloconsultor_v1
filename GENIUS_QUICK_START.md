# Genius Chat - Quick Start Guide

## ⚠️ AÇÃO NECESSÁRIA: Configure o MANUS_API_KEY

### Passo 1: Obter o Token do Manus
1. Acesse https://manus.im
2. Faça login ou crie uma conta
3. Navegue até as configurações de API
4. Copie seu token JWT (formato: `xxx.yyy.zzz`)

### Passo 2: Configurar no Supabase
1. Acesse https://app.supabase.com
2. Selecione o projeto: `gljoasdvlaitplbmbtzg`
3. Vá para **Project Settings** → **Edge Functions**
4. Clique em **Add secret**
5. Preencha:
   - Nome: `MANUS_API_KEY`
   - Valor: Cole o token JWT do Manus
6. Salve

### Passo 3: Verificar
Execute no terminal:
```bash
curl -X POST 'https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/genius-create-task' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Teste","conversation_id":"00000000-0000-0000-0000-000000000000","files":[]}'
```

Resposta esperada:
```json
{
  "success": true,
  "task_id": "...",
  "trace_id": "...",
  "status": "pending"
}
```

---

## 🎉 Nova Interface de Anexos

### Como Anexar Arquivos

**Opção 1: Clique no botão** 📎
- Clique no ícone de clipe ao lado do campo de texto
- Selecione até 5 arquivos

**Opção 2: Arraste e solte** 🖱️
- Arraste arquivos do seu computador
- Solte na área de entrada
- Visual overlay aparece durante o arraste

### Gerenciar Arquivos

**Remover arquivo individual:**
- Passe o mouse sobre o arquivo
- Clique no ícone ❌ que aparece

**Remover todos:**
- Clique em "Limpar tudo" no canto superior direito da lista

### Limites

| Item | Limite |
|------|--------|
| Arquivos por tarefa | 5 |
| Tamanho por arquivo | 25 MB |
| Tamanho total | 100 MB |

### Formatos Suportados

✅ PDF (`.pdf`)
✅ Excel (`.xlsx`, `.xls`)
✅ CSV (`.csv`)
✅ Imagens (`.png`, `.jpg`, `.jpeg`)
✅ Word (`.docx`)
✅ PowerPoint (`.pptx`)
✅ Texto (`.txt`)

---

## 🐛 Resolução de Problemas

### Erro 503: "Serviço Genius não configurado"
**Solução:** Configure o MANUS_API_KEY conforme Passo 1-2 acima

### Erro 401: "invalid token: token is malformed"
**Causa:** Token JWT inválido ou incompleto

**Solução:**
1. Verifique se copiou o token completo (3 partes: `xxx.yyy.zzz`)
2. Gere um novo token no Manus
3. Atualize o secret no Supabase

### Arquivos não aparecem
**Verifique:**
- Console do navegador (F12) para erros
- Formato do arquivo é suportado
- Tamanho não excede os limites

### "Máximo de 5 arquivos"
**Solução:** Remova alguns arquivos antes de adicionar novos

---

## 📝 Exemplo de Uso

1. **Abra o chat Genius** (modo roxo)
2. **Anexe arquivos:**
   - Clique no 📎 ou arraste arquivos
3. **Digite sua solicitação:**
   ```
   Analise estes dados e crie um relatório com insights principais
   ```
4. **Envie** (Enter ou clique em Enviar)
5. **Aguarde a análise** do Manus
6. **Receba o resultado** com arquivos gerados

---

## 🎨 Interface Atualizada

**Antes:**
```
[Botão Adicionar Arquivos (máx. 5)]
─────────────────────────────────
Chat messages...
─────────────────────────────────
[Campo de texto] [Enviar]
```

**Depois:**
```
Chat messages...
─────────────────────────────────
┌─ Arquivos anexados (3/5) ────┐
│ 📄 documento.pdf     1.2 MB  ❌│
│ 📊 planilha.xlsx     500 KB  ❌│
│ 🖼️  imagem.png       800 KB  ❌│
└─────────────────────────────────┘
[📎] [Campo de texto] [Enviar]
💡 Arraste e solte arquivos aqui
```

---

## 🚀 Deploy

Após configurar o MANUS_API_KEY:

```bash
# Build
npm run build

# Deploy (se usando Vercel/Netlify)
npm run deploy
```

Ou simplesmente commit e push para o repositório - o deploy automático cuidará do resto.

---

## 📚 Documentação Completa

Para detalhes técnicos, veja:
- `GENIUS_FILE_ATTACHMENT_UPDATE.md` - Changelog completo
- `supabase/functions/genius-create-task/README.md` - Documentação da Edge Function

---

**Pronto!** Após configurar o MANUS_API_KEY, o sistema de anexos estará totalmente funcional. 🎉
