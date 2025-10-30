import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Atualiza contexto de uma sessao com validacao de seguranca
 * @param supabase - Cliente Supabase com SERVICE_ROLE
 * @param sessaoId - ID da sessao a atualizar
 * @param userId - ID do usuario (para validacao de propriedade)
 * @param formData - Dados a adicionar ao contexto
 * @returns Contexto atualizado ou null se erro
 */
export async function updateSessaoContext(
  supabase: SupabaseClient,
  sessaoId: string,
  userId: string,
  formData: Record<string, any>
): Promise<Record<string, any> | null> {
  try {
    console.log('[SESSION-UTILS] Updating context for sessao:', sessaoId);

    const { data: sessao, error: fetchError } = await supabase
      .from('consultor_sessoes')
      .select('user_id, contexto_negocio')
      .eq('id', sessaoId)
      .single();

    if (fetchError) {
      console.error('[SESSION-UTILS] Error fetching sessao:', fetchError);
      return null;
    }

    if (!sessao) {
      console.error('[SESSION-UTILS] Sessao not found:', sessaoId);
      return null;
    }

    if (sessao.user_id !== userId) {
      console.error('[SESSION-UTILS] User not authorized:', { userId, owner: sessao.user_id });
      return null;
    }

    const updatedContext = deepMerge(sessao.contexto_negocio || {}, formData);

    const { error: updateError } = await supabase
      .from('consultor_sessoes')
      .update({
        contexto_negocio: updatedContext,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessaoId);

    if (updateError) {
      console.error('[SESSION-UTILS] Error updating sessao:', updateError);
      return null;
    }

    console.log('[SESSION-UTILS] Context updated successfully');
    return updatedContext;

  } catch (error: any) {
    console.error('[SESSION-UTILS] Exception in updateSessaoContext:', error);
    return null;
  }
}

/**
 * Merge profundo recursivo de objetos
 */
function deepMerge(target: any, source: any): any {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Busca sessao com validacao de propriedade
 */
export async function getSessaoIfOwner(
  supabase: SupabaseClient,
  sessaoId: string,
  userId: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('consultor_sessoes')
    .select('*')
    .eq('id', sessaoId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('[SESSION-UTILS] Error fetching sessao:', error);
    return null;
  }

  return data;
}
