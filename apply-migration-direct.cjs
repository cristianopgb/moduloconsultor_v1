const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function exec(sql) {
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) throw error;
}

async function main() {
  console.log('📦 Aplicando migração nome→titulo...\n');

  try {
    // 1. Make nome nullable
    console.log('1️⃣ Tornando coluna nome nullable...');
    await exec('ALTER TABLE entregaveis_consultor ALTER COLUMN nome DROP NOT NULL;');
    console.log('   ✅ Done\n');

    // 2. Add titulo if not exists and copy data
    console.log('2️⃣ Adicionando coluna titulo e copiando dados...');
    await exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'entregaveis_consultor' AND column_name = 'titulo'
        ) THEN
          ALTER TABLE entregaveis_consultor ADD COLUMN titulo text;
        END IF;
      END $$;
    `);
    console.log('   ✅ Coluna titulo adicionada\n');

    console.log('3️⃣ Copiando dados nome→titulo...');
    await exec('UPDATE entregaveis_consultor SET titulo = nome WHERE titulo IS NULL AND nome IS NOT NULL;');
    console.log('   ✅ Dados copiados\n');

    console.log('4️⃣ Definindo titulo como NOT NULL com default...');
    await exec("ALTER TABLE entregaveis_consultor ALTER COLUMN titulo SET DEFAULT 'Documento sem título';");
    await exec('UPDATE entregaveis_consultor SET titulo = nome WHERE titulo IS NULL;');
    await exec("UPDATE entregaveis_consultor SET titulo = 'Documento sem título' WHERE titulo IS NULL;");
    await exec('ALTER TABLE entregaveis_consultor ALTER COLUMN titulo SET NOT NULL;');
    console.log('   ✅ titulo agora é NOT NULL\n');

    console.log('5️⃣ Criando trigger de sincronização...');
    await exec(`
      CREATE OR REPLACE FUNCTION sync_nome_titulo()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.titulo IS NULL AND NEW.nome IS NOT NULL THEN
          NEW.titulo := NEW.nome;
        END IF;
        IF NEW.titulo IS NULL THEN
          NEW.titulo := 'Documento ' || NEW.tipo;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await exec('DROP TRIGGER IF EXISTS trigger_sync_nome_titulo ON entregaveis_consultor;');
    await exec('CREATE TRIGGER trigger_sync_nome_titulo BEFORE INSERT OR UPDATE ON entregaveis_consultor FOR EACH ROW EXECUTE FUNCTION sync_nome_titulo();');
    console.log('   ✅ Trigger criado\n');

    console.log('✅ Migração completa!\n');

    // Test
    console.log('🧪 Testando insert...');
    const { data, error } = await supabase
      .from('entregaveis_consultor')
      .insert({
        sessao_id: '00000000-0000-0000-0000-000000000000',
        jornada_id: '00000000-0000-0000-0000-000000000000',
        tipo: 'teste',
        titulo: 'Teste Final',
        slug: 'teste-' + Date.now(),
        etapa_origem: 'diagnostico'
      })
      .select('id, titulo')
      .single();

    if (error) {
      console.error('❌ Teste falhou:', error.message);
    } else {
      console.log('✅ Insert funcionou! ID:', data.id);
      await supabase.from('entregaveis_consultor').delete().eq('id', data.id);
      console.log('✅ Teste limpo\n');
    }

  } catch (err) {
    console.error('\n❌ Erro:', err.message);
    process.exit(1);
  }
}

main();
