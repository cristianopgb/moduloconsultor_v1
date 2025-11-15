// src/components/Chat/GeniusChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle, Clock, Download, FileText, Image as ImageIcon, Table, File, Send, X, Paperclip } from 'lucide-react';
import { supabase, GeniusTask, GeniusAttachment, Message } from '../../lib/supabase';
import { GeniusApiService } from '../../services/geniusApi';
import { validateGeniusFiles, prepareFilesForUpload, formatFileSize, FileToValidate } from '../../utils/geniusValidation';
import { GeniusAttachmentModal } from '../Genius/GeniusAttachmentModal';
import { TaskProgressIndicator } from './TaskProgressIndicator';

interface GeniusChatProps {
  conversationId: string;
  userId: string;
  messages: Message[];
  onMessagesUpdate: (messages: Message[]) => void;
  attachedFiles: File[];
  onClearFiles: () => void;
}

interface AttachedFilePreview {
  file: File;
  id: string;
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
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Sync local files with prop
  useEffect(() => {
    setLocalFiles(attachedFiles);
  }, [attachedFiles]);

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
    if (!input.trim() || loading) return;

    setLoading(true);
    setError('');

    const userInput = input;
    const userFiles = localFiles;

    // Limpar input e arquivos IMEDIATAMENTE para melhor UX
    setInput('');
    setLocalFiles([]);
    onClearFiles();

    try {
      // Validar e preparar arquivos se houver
      let preparedFiles: any[] = [];

      if (userFiles.length > 0) {
        const filesToValidate: FileToValidate[] = userFiles.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        }));

        const validation = validateGeniusFiles(filesToValidate);
        if (!validation.valid) {
          setError(validation.errors.join(' '));
          setLoading(false);
          // Restaurar input e arquivos em caso de erro de validação
          setInput(userInput);
          setLocalFiles(userFiles);
          return;
        }

        // Preparar arquivos (converter para base64)
        preparedFiles = await prepareFilesForUpload(userFiles);
      }

      // Criar mensagem do usuário
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        conversation_id: conversationId,
        role: 'user',
        content: userInput,
        message_type: 'genius_task',
        created_at: new Date().toISOString()
      };

      // Criar mensagem temporária de "processando"
      const tempProcessingMessage: Message = {
        id: `temp-processing-${Date.now()}`,
        conversation_id: conversationId,
        role: 'assistant',
        content: 'Iniciando processamento...',
        message_type: 'genius_task',
        genius_status: 'pending',
        created_at: new Date().toISOString()
      };

      onMessagesUpdate([...messages, userMessage, tempProcessingMessage]);

      // Inserir no banco
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userInput,
        message_type: 'genius_task'
      });

      // Sempre chamar Edge Function para criar tarefa (com ou sem arquivos)
      const response = await GeniusApiService.createTask({
        prompt: userInput,
        files: preparedFiles,
        conversationId
      });

      if (!response.success) {
        throw new Error(response.error || 'Falha ao criar tarefa');
      }

      // Refresh messages para pegar a versão real do banco
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

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files);
    const combined = [...localFiles, ...newFiles].slice(0, 5);
    setLocalFiles(combined);
  }

  function removeFile(index: number) {
    setLocalFiles(prev => prev.filter((_, i) => i !== index));
  }

  // Drag and drop handlers
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
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
                <div className="mb-3">
                  <TaskProgressIndicator
                    status={msg.genius_status as 'pending' | 'running' | 'completed' | 'failed'}
                    createdAt={msg.created_at}
                    estimatedTimeSeconds={180}
                  />
                  {msg.genius_credit_usage && (
                    <p className="text-xs text-gray-400 mt-2 text-right">
                      Créditos utilizados: {msg.genius_credit_usage}
                    </p>
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

      {/* Lista de arquivos anexados com preview */}
      {localFiles.length > 0 && (
        <div className="mx-4 mb-2">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-200">
                Arquivos anexados ({localFiles.length}/5)
              </p>
              <button
                onClick={() => {
                  setLocalFiles([]);
                  onClearFiles();
                }}
                className="text-xs text-gray-400 hover:text-gray-200 transition"
              >
                Limpar tudo
              </button>
            </div>
            <div className="space-y-2">
              {localFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 bg-gray-900 rounded-lg group hover:bg-gray-850 transition"
                >
                  <div className="text-purple-400">{getFileIcon(file.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition"
                    title="Remover arquivo"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input area with drag-and-drop */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-t border-gray-700 p-4 relative transition-colors ${
          isDragging ? 'bg-purple-900/20' : ''
        }`}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-purple-600/10 border-2 border-dashed border-purple-500 rounded-lg flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center">
              <Paperclip className="w-12 h-12 mx-auto mb-2 text-purple-400" />
              <p className="text-sm font-medium text-purple-300">Solte os arquivos aqui</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* File attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || localFiles.length >= 5}
            className="p-3 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-purple-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Anexar arquivos (máx. 5)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.docx,.pptx"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />

          {/* Text input */}
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
              placeholder={
                localFiles.length > 0
                  ? "Descreva o que você quer que o Genius faça com os arquivos..."
                  : "Digite sua mensagem ou arraste arquivos para anexar..."
              }
              disabled={loading}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Send button */}
          <button
            onClick={sendGeniusTask}
            disabled={!input.trim() || loading}
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

        {/* File upload hint */}
        {localFiles.length === 0 && !loading && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            💡 Anexe até 5 arquivos (PDF, Excel, CSV, imagens) ou arraste e solte aqui
          </p>
        )}
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
