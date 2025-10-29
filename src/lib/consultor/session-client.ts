import { supabase } from '../supabase';

/**
 * Cliente frontend para atualizar contexto de sessao de forma segura
 * Chama Edge Function que valida autorizacao no backend
 */
export async function updateSessaoContext(
  sessaoId: string,
  formData: Record<string, any>
): Promise<boolean> {
  try {
    console.log('[SESSION-CLIENT] Updating context for sessao:', sessaoId);

    const { data, error } = await supabase.functions.invoke('update-session-context', {
      body: { sessaoId, formData }
    });

    if (error) {
      console.error('[SESSION-CLIENT] Error calling function:', error);
      return false;
    }

    if (!data?.success) {
      console.error('[SESSION-CLIENT] Function returned error');
      return false;
    }

    console.log('[SESSION-CLIENT] Context updated successfully');
    return true;

  } catch (error: any) {
    console.error('[SESSION-CLIENT] Exception:', error);
    return false;
  }
}
