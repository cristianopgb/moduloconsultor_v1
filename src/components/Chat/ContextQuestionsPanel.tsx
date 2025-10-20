/**
 * CONTEXT QUESTIONS PANEL - DINÂMICO COM HISTÓRICO
 *
 * Sistema conversacional natural que:
 * - Mostra histórico completo de mensagens (LLM + usuário)
 * - Suporta mensagens dinâmicas (perguntas, declarações, confirmações)
 * - Campo de resposta aparece apenas quando LLM espera resposta
 * - Persistência automática no banco de dados
 * - Recupera histórico ao voltar para a conversa
 */

import { useState, useEffect, useRef } from 'react';
import { HelpCircle, Send, Sparkles, Bot, User, Loader2, SkipForward } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface DialogueMessage {
  id: string;
  message_type: 'llm_question' | 'llm_statement' | 'user_answer' | 'user_message';
  content: string;
  expects_response: boolean;
  metadata?: {
    suggestions?: string[];
    related_question_id?: string;
    confidence?: number;
  };
  created_at: string;
}

export interface DialogueState {
  id: string;
  conversation_id: string;
  state: 'idle' | 'conversing' | 'ready_to_analyze' | 'analyzing' | 'completed';
  completeness_score: number;
  ready_for_analysis: boolean;
}

interface ContextQuestionsPanelProps {
  conversationId: string;
  onAnswerSubmit: (answer: string) => Promise<void>;
  onSkip: () => void;
  className?: string;
}

export function ContextQuestionsPanel({
  conversationId,
  onAnswerSubmit,
  onSkip,
  className = ''
}: ContextQuestionsPanelProps) {
  const [dialogueState, setDialogueState] = useState<DialogueState | null>(null);
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rolar para o final quando novas mensagens chegam
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Carregar estado e histórico ao montar ou quando conversationId muda
  useEffect(() => {
    loadDialogueState();
  }, [conversationId]);

  async function loadDialogueState() {
    try {
      setLoading(true);

      // Buscar estado do diálogo
      const { data: stateData, error: stateError } = await supabase
        .from('dialogue_states')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (stateError) throw stateError;

      if (stateData) {
        setDialogueState(stateData);

        // Buscar histórico de mensagens
        const { data: messagesData, error: messagesError } = await supabase
          .from('dialogue_messages')
          .select('*')
          .eq('dialogue_state_id', stateData.id)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        setMessages(messagesData || []);
      }
    } catch (error) {
      console.error('[ContextQuestionsPanel] Erro ao carregar estado:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer || submitting) return;

    setSubmitting(true);

    try {
      // Salvar resposta do usuário no histórico
      if (dialogueState) {
        await supabase.from('dialogue_messages').insert({
          dialogue_state_id: dialogueState.id,
          message_type: 'user_answer',
          content: trimmedAnswer,
          expects_response: false,
          metadata: {}
        });
      }

      // Enviar para o backend processar
      await onAnswerSubmit(trimmedAnswer);

      // Limpar campo
      setAnswer('');

      // Recarregar histórico após resposta (nova mensagem da LLM deve chegar)
      setTimeout(loadDialogueState, 500);
    } catch (error) {
      console.error('[ContextQuestionsPanel] Erro ao enviar resposta:', error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setAnswer(suggestion);
    setShowSuggestions(false);
  }

  // Última mensagem define se mostra campo de input
  const lastMessage = messages[messages.length - 1];
  const shouldShowInput = lastMessage?.expects_response ?? false;
  const suggestions = lastMessage?.metadata?.suggestions || [];

  if (loading) {
    return (
      <div className={`bg-gray-800 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className="ml-3 text-gray-300">Carregando conversa...</span>
        </div>
      </div>
    );
  }

  if (!dialogueState || messages.length === 0) {
    return null; // Não mostrar painel se não há diálogo ativo
  }

  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-800/80 border border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-gray-700">
        <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30 flex-shrink-0">
          <HelpCircle className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white mb-1">
            Contextualizando análise
          </h3>
          <p className="text-sm text-gray-300">
            Conversa sobre os dados para criar análise precisa
          </p>
        </div>
        {dialogueState.completeness_score > 0 && (
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-blue-400">
              {dialogueState.completeness_score}%
            </div>
            <div className="text-xs text-gray-400">completude</div>
          </div>
        )}
      </div>

      {/* Histórico de mensagens */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {messages.map((msg) => {
          const isUser = msg.message_type === 'user_answer' || msg.message_type === 'user_message';
          const isQuestion = msg.message_type === 'llm_question';
          const isStatement = msg.message_type === 'llm_statement';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/30">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : isQuestion
                    ? 'bg-gray-700 border border-blue-500/30 text-gray-100'
                    : 'bg-gray-700/50 text-gray-200'
                }`}
              >
                {/* Ícone indicativo do tipo de mensagem */}
                {isQuestion && (
                  <div className="flex items-center gap-2 mb-2 text-blue-400 text-xs font-medium">
                    <HelpCircle className="w-3 h-3" />
                    <span>Pergunta</span>
                  </div>
                )}
                {isStatement && (
                  <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    <span>Entendimento</span>
                  </div>
                )}

                {/* Conteúdo da mensagem */}
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                  }}
                />

                {/* Timestamp */}
                <div className={`text-xs mt-2 ${isUser ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>

              {isUser && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Campo de resposta (só aparece se última mensagem espera resposta) */}
      {shouldShowInput && (
        <div className="p-4 border-t border-gray-700">
          {/* Sugestões (se disponíveis) */}
          {suggestions.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="text-xs text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                {showSuggestions ? 'Esconder' : 'Ver'} sugestões ({suggestions.length})
              </button>

              {showSuggestions && (
                <div className="mt-2 space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Campo de texto */}
          <div className="relative mb-3">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Digite sua resposta aqui..."
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-white placeholder-gray-400"
              rows={3}
              disabled={submitting}
            />
          </div>

          {/* Botões de ação */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onSkip}
              disabled={submitting}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 font-medium transition-colors disabled:opacity-50"
            >
              <SkipForward className="w-4 h-4" />
              Pular e analisar
            </button>

            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar
                </>
              )}
            </button>
          </div>

          {/* Dica de atalho */}
          <p className="text-xs text-gray-500 mt-2 text-center">
            💡 Pressione Cmd/Ctrl + Enter para enviar
          </p>
        </div>
      )}

      {/* Se não espera resposta mas diálogo ainda ativo */}
      {!shouldShowInput && dialogueState.state === 'conversing' && (
        <div className="p-4 border-t border-gray-700 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400 mx-auto" />
          <p className="text-sm text-gray-400 mt-2">Processando sua resposta...</p>
        </div>
      )}
    </div>
  );
}
