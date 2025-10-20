import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('📦 Lendo arquivo de migration...');
    const migrationPath = join(process.cwd(), 'supabase/migrations/20251013000000_create_templates_entregaveis.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Aplicando migration...');

    // Executar migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Erro ao aplicar migration:', error);
      process.exit(1);
    }

    console.log('✅ Migration aplicada com sucesso!');

    // Verificar se templates foram criados
    const { data: templates, error: checkError } = await supabase
      .from('templates_entregaveis')
      .select('nome')
      .limit(5);

    if (checkError) {
      console.log('⚠️  Erro ao verificar templates:', checkError.message);
    } else {
      console.log(`✅ ${templates.length} templates encontrados na base`);
      templates.forEach(t => console.log(`   - ${t.nome}`));
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

applyMigration();
