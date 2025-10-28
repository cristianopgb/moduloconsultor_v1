const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gljoasdvlaitplbmbtzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsam9hc2R2bGFpdHBsYm1idHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDkxNjUsImV4cCI6MjA2OTU4NTE2NX0.kCsEuVDTMYuhq8Zf_1yQGubkqcpgaBhgGkjpvk1xpwI';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('=== Checking RAG System Status ===\n');

  // Check if knowledge_base_documents table exists and is populated
  const { data: docs, error: docsError } = await supabase
    .from('knowledge_base_documents')
    .select('id, title, category, ativo')
    .eq('ativo', true);

  if (docsError) {
    console.log('❌ knowledge_base_documents table: ERROR');
    console.log('   Error:', docsError.message);
  } else {
    console.log('✅ knowledge_base_documents table: EXISTS');
    console.log(`   Documents: ${docs.length}`);
    if (docs.length === 0) {
      console.log('   ⚠️  Knowledge base is EMPTY - needs seeding!');
    } else {
      docs.forEach(d => console.log(`     - ${d.title} (${d.category})`));
    }
  }

  console.log('');

  // Check consultor_sessoes table
  const { data: sessoes, error: sessoesError } = await supabase
    .from('consultor_sessoes')
    .select('id')
    .limit(1);

  if (sessoesError) {
    console.log('❌ consultor_sessoes table: ERROR');
    console.log('   Error:', sessoesError.message);
  } else {
    console.log('✅ consultor_sessoes table: EXISTS');
  }

  // Check orquestrador_acoes table
  const { data: acoes, error: acoesError } = await supabase
    .from('orquestrador_acoes')
    .select('id')
    .limit(1);

  if (acoesError) {
    console.log('❌ orquestrador_acoes table: ERROR');
    console.log('   Error:', acoesError.message);
  } else {
    console.log('✅ orquestrador_acoes table: EXISTS');
  }

  console.log('');

  // Check which edge functions exist
  console.log('Checking Edge Functions...');
  console.log('Note: Cannot directly query functions list via client SDK');
  console.log('You need to check Supabase Dashboard > Edge Functions');

  console.log('\n=== Summary ===');
  console.log('RAG Tables:', docsError || sessoesError || acoesError ? '❌ Some tables missing' : '✅ All present');
  console.log('Knowledge Base:', docs && docs.length > 0 ? `✅ ${docs.length} documents` : '❌ Empty or error');
  console.log('Next Steps:');
  if (!docs || docs.length === 0) {
    console.log('  1. Populate knowledge base using seed-knowledge-base.sql');
  }
  console.log('  2. Deploy consultor-rag Edge Function');
  console.log('  3. Update frontend to call consultor-rag');
})();
