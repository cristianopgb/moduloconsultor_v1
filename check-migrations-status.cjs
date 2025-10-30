const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigrations() {
  console.log('🔍 Checking Migrations Status\n');

  // Get applied migrations from database
  const { data: appliedMigrations, error } = await supabase
    .from('schema_migrations')
    .select('version')
    .order('version', { ascending: true });

  if (error) {
    console.error('❌ Could not fetch migrations from database:', error.message);
    console.log('\n⚠️  This is expected if schema_migrations table does not exist yet.');
    console.log('   Supabase tracks migrations internally. Your migrations are likely applied.\n');
  }

  // Get migration files from filesystem
  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📊 Total migration files: ${migrationFiles.length}`);

  if (appliedMigrations) {
    console.log(`✅ Applied migrations in DB: ${appliedMigrations.length}\n`);
  }

  // Critical migrations that MUST exist
  const criticalMigrations = [
    '20251011150427_create_consultor_module_schema.sql',
    '20251030000000_add_missing_consultor_columns.sql',
    '20251030120000_backfill_jornadas_for_sessoes.sql',
    '20251030130000_fix_duplicate_policies.sql'
  ];

  console.log('🎯 CRITICAL MIGRATIONS (must be applied):');
  console.log('─'.repeat(60));

  criticalMigrations.forEach((filename, index) => {
    const exists = migrationFiles.includes(filename);
    const status = exists ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${filename}`);
  });

  console.log('\n📋 LATEST 10 MIGRATIONS:');
  console.log('─'.repeat(60));

  migrationFiles.slice(-10).forEach((filename, index) => {
    console.log(`${migrationFiles.length - 10 + index + 1}. ${filename}`);
  });

  console.log('\n💡 RECOMMENDATIONS:');
  console.log('─'.repeat(60));

  // Check if consultor tables exist
  const { data: tables, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', ['consultor_sessoes', 'jornadas_consultor', 'entregaveis_consultor']);

  if (!tableError && tables) {
    console.log(`\n✅ Core tables found: ${tables.length}/3`);
    tables.forEach(t => console.log(`   - ${t.table_name}`));

    if (tables.length === 3) {
      console.log('\n🎉 All core tables exist! Database is ready.');
      console.log('\n📝 You can now:');
      console.log('   1. npm run dev');
      console.log('   2. Open http://localhost:5173');
      console.log('   3. Create a conversation in "Consultor" mode');
      console.log('   4. Test the intelligent consultant flow');
    } else {
      console.log('\n⚠️  Some core tables missing. Migrations may need to be applied.');
    }
  }

  // Check for sessoes without jornada_id
  const { data: orphans, error: orphanError } = await supabase
    .from('consultor_sessoes')
    .select('id', { count: 'exact', head: true })
    .is('jornada_id', null);

  if (!orphanError && orphans !== null) {
    const count = orphans.length || 0;
    if (count === 0) {
      console.log('\n✅ No orphan sessions (all have jornada_id)');
    } else {
      console.log(`\n⚠️  Found ${count} sessions without jornada_id`);
      console.log('   Run: node apply-backfill.cjs');
    }
  }

  console.log('\n🚀 NEXT STEPS:');
  console.log('─'.repeat(60));
  console.log('1. If tables exist: You are ready to go! Run: npm run dev');
  console.log('2. If tables missing: Contact admin to apply migrations');
  console.log('3. If orphan sessions: Run: node apply-backfill.cjs');
  console.log('');
}

checkMigrations().catch(console.error);
