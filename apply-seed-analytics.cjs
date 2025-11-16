const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySeed() {
  console.log('📊 Applying Analytics Governance seed data...\n');

  const seedSQL = fs.readFileSync('./supabase/seed-analytics-governance.sql', 'utf8');

  // Split by semicolon and filter out comments/empty lines
  const statements = seedSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== '');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';

    // Extract table/entity name for logging
    const match = statement.match(/INSERT INTO (\w+)/);
    const target = match ? match[1] : `statement ${i + 1}`;

    try {
      await supabase.rpc('exec_sql', { sql_query: statement });
      console.log(`✅ ${target}`);
      successCount++;
    } catch (error) {
      // Ignore "already exists" errors (ON CONFLICT DO NOTHING)
      if (error.message && error.message.includes('duplicate')) {
        console.log(`⏭️  ${target} (already exists)`);
        successCount++;
      } else {
        console.error(`❌ ${target}:`, error.message);
        errorCount++;
      }
    }
  }

  console.log(`\n📊 Seed Summary:`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);

  if (errorCount === 0) {
    console.log('\n✅ Analytics Governance seed completed successfully!');
  } else {
    console.log('\n⚠️  Some errors occurred during seeding');
  }
}

applySeed().catch(console.error);
