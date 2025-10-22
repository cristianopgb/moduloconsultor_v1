# Consultor Chat - Fix Summary

## Issues Fixed

### 1. ❌ Missing Classes (Deployment Failure)
**Problem:** The `index.ts` file was importing classes that didn't exist:
- `IntelligentPromptBuilder` 
- `MarkerProcessor`
- `DeliverableGenerator`

**Solution:** Extracted these classes from `index-consolidated.ts` and embedded them directly in `index.ts`:

```typescript
// Added complete implementations of:
class IntelligentPromptBuilder { ... }
class MarkerProcessor { ... }
class DeliverableGenerator { ... }
```

### 2. ❌ Cadeia de Valor Form Not Recognized
**Problem:** After submitting the cadeia_valor form, the LLM didn't recognize it was completed and continued asking about Canvas.

**Root Cause:** The form detection logic only checked for `atividades_primarias` or `atividades_suporte` fields, but the actual form submits a `processos` array.

**Solution:** Enhanced form detection to check for all possible fields:
```typescript
// Before
else if (form_data.atividades_primarias || form_data.atividades_suporte) {
  await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_preenchida');
}

// After
else if (form_type === 'cadeia_valor' || 
         form_data.atividades_primarias || 
         form_data.atividades_suporte || 
         (form_data.processos && Array.isArray(form_data.processos))) {
  await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_preenchida');
  // Also save processes to database...
}
```

### 3. ❌ Gamification Not Working
**Problem:** XP not being awarded after form submission.

**Solution:** 
1. Implemented `autoAwardXP()` method in MarkerProcessor
2. Call it after every form submission:
```typescript
preAwardResult = await markerProcessor.autoAwardXP(conversation_id, 'formulario_preenchido');
```
3. Added fallback to conversation-level XP if jornada-level fails

### 4. ❌ Generic/Mockup Data in Deliverables
**Problem:** Generated deliverables (anamnese, cadeia_valor, escopo) contained generic mockup data instead of actual form data.

**Solution:** 
1. Updated all deliverable prompts to explicitly demand real data:
```typescript
IMPORTANTE: Use APENAS os dados fornecidos. NÃO invente ou use exemplos genéricos.
CRÍTICO: Liste TODOS os processos de gestão/suporte informados no formulário
NÃO use dados genéricos ou mockup - use APENAS os dados reais coletados
```

2. Enhanced `DeliverableGenerator` to pass actual process data:
```typescript
// For matriz and escopo, fetch processes from database
if (tipo === 'matriz_priorizacao' || tipo === 'escopo_projeto') {
  const { data: processos } = await this.supabase
    .from('cadeia_valor_processos')
    .select('id,nome,criticidade,impacto,esforco,descricao')
    .eq('jornada_id', jornada.id);
  
  (contexto as any).__processos_mapeados = processos;
}
```

3. Changed LLM system prompt to emphasize real data:
```typescript
{ role: 'system', content: 'Você é um gerador de documentos de consultoria. Produza HTML clean, com CSS embutido padronizado. Use APENAS dados fornecidos, NUNCA invente ou use mockups genéricos.' }
```

### 5. ❌ Process Management Missing in Deliverables
**Problem:** Cadeia de Valor deliverable was missing processo de gestão (support processes).

**Solution:** Updated prompt to explicitly request all process types:
```typescript
cadeia_valor: `...
CRÍTICO:
1. Liste TODOS os processos de gestão/suporte informados no formulário
2. Liste TODOS os processos primários informados no formulário
3. Para cada processo, mostre: nome, descrição (se disponível), impacto, criticidade
...`
```

### 6. ❌ Escopo Not Showing Prioritized Processes
**Problem:** Escopo deliverable was generic and didn't reference the matriz de priorização.

**Solution:** Enhanced escopo prompt to use prioritized processes:
```typescript
escopo_projeto: `...
REQUISITOS CRÍTICOS:
1. Use a Matriz de Priorização para listar os processos que serão trabalhados
2. Liste explicitamente os 3-5 processos priorizados com:
   - Nome e descrição do processo
   - Razão da priorização (baseada em impacto/criticidade/esforço)
   - Escopo do trabalho na fase de execução
   - Áreas envolvidas
   - Entregáveis esperados
   - Critérios de aceite
