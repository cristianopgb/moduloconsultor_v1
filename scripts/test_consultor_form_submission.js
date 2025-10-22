import { createClient } from '@supabase/supabase-js'

async function main(){
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if(!url || !key){
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  console.log('Fetching a recent conversation...')
  const { data: convs, error: convErr } = await supabase.from('conversations').select('*').order('updated_at', { ascending: false }).limit(1)
  if(convErr || !convs || convs.length === 0){
    console.error('No conversation found', convErr)
    process.exit(1)
  }
  const conv = convs[0]
  console.log('Using conversation:', conv.id, 'user:', conv.user_id)

  const formData = {
    nome_empresa: 'ttimportados',
    nome_usuario: 'Cristiano',
    empresa_nome: 'ttimportados'
  }

  console.log('Inserting summary message into messages...')
  const { error: insErr } = await supabase.from('messages').insert({
    conversation_id: conv.id,
    role: 'user',
    content: `Formulário submetido (anamnese): ${JSON.stringify(formData)}`,
    user_id: conv.user_id,
    message_type: 'form_submission'
  })
  if(insErr) console.warn('Insert message error:', insErr)

  console.log('Invoking consultor-chat function...')
  const { data: fnData, error: fnErr } = await supabase.functions.invoke('consultor-chat', {
    body: {
      message: 'Formulário anamnese preenchido',
      conversation_id: conv.id,
      user_id: conv.user_id,
      form_type: 'anamnese',
      form_data: formData
    }
  })

  if(fnErr){
    console.error('Function error:', fnErr)
  } else {
    console.log('Function response:', JSON.stringify(fnData, null, 2))
  }

  console.log('Fetching gamificacao_conversa for conversation...')
  const { data: gam, error: gamErr } = await supabase.from('gamificacao_conversa').select('*').eq('conversation_id', conv.id).maybeSingle()
  if(gamErr) console.error('Error fetching gamificacao_conversa:', gamErr)
  else console.log('Gamificacao:', JSON.stringify(gam, null, 2))
}

main().catch(err=>{console.error(err); process.exit(1)})
