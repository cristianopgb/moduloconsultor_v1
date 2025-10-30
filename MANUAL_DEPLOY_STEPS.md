# Manual Deployment Steps - Consultor RAG Fixes

## ⚡ ÚLTIMA CORREÇÃO (30/10/2025 - 15:30)
**Fix adicional**: Corrigido formato de payload enviado ao Edge Function (erro 400)
- Frontend agora envia `sessao` object + `messages` array no formato correto
- Arquivo modificado: `src/lib/consultor/rag-adapter.ts`
- **IMPORTANTE**: Apenas frontend precisa ser rebuiltado, Edge Function não mudou

## 🎯 Quick Deploy (3 Steps)

### Step 1: Apply Database Migration
1. Go to Supabase Dashboard → SQL Editor
2. Open file: `supabase/migrations/20251030000000_add_missing_consultor_columns.sql`
3. Copy all contents and paste into SQL Editor
4. Click "Run" button
5. Verify success message appears

**Expected Output:**
```
✓ Added empresa column to consultor_sessoes
✓ Added setor column to consultor_sessoes
✓ Added jornada_id column to consultor_sessoes
```

---

### Step 2: Deploy Edge Function
```bash
npx supabase functions deploy consultor-rag --no-verify-jwt
```

**If you get "Access token not provided":**
```bash
# Login first:
npx supabase login

# Then deploy:
npx supabase functions deploy consultor-rag --no-verify-jwt
```

**Expected Output:**
```
✓ Deploying Function consultor-rag...
✓ Function deployed successfully
```

---

### Step 3: Build Frontend
```bash
npm run build
```

**Expected Output:**
```
✓ built in 9.87s
dist/index.html                      3.75 kB
dist/assets/index-BIsz2p4z.js    1,558.06 kB
```

Then deploy the `dist/` folder to your hosting provider.

---

## ✅ Post-Deployment Verification

### 1. Check Console Logs
Open browser console and look for:
- ✅ `[RAG-ADAPTER] Nova sessão criada: <uuid>`
- ✅ `[CONSULTOR-RAG] Actions after normalization: 1`
- ❌ NO "status column not found" errors
- ❌ NO "No target state provided" errors

### 2. Test First Interaction
1. Go to Chat page
2. Enable Consultor mode
3. Type: "Olá" or "Preciso de ajuda"
4. Verify response:
   - ✅ Introduces consultant in 1 line
   - ✅ Asks ONE objective question (e.g., company sector)
   - ✅ Ends with "Próximo passo:"
   - ✅ No errors in console

### 3. Test State Transitions
1. Answer the question (e.g., "transportes")
2. Verify:
   - ✅ System advances to next step
   - ✅ No loop (doesn't ask same question again)
   - ✅ Console shows: `[RAG-EXECUTOR] Transitioning state to: coleta`

---

## 🐛 Troubleshooting

### Error: "Could not find the 'status' column"
**Cause**: Old code still deployed
**Fix**: Redeploy Edge Function (Step 2 above)

### Error: "getCardsByHash is not defined"
**Cause**: Frontend not rebuilt
**Fix**: Run `npm run build` and redeploy

### Error: "No target state provided"
**Cause**: Edge Function not updated
**Fix**: Verify Step 2 completed successfully, check logs

### LLM repeats same question
**Cause**: Old prompt still active
**Fix**: Clear browser cache, refresh page, verify new prompt deployed

### Session creation fails
**Cause**: Migration not applied
**Fix**: Complete Step 1, verify columns exist in database

---

## 📋 Files Changed

**Database:**
- `supabase/migrations/20251030000000_add_missing_consultor_columns.sql` (NEW)

**Backend:**
- `supabase/functions/consultor-rag/prompt.ts` (REWRITTEN)
- `supabase/functions/consultor-rag/orchestrator.ts` (ADDED fixTransicaoEstadoTargets)
- `supabase/functions/consultor-rag/index.ts` (ADDED normalization step)

**Frontend:**
- `src/lib/consultor/rag-adapter.ts` (REWRITTEN getOrCreateSessao)
- `src/lib/consultor/rag-executor.ts` (ADDED getCardsByHash, REWROTE executeTransicaoEstado)

---

## 🔄 Rollback Plan

If issues occur:

**Rollback Edge Function:**
```bash
# Deploy previous version from git
git checkout HEAD~1 supabase/functions/consultor-rag/
npx supabase functions deploy consultor-rag --no-verify-jwt
```

**Rollback Frontend:**
```bash
# Build previous version
git checkout HEAD~1 src/
npm run build
# Deploy old dist/
```

**Keep Migration:**
The new columns are nullable and safe to keep. No rollback needed.

---

## 📞 Need Help?

Check the comprehensive guide: `CONSULTOR_RAG_FIX_COMPLETE.md`

All fixes are defensive and backwards-compatible. The system will gracefully handle missing data.
