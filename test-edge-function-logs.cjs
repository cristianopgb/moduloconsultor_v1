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
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

async function checkLogs() {
  const sessaoId = process.argv[2] || '3539b4b7-9fa9-4e92-a70b-bdeb098cc3d0';
  
  console.log('Calling edge function with full logging...\n');

  const response = await fetch(supabaseUrl + '/functions/v1/consultor-rag', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessao_id: sessaoId,
      message: 'Test message'
    })
  });

  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));
  
  const text = await response.text();
  console.log('\nResponse body:');
  console.log(text);

  try {
    const json = JSON.parse(text);
    console.log('\nParsed JSON:');
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('\nCould not parse as JSON');
  }
}

checkLogs().catch(console.error);
