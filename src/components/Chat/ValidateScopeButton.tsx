import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ValidateScopeButtonProps {
  conversationId: string;
  userId: string;
  onValidated?: () => void;
}

export function ValidateScopeButton({ conversationId, userId, onValidated }: ValidateScopeButtonProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    try {
      setIsValidating(true);
      setError(null);

      console.log('[VALIDATE-SCOPE] Calling validar-priorizacao function...');

      const { data, error: functionError } = await supabase.functions.invoke('validar-priorizacao', {
        body: {
          conversation_id: conversationId,
          user_id: userId
        }
      });

      if (functionError) {
        throw functionError;
      }

      console.log('[VALIDATE-SCOPE] ✅ Validation successful:', data);

      // Send a message to the chat to trigger next step
      // The marker [SET_VALIDACAO:priorizacao] will be handled by consultor-chat
      const message = '[SET_VALIDACAO:priorizacao]';

      const { error: sendError } = await supabase.functions.invoke('consultor-chat', {
        body: {
          message,
          conversation_id: conversationId,
          user_id: userId,
          form_data: null,
          form_type: null
        }
      });

      if (sendError) {
        console.warn('[VALIDATE-SCOPE] Error sending validation marker:', sendError);
      }

      // Notify parent component
      if (onValidated) {
        onValidated();
      }

      // Reload page to update UI
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      console.error('[VALIDATE-SCOPE] Error:', err);
      setError(err.message || 'Erro ao validar priorização');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="my-4 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-indigo-400" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-200 mb-1">
            Validação de Escopo
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Revise a matriz de priorização e o escopo do projeto na aba "Entregáveis".
            Se concordar com as prioridades sugeridas, valide para iniciar a execução.
          </p>

          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Validar Priorização</span>
              </>
            )}
          </button>

          {error && (
            <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