3. NÃO use texto genérico - referencie os entregáveis já gerados
...`
```

## Additional Improvements

### Form Context Storage
Changed to store form data under the form_type key (matching consolidated version):
```typescript
// Before
const updatedContext = { ...currentContext, ...form_data };

// After
const formKey = String(form_type || 'generico');
const updatedContext = { ...currentContext, [formKey]: form_data };
```

### Phase Management
Automatically update `etapa_atual` and `aguardando_validacao` when forms are submitted:
- anamnese → etapa: 'anamnese', validation: 'anamnese'
- canvas → etapa: 'modelagem', validation: null
- cadeia_valor → etapa: 'modelagem', validation: null
- matriz_priorizacao → etapa: 'priorizacao', validation: 'priorizacao'
- atributos_processo → etapa: 'execucao', validation: null

### Auto-Generate Deliverables
When cadeia_valor is complete (modelagem phase with both canvas and cadeia_valor):
1. Auto-generate: anamnese, canvas, cadeia_valor deliverables
2. Set validation to 'modelagem'
3. When modelagem is validated:
   - Advance to 'priorizacao' phase
   - Auto-generate: matriz_priorizacao, escopo_projeto
   - Set validation to 'priorizacao'

### Process Persistence
When cadeia_valor form is submitted with processos array:
```typescript
// Delete old processes
await supabase.from('cadeia_valor_processos').delete().eq('jornada_id', jornada.id);

// Insert new processes
const toInsert = form_data.processos.map((p: any) => ({
  jornada_id: jornada.id,
  nome: p.nome || p.process_name || String(p).slice(0, 200),
  descricao: p.descricao || p.descricao_curta || null,
  impacto: p.impacto ?? (p.impact || null),
  criticidade: p.criticidade ?? p.criticality ?? null,
  esforco: p.esforco ?? p.esforco_estimado ?? null
}));

await supabase.from('cadeia_valor_processos').insert(toInsert);
```

## Testing Checklist

- [ ] Deploy updated `index.ts` to Supabase Edge Function
- [ ] Test anamnese form submission → verify phase update and XP award
- [ ] Test canvas form submission → verify phase stays in modelagem
- [ ] Test cadeia_valor form submission with processos array:
  - [ ] Verify processes saved to cadeia_valor_processos table
  - [ ] Verify LLM recognizes completion (doesn't ask for canvas again)
  - [ ] Verify XP awarded
  - [ ] Verify deliverables auto-generated (anamnese, canvas, cadeia_valor)
- [ ] Test modelagem validation → verify auto-advance to priorizacao
- [ ] Test matriz and escopo generation:
  - [ ] Verify matriz uses real process data (not mockup)
  - [ ] Verify escopo lists prioritized processes explicitly
  - [ ] Verify processo de gestão included in deliverables
- [ ] Verify gamification throughout the flow

## Files Modified

- `supabase/functions/consultor-chat/index.ts` - Main function file (complete rewrite with embedded classes)

## Files Referenced (Not Modified)

- `supabase/functions/consultor-chat/framework-guide.ts` - Framework checklist and event marking
- `supabase/functions/consultor-chat/index-consolidated.ts` - Source for class implementations

## Deployment

To deploy the updated function:

```bash
# Using Supabase CLI
supabase functions deploy consultor-chat

# Or manually via Supabase Dashboard:
# 1. Navigate to Edge Functions
# 2. Select consultor-chat
# 3. Upload the updated index.ts
# 4. Deploy
```

## Next Steps

1. **Test in Development** - Use the test script to verify changes
2. **Monitor Logs** - Check Edge Function logs for any errors
3. **User Testing** - Have the user test the complete flow
4. **Performance** - Monitor deliverable generation time (may need caching)
5. **Refinement** - Adjust prompts based on deliverable quality

## Notes

- The main issue was that classes were imported but didn't exist as separate files
- Form detection was incomplete - needed to check form_type explicitly
- Deliverable prompts needed stronger emphasis on using real data
- Phase management was missing - forms weren't updating the journey state
- Process persistence was missing - cadeia_valor data wasn't being saved
