// src/components/Chat/GeniusChat.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, Clock, Download, FileText, Image as ImageIcon, Table, File, Send } from 'lucide-react';
import { supabase, GeniusTask, GeniusAttachment, Message } from '../../lib/supabase';
import { GeniusApiService } from '../../services/geniusApi';
import { validateGeniusFiles, prepareFilesForUpload, formatFileSize, FileToValidate } from '../../utils/geniusValidation';
import { GeniusAttachmentModal } from '../Genius/GeniusAttachmentModal';

interface GeniusChatProps {
  conversationId: string;
  userId: string;
  messages: Message[];
  onMessagesUpdate: (messages: Message[]) => void;
  attachedFiles: File[];
  onClearFiles: () => void;
}

export function GeniusChat({
  conversationId,
  userId,
  messages,
  onMessagesUpdate,
  attachedFiles,
  onClearFiles
}: GeniusChatProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTask, setCurrentTask] = useState<GeniusTask | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<GeniusAttachment | null>(null);
  const [continueInput, setContinueInput] = useState('');

  // Realtime listener para atualizações de tarefas
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`genius-tasks-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'genius_tasks',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('[Genius] Task update:', payload);
          if (payload.new) {
            setCurrentTask(payload.new as GeniusTask);

            // Se tarefa completou, atualizar mensagens
            if (payload.new.status === 'completed') {
              refreshMessages();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Realtime listener para novas mensagens de resultado
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`genius-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.message_type === 'genius_result' || newMessage.message_type === 'genius_error') {
            console.log('[Genius] New result message:', newMessage);
            refreshMessages();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function refreshMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      onMessagesUpdate(data);
    }
  }

  async function sendGeniusTask() {
    if (!input.trim() || attachedFiles.length === 0 || loading) return;

    setLoading(true);
    setError('');

    try {
      // Validar arquivos
      const filesToValidate: FileToValidate[] = attachedFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }));

      const validation = validateGeniusFiles(filesToValidate);
      if (!validation.valid) {
        setError(validation.errors.join(' '));
        setLoading(false);
        return;
      }

      // Preparar arquivos (converter para base64)
      const preparedFiles = await prepareFilesForUpload(attachedFiles);

      // Criar mensagem do usuário
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        conversation_id: conversationId,
        role: 'user',
        content: input,
        message_type: 'genius_task',
        created_at: new Date().toISOString()
      };

      onMessagesUpdate([...messages, userMessage]);

      // Inserir no banco
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: input,
        message_type: 'genius_task'
      });

      // Chamar Edge Function para criar tarefa
      const response = await GeniusApiService.createTask({
        prompt: input,
        files: preparedFiles,
        conversationId
      });

      if (!response.success) {
        throw new Error(response.error || 'Falha ao criar tarefa');
      }

      // Criar mensagem de status
      const statusMessage: Message = {
        id: `temp-status-${Date.now()}`,
        conversation_id: conversationId,
        role: 'assistant',
        content: 'Processando sua solicitação no Manus...',
        message_type: 'genius_task',
        external_task_id: response.task_id,
        trace_id: response.trace_id,
        genius_status: 'pending',
        created_at: new Date().toISOString()
      };

      onMessagesUpdate([...messages, userMessage, statusMessage]);

      // Limpar input e arquivos
      setInput('');
      onClearFiles();

      // Refresh messages para pegar a versão do banco
      setTimeout(refreshMessages, 1000);

    } catch (err: any) {
      console.error('[Genius] Error sending task:', err);
      setError(err.message || 'Erro ao enviar tarefa');
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueTask(taskId: string) {
    if (!continueInput.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await GeniusApiService.continueTask({
        taskId,
        userResponse: continueInput
      });

      if (!response.success) {
        throw new Error(response.error || 'Falha ao continuar tarefa');
      }

      setContinueInput('');

      // Mensagem do usuário
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: continueInput,
        message_type: 'text',
        external_task_id: taskId
      });

      refreshMessages();

    } catch (err: any) {
      console.error('[Genius] Error continuing task:', err);
      setError(err.message || 'Erro ao continuar tarefa');
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status?: string) {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  }

  function getStatusText(status?: string) {
    switch (status) {
      case 'pending':
        return 'Na fila...';
      case 'running':
        return 'Processando...';
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      default:
        return '';
    }
  }

  function getFileIcon(mimeType: string) {
    if (mimeType === 'application/pdf') return <FileText className="w-5 h-5" />;
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (mimeType.includes('spreadsheet') || mimeType === 'text/csv') return <Table className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              {/* Status indicator para tarefas */}
              {msg.genius_status && (
                <div className="flex items-center gap-2 mb-2 text-sm">
                  {getStatusIcon(msg.genius_status)}
                  <span className="font-medium">{getStatusText(msg.genius_status)}</span>
                  {msg.genius_credit_usage && (
                    <span className="text-xs text-gray-400 ml-2">
                      ({msg.genius_credit_usage} créditos)
                    </span>
                  )}
                </div>
              )}

              {/* Conteúdo */}
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Anexos */}
              {msg.genius_attachments && msg.genius_attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-semibold">Arquivos gerados:</p>
                  {msg.genius_attachments.map((att, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedAttachment(att)}
                      className="flex items-center gap-3 w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-left"
                    >
                      <div className="text-blue-400">
                        {getFileIcon(att.mime_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{att.file_name}</p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(att.size_bytes)}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Interface de continuação */}
              {msg.genius_status === 'completed' &&
               msg.external_task_id &&
               currentTask?.stop_reason === 'ask' &&
               currentTask?.task_id === msg.external_task_id && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-sm mb-2 font-medium">O Manus precisa de mais informações:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={continueInput}
                      onChange={(e) => setContinueInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleContinueTask(msg.external_task_id!);
                        }
                      }}
                      placeholder="Digite sua resposta..."
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => handleContinueTask(msg.external_task_id!)}
                      disabled={!continueInput.trim() || loading}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Aviso de arquivos necessários */}
      {attachedFiles.length === 0 && (
        <div className="mx-4 mb-2 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg">
          <p className="text-sm text-purple-200">
            Anexe pelo menos 1 arquivo para enviar ao Genius (máx. 5 arquivos, 25MB cada)
          </p>
        </div>
      )}

      {/* Lista de arquivos anexados */}
      {attachedFiles.length > 0 && (
        <div className="mx-4 mb-2 p-3 bg-gray-800 border border-gray-700 rounded-lg">
          <p className="text-sm font-semibold mb-2">Arquivos anexados ({attachedFiles.length}/5):</p>
          <div className="space-y-1">
            {attachedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <div className="text-purple-400">{getFileIcon(file.type)}</div>
                <span className="flex-1 truncate">{file.name}</span>
                <span className="text-gray-400">{formatFileSize(file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendGeniusTask();
                }
              }}
              placeholder="Descreva o que você quer que o Genius faça com os arquivos..."
              disabled={loading || attachedFiles.length === 0}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            onClick={sendGeniusTask}
            disabled={!input.trim() || loading || attachedFiles.length === 0}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2 font-medium"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Enviar
          </button>
        </div>
      </div>

      {/* Attachment modal */}
      {selectedAttachment && (
        <GeniusAttachmentModal
          attachment={selectedAttachment}
          taskUrl={currentTask?.task_url}
          onClose={() => setSelectedAttachment(null)}
        />
      )}
    </div>
  );
}
