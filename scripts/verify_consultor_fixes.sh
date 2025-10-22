#!/bin/bash

echo "🔍 Verifying Consultor Chat Fixes..."
echo ""

INDEX_FILE="supabase/functions/consultor-chat/index.ts"

# Check if file exists
if [ ! -f "$INDEX_FILE" ]; then
  echo "❌ Error: $INDEX_FILE not found!"
  exit 1
fi

echo "✅ File exists: $INDEX_FILE"
echo ""

# Check for required classes
echo "📋 Checking for required classes..."

if grep -q "class IntelligentPromptBuilder" "$INDEX_FILE"; then
  echo "✅ IntelligentPromptBuilder class found"
else
  echo "❌ Missing IntelligentPromptBuilder class"
fi

if grep -q "class MarkerProcessor" "$INDEX_FILE"; then
  echo "✅ MarkerProcessor class found"
else
  echo "❌ Missing MarkerProcessor class"
fi

if grep -q "class DeliverableGenerator" "$INDEX_FILE"; then
  echo "✅ DeliverableGenerator class found"
else
  echo "❌ Missing DeliverableGenerator class"
fi

if grep -q "function isFormAlreadyFilled" "$INDEX_FILE"; then
  echo "✅ isFormAlreadyFilled function found"
else
  echo "❌ Missing isFormAlreadyFilled function"
fi

echo ""
echo "📋 Checking form detection logic..."

if grep -q "form_type === 'cadeia_valor'" "$INDEX_FILE"; then
  echo "✅ Checks form_type for cadeia_valor"
else
  echo "⚠️  May not check form_type explicitly"
fi

if grep -q "form_data.processos && Array.isArray(form_data.processos)" "$INDEX_FILE"; then
  echo "✅ Checks for processos array in form_data"
else
  echo "❌ Missing check for processos array"
fi

if grep -q "cadeia_valor_processos" "$INDEX_FILE"; then
  echo "✅ Saves processes to cadeia_valor_processos table"
else
  echo "❌ Does not save processes to database"
fi

echo ""
echo "📋 Checking deliverable generation..."

if grep -q "Use APENAS os dados fornecidos" "$INDEX_FILE" || grep -q "NÃO invente ou use mockups" "$INDEX_FILE"; then
  echo "✅ Prompts emphasize using real data"
else
  echo "⚠️  Prompts may not emphasize real data usage"
fi

if grep -q "__processos_mapeados" "$INDEX_FILE"; then
  echo "✅ Passes process data to deliverable generator"
else
  echo "❌ May not pass process data for deliverables"
fi

echo ""
echo "📋 Checking gamification..."

if grep -q "autoAwardXP" "$INDEX_FILE"; then
  echo "✅ autoAwardXP method exists"
else
  echo "❌ Missing autoAwardXP method"
fi

if grep -q "preAwardResult.*autoAwardXP" "$INDEX_FILE"; then
  echo "✅ Calls autoAwardXP on form submission"
else
  echo "⚠️  May not call autoAwardXP automatically"
fi

echo ""
echo "📋 Checking phase management..."

if grep -q "etapa_atual.*aguardando_validacao" "$INDEX_FILE"; then
  echo "✅ Updates etapa_atual and aguardando_validacao"
else
  echo "❌ May not update phase states"
fi

if grep -q "formKey.*form_type" "$INDEX_FILE" || grep -q "\[formKey\]" "$INDEX_FILE"; then
  echo "✅ Stores form data under form_type key"
else
  echo "⚠️  May not store form data correctly"
fi

echo ""
echo "📊 Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CLASS_COUNT=$(grep -c "^class " "$INDEX_FILE")
echo "Classes defined: $CLASS_COUNT"

FUNC_COUNT=$(grep -c "^function " "$INDEX_FILE")
echo "Functions defined: $FUNC_COUNT"

LINE_COUNT=$(wc -l < "$INDEX_FILE")
echo "Total lines: $LINE_COUNT"

echo ""
echo "✅ Verification complete!"
echo ""
echo "Next steps:"
echo "1. Deploy to Supabase: supabase functions deploy consultor-chat"
echo "2. Test with: node scripts/test_consultor_form_submission.js"
echo "3. Monitor Edge Function logs for errors"
