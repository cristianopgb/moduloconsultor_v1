# Como Adicionar Créditos Genius

## Método 1: Via Interface (RECOMENDADO)

1. **Acesse a página Tokens**
   - No menu lateral, clique em "Tokens"
   - Ou acesse: `http://localhost:5173/tokens`

2. **Clique no botão "Adicionar Créditos"**
   - Botão amarelo/dourado com ícones ⚡ Sparkles no canto superior direito

3. **No modal que abrir:**
   - Digite a quantidade de créditos (1-1000)
   - Ou use os botões rápidos: +5, +10, +50, +100
   - Clique em "Adicionar X Créditos"

4. **Pronto!**
   - Você verá uma mensagem de sucesso
   - O saldo será atualizado automaticamente

---

## Método 2: Via Console do Navegador (Para testes rápidos)

1. **Abra o DevTools** (F12) na página do app

2. **Cole este código no Console:**

```javascript
// Ver seu user_id atual
const { data: { user } } = await window.supabase.auth.getUser();
console.log('Seu user_id:', user.id);

// Adicionar 10 créditos Genius
const { data, error } = await window.supabase.rpc('add_genius_credits', {
  p_user_id: user.id,
  p_amount: 10
});

if (error) {
  console.error('Erro:', error);
} else {
  console.log('✅ Créditos adicionados!', data);
}

// Verificar novo saldo
const credits = await window.supabase.rpc('get_genius_credits', {
  p_user_id: user.id
});
console.log('Saldo atual:', credits.data);
```

---

## Método 3: Via SQL Editor do Supabase

1. **Acesse:** https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg/sql

2. **Cole este SQL:**

```sql
-- Ver todos os usuários
SELECT id, email FROM auth.users;

-- Adicionar 10 créditos (substitua 'SEU_USER_ID')
SELECT add_genius_credits(
  'SEU_USER_ID'::uuid,
  10
);

-- Verificar créditos de todos os usuários
SELECT
  u.email,
  gc.credits_available,
  gc.credits_used,
  gc.last_recharge_date
FROM genius_credits gc
JOIN auth.users u ON u.id = gc.user_id;
```

---

## Verificar Créditos Atuais

Na página **Tokens**, você verá um card amarelo/dourado com:
- Número de créditos disponíveis (grande)
- "Créditos Genius" (subtítulo)
- "X usos realizados" (linha extra)

O card atualiza automaticamente a cada 30 segundos.

---

## Como os Créditos Funcionam

- **1 crédito = 1 uso do botão Genius**
- Cada vez que você clicar no botão "Upgrade com Genius", será consumido 1 crédito
- O consumo é independente do tamanho da análise
- Tokens da API Manus são gerenciados separadamente (não são afetados)

---

## Solução de Problemas

### "Erro ao adicionar créditos"
- Verifique se você está logado
- Verifique sua conexão com o Supabase
- Tente recarregar a página

### Créditos não aparecem
- Clique no ícone de refresh (↻) no card de Créditos Genius
- Ou recarregue a página

### Botão Genius não aparece
- Certifique-se de ter créditos disponíveis
- Verifique se está em uma conversa de Analytics com análise concluída
