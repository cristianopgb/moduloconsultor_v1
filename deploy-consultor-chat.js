import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployFunction() {
  try {
    console.log('📦 Lendo arquivo consolidado...');
    const indexContent = readFileSync('./consultor-chat-consolidated-index.ts', 'utf-8');

    const lines = indexContent.split('\n').length;
    console.log(`📝 Arquivo lido: ${indexContent.length} caracteres, ${lines} linhas`);

    console.log('🚀 Fazendo deploy da função consultor-chat...');

    const { data, error } = await supabase.functions.invoke('_deploy', {
      body: {
        slug: 'consultor-chat',
        name: 'consultor-chat',
        verify_jwt: true,
        entrypoint_path: 'index.ts',
        files: [
          {
            name: 'index.ts',
            content: indexContent
          }
        ]
      }
    });

    if (error) {
      console.error('❌ Erro no deploy:', error);
      process.exit(1);
    }

    console.log('✅ Deploy concluído com sucesso!');
    console.log('📊 Resposta:', data);
  } catch (err) {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  }
}

deployFunction();
