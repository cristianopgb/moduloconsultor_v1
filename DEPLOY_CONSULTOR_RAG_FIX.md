# Deploy Consultor RAG Fix - Phase Transition Loop Resolution

## What Was Fixed

### 1. **Phase Naming Normalization**
- Added `PHASE_NORMALIZE` mapping to handle `coleta` → `anamnese` conversion
- Database uses `coleta`, but internal system uses `anamnese`
- Now both phase names work correctly

### 2. **Automatic Phase Transition Detection**
- Added intelligent completion detection for anamnese phase
- System automatically detects when 8+ out of 10 required fields are collected
- If LLM fails to generate transition actions, system injects them automatically
- Prevents infinite loop by forcing transition when criteria are met

### 3. **Enhanced LLM Prompts**
- Added explicit TURNO 7: SÍNTESE E TRANSIÇÃO section
- Included concrete JSON examples of required actions
- Added warning messages about loop consequences
- Made [PARTE B] generation absolutely mandatory with multiple reminders

### 4. **Better Error Handling**
- Enhanced PARTE B JSON parsing with detailed logging
- Added logging for successful parsing with context and action counts
- Log raw PARTE B content when parsing fails for debugging
- Warn when PARTE B is completely missing from LLM response

## Files Modified

1. `/supabase/functions/consultor-rag/index.ts`
   - Added phase normalization mapping
   - Added automatic completion detection (lines ~265-285)
   - Enhanced error logging for PARTE B parsing
   - Auto-injection of transition actions when criteria met

2. `/supabase/functions/consultor-rag/consultor-prompts.ts`
   - Enhanced BASE_PERSONA with mandatory [PARTE B] rules
   - Added TURNO 7 with explicit transition instructions
   - Added complete JSON example for phase transition
   - Multiple warning sections about loop prevention

## How It Works Now

### Normal Flow (LLM generates actions correctly):
1. User completes all 6 anamnese questions
2. LLM generates synthesis message
3. LLM returns [PARTE B] with `transicao_estado` action
4. System transitions to `mapeamento` phase
5. ✅ No loop

### Fallback Flow (LLM fails to generate actions):
1. User completes all 6 anamnese questions
2. LLM generates synthesis message
3. LLM fails to return actions or returns empty array
4. **Server detects completion** (8+ fields collected)
5. **Server auto-injects** transition actions
6. System transitions to `mapeamento` phase
7. ✅ No loop - automatic recovery

## Deployment Instructions

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg/functions
2. Find `consultor-rag` function
3. Click "Edit Function"
4. Replace contents with updated files:
   - `index.ts` from `/supabase/functions/consultor-rag/index.ts`
   - `consultor-prompts.ts` from `/supabase/functions/consultor-rag/consultor-prompts.ts`
5. Click "Deploy"
6. Wait for deployment to complete
7. Test the function

### Option 2: Via Supabase CLI

```bash
# Login to Supabase (if not already logged in)
npx supabase login

# Link to your project
npx supabase link --project-ref gljoasdvlaitplbmbtzg

# Deploy the function
npx supabase functions deploy consultor-rag

# Verify deployment
npx supabase functions list
```

### Option 3: Manual API Deploy

Use the Supabase Management API or wait for next deployment cycle.

## Testing After Deployment

### Test Case 1: Complete Anamnese Flow
```
1. Open app in Consultor mode
2. Start conversation: "Olá"
3. Answer all 6 questions:
   - Name and role
   - Age and education
   - Company name and sector
   - Revenue and employees
   - Main pain point
   - Success expectations
4. After 6th answer, system should:
   - Show synthesis
   - Ask "Resumi corretamente?"
   - **Automatically advance to mapeamento phase**
   - Generate anamnese entregável
5. ✅ Check: No loop, phase transitions to "mapeamento"
```

### Test Case 2: Check Edge Function Logs
```bash
# View live logs during testing
npx supabase functions logs consultor-rag --follow
```

Look for these log messages:
- `[CONSULTOR] Anamnese completion check: {required: 10, collected: X}`
- `[CONSULTOR] AUTO-TRANSITION: Anamnese complete, forcing transition to mapeamento`
- `[CONSULTOR] Successfully parsed PARTE B: {contextoKeys: X, actionsCount: Y}`

### Expected Behavior Changes

**Before Fix:**
- System completes anamnese
- LLM says "next step" but doesn't generate actions
- Phase stays in `anamnese`/`coleta`
- User keeps getting "next step" messages
- Infinite loop ❌

**After Fix:**
- System completes anamnese
- LLM generates transition actions (preferred)
- OR server auto-detects completion and injects actions (fallback)
- Phase transitions to `mapeamento`
- Process continues normally ✅

## Rollback Plan

If issues occur after deployment:

1. The previous version is stored in Supabase dashboard history
2. Go to Functions → consultor-rag → Deployments tab
3. Find previous deployment
4. Click "Redeploy" on the working version

Or revert files manually:
```bash
git checkout HEAD~1 -- supabase/functions/consultor-rag/
```

## Success Metrics

Monitor these after deployment:
- ✅ Zero infinite loop reports
- ✅ Successful phase transitions from anamnese → mapeamento
- ✅ Entregáveis generated for completed phases
- ✅ Reduced "No actions to execute" warnings in logs
- ✅ Timeline shows proper phase progression

## Support

If deployment has issues:
1. Check Edge Function logs in Supabase dashboard
2. Verify both files were updated (index.ts and consultor-prompts.ts)
3. Check that environment variables are set (OPENAI_API_KEY)
4. Test with a fresh session (create new conversation)
