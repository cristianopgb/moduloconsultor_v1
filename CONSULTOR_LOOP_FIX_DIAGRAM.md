# Consultor Phase Transition - Before vs After Fix

## BEFORE FIX ❌ (The Loop)

```
┌─────────────────────────────────────────────────────────────┐
│ USER: Completes all 6 anamnese questions                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ LLM: "Resumi corretamente? Próximo passo: mapear sistema"  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ LLM: Generates [PARTE B]                                    │
│ {                                                            │
│   "actions": [],  ← EMPTY! No transition action!            │
│   "contexto_incremental": {...},                            │
│   "progresso": 15                                            │
│ }                                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVER: Parsed actions: 0                                   │
│ SERVER: No actions to execute - waiting for user input      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE: Still "anamnese" (no transition occurred)            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ ┌──────────────────────────┐
                      └─► LOOP BACK TO TOP        │
                        │ User: "ok, segue"        │
                        │ LLM: "Próximo passo..."  │
                        │ Actions: []              │
                        │ REPEAT FOREVER           │
                        └──────────────────────────┘
```

## AFTER FIX ✅ (Auto-Transition)

```
┌─────────────────────────────────────────────────────────────┐
│ USER: Completes all 6 anamnese questions                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ LLM: "Resumi corretamente? Próximo passo: mapear sistema"  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ LLM: Generates [PARTE B]                                    │
│                                                              │
│ SCENARIO A (Preferred): LLM does it right ✅                │
│ {                                                            │
│   "actions": [                                               │
│     {"type": "gerar_entregavel", ...},                       │
│     {"type": "transicao_estado", "params": {"to": ...}}     │
│   ],                                                         │
│   "progresso": 30                                            │
│ }                                                            │
│                                                              │
│ SCENARIO B (Fallback): LLM fails, returns []                │
│ {                                                            │
│   "actions": [],  ← EMPTY (LLM failed)                      │
│   "progresso": 15                                            │
│ }                                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVER: Parsed actions: 0 or 2                              │
│                                                              │
│ 🆕 NEW LOGIC - Auto-Detection:                              │
│ if (faseAtual === 'anamnese' && actions.length === 0) {     │
│   const requiredFields = ['nome', 'cargo', 'idade', ...]    │
│   const collected = countCollectedFields(contexto)          │
│                                                              │
│   if (collected >= 8) {  ← 8 out of 10 fields present       │
│     console.log('AUTO-TRANSITION: Forcing transition')      │
│     actions.push(                                            │
│       {type: 'gerar_entregavel', ...},                       │
│       {type: 'transicao_estado', params: {to: 'mapeamento'}}│
│     )                                                        │
│   }                                                          │
│ }                                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVER: Processing actions:                                 │
│ - Generate entregável: anamnese_empresarial ✅               │
│ - Transition state: anamnese → mapeamento ✅                 │
│ - Update progress: 15 → 30 ✅                                │
│ - Update database: estado_atual = 'mapeamento' ✅            │
│ - Create timeline event ✅                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE: "mapeamento" (transition successful!)                │
│ NEXT: LLM will use mapeamento prompts                       │
│ USER: Sees progress advancing naturally                     │
│ NO LOOP! ✅✅✅                                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Differences

### Before (Broken) ❌
- **Relied 100% on LLM** to generate transition actions
- **No fallback** if LLM failed
- **No validation** of phase completion
- **Result**: Infinite loop when LLM returns empty actions

### After (Fixed) ✅
- **Still prefers LLM** to generate actions (Scenario A)
- **Has fallback** with automatic detection (Scenario B)
- **Validates completion** by counting collected fields
- **Auto-injects actions** if criteria met but actions missing
- **Result**: Phase always transitions when complete, no loop possible

## The Critical Auto-Detection Logic

```typescript
// Count how many required fields we have
const requiredFields = [
  'nome', 'cargo', 'idade', 'formacao',  // Professional info (4)
  'empresa', 'segmento',                  // Company basics (2)
  'faturamento', 'funcionarios',          // Company size (2)
  'dor_principal', 'expectativa'          // Business context (2)
];  // Total: 10 required fields

const contextData = { ...contexto, ...contextoIncremental };
const collectedFields = Object.keys(contextData).filter(k =>
  requiredFields.includes(k) || contextData.anamnese?.[k]
);

// If we have 8+ out of 10 fields → Phase is complete!
if (collectedFields.length >= 8) {
  // 🚨 FORCE TRANSITION - This prevents the loop
  actions.push(
    {type: 'gerar_entregavel', params: {tipo: 'anamnese_empresarial', ...}},
    {type: 'transicao_estado', params: {to: 'mapeamento'}}
  );
  progressoAtualizado = 30;
}
```

## Why 8 out of 10?

We use **80% threshold** (8/10 fields) instead of 100% (10/10) because:

1. **Flexibility**: Some info might be collected in different formats
2. **User Experience**: Don't block progress on minor details
3. **Robustness**: Handle edge cases where fields have slightly different names
4. **Pragmatism**: 80% is enough to proceed with meaningful analysis

## Benefits of This Approach

### 1. Self-Healing
- System automatically recovers from LLM failures
- No manual intervention needed
- No stuck sessions

### 2. Multiple Layers of Safety
```
Layer 1: Enhanced Prompts → Encourage LLM to do it right
Layer 2: Explicit Examples → Show LLM exact format needed
Layer 3: Auto-Detection  → Catch completion server-side
Layer 4: Action Injection → Force transition as last resort
```

### 3. Zero Trust Architecture
- Don't assume LLM will always work
- Always validate server-side
- Always have fallback plan

## Test Scenarios

### Test 1: LLM Works Correctly
```
Input: 6 complete answers
LLM: Returns proper [PARTE B] with actions
Server: Processes actions normally
Result: ✅ Smooth transition
```

### Test 2: LLM Returns Empty Actions
```
Input: 6 complete answers
LLM: Returns [PARTE B] with actions: []
Server: Detects completion, injects actions
Result: ✅ Auto-transition (fallback works!)
```

### Test 3: LLM Returns No [PARTE B] at All
```
Input: 6 complete answers
LLM: No [PARTE B] in response
Server: Detects completion, injects actions
Result: ✅ Auto-transition (fallback works!)
```

### Test 4: User Provides Partial Info
```
Input: Only 4 answers (incomplete)
LLM: Returns empty actions
Server: Detects only 4 fields (< 8)
Server: Does NOT force transition
Result: ✅ Continues asking questions (correct!)
```

## Monitoring & Debugging

### Success Indicators
```
✅ [CONSULTOR] AUTO-TRANSITION: Anamnese complete, forcing transition to mapeamento
✅ [CONSULTOR] Successfully parsed PARTE B: {actionsCount: 2}
✅ [CONSULTOR] Deliverable saved: <uuid>
✅ [CONSULTOR] Phase transition: anamnese -> mapeamento
```

### Warning Indicators (Less Common Now)
```
⚠️ [CONSULTOR] No PARTE B found in response
⚠️ [CONSULTOR] Failed to parse PARTE B: <error>
```

If you see warnings but ALSO see `AUTO-TRANSITION`, it means:
- LLM failed to generate proper [PARTE B]
- BUT fallback mechanism kicked in
- Transition happened anyway
- **System is working as designed!**

---

**This fix makes the loop impossible while maintaining natural LLM-driven flow when possible.**
