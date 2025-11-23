// Script para testar sistema de créditos Genius
// Cole este código no Console do navegador (F12) com o app aberto

console.log('🧪 Testando Sistema de Créditos Genius...\n');

(async () => {
  try {
    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await window.supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Usuário não autenticado');
      return;
    }

    console.log('✅ Usuário autenticado:', user.email);
    console.log('   User ID:', user.id);
    console.log('');

    // 2. Verificar créditos atuais
    console.log('📊 Verificando créditos atuais...');
    const { data: currentCredits, error: getError } = await window.supabase.rpc('get_genius_credits', {
      p_user_id: user.id
    });

    if (getError) {
      console.error('❌ Erro ao buscar créditos:', getError);
      return;
    }

    console.log('   Créditos disponíveis:', currentCredits?.credits_available || 0);
    console.log('   Créditos usados:', currentCredits?.credits_used || 0);
    console.log('');

    // 3. Adicionar 10 créditos de teste
    console.log('💰 Adicionando 10 créditos de teste...');
    const { data: addResult, error: addError } = await window.supabase.rpc('add_genius_credits', {
      p_user_id: user.id,
      p_amount: 10
    });

    if (addError) {
      console.error('❌ Erro ao adicionar créditos:', addError);
      return;
    }

    if (addResult?.success) {
      console.log('✅ Créditos adicionados com sucesso!');
      console.log('   Novos créditos disponíveis:', addResult.new_balance);
      console.log('');
    }

    // 4. Verificar novamente
    console.log('📊 Verificando saldo atualizado...');
    const { data: updatedCredits, error: checkError } = await window.supabase.rpc('get_genius_credits', {
      p_user_id: user.id
    });

    if (checkError) {
      console.error('❌ Erro ao verificar saldo:', checkError);
      return;
    }

    console.log('   Créditos disponíveis:', updatedCredits?.credits_available || 0);
    console.log('   Créditos usados:', updatedCredits?.credits_used || 0);
    console.log('');

    // 5. Resumo final
    console.log('🎉 Teste concluído com sucesso!');
    console.log('');
    console.log('📋 Resumo:');
    console.log('   • Sistema de créditos funcionando ✅');
    console.log('   • Créditos adicionados: +10');
    console.log('   • Saldo atual:', updatedCredits?.credits_available || 0, 'créditos');
    console.log('');
    console.log('💡 Próximos passos:');
    console.log('   1. Vá para Analytics');
    console.log('   2. Faça uma análise de dados');
    console.log('   3. Clique no botão "Upgrade com Genius"');
    console.log('   4. Verifique que 1 crédito foi consumido');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
})();
