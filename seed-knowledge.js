import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = fs.readFileSync('./supabase/seed-knowledge-base.sql', 'utf8');

(async () => {
  try {
    console.log('Seeding knowledge base...');

    // Split SQL into individual INSERT statements
    const statements = sql.split(/;\s*\n/).filter(s => s.trim() && s.trim() !== 'COMMIT');

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt.startsWith('INSERT INTO knowledge_base_documents')) {
        console.log(`Inserting document ${i + 1}...`);
        const { error } = await supabase.rpc('exec_sql_secure', { sql_query: stmt + ';' });
        if (error) {
          console.error(`Error inserting document ${i + 1}:`, error.message);
        }
      }
    }

    console.log('✅ Knowledge base seeded successfully');

    // Verify
    const { data: docs, error: queryError } = await supabase
      .from('knowledge_base_documents')
      .select('title, category, tags')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('Query error:', queryError);
    } else {
      console.log(`\nTotal documents in knowledge base: ${docs.length}`);
      docs.forEach(doc => {
        console.log(`- ${doc.title} [${doc.category}] - Tags: ${doc.tags.join(', ')}`);
      });
    }
  } catch (err) {
    console.error('Exception:', err.message);
    process.exit(1);
  }
})();
