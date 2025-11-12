// src/utils/geniusValidation.ts
// Validação de arquivos para módulo Genius

import { GENIUS_CONFIG } from '../lib/supabase';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FileToValidate {
  name: string;
  size: number;
  type: string;
}

/**
 * Validar lista de arquivos para envio ao Genius
 */
export function validateGeniusFiles(files: FileToValidate[]): ValidationResult {
  const errors: string[] = [];

  // Validar quantidade
  if (files.length > GENIUS_CONFIG.MAX_FILES) {
    errors.push(`Você pode anexar no máximo ${GENIUS_CONFIG.MAX_FILES} arquivos por tarefa.`);
    return { valid: false, errors };
  }

  if (files.length === 0) {
    errors.push('Adicione pelo menos um arquivo para enviar ao Genius.');
    return { valid: false, errors };
  }

  let totalSize = 0;

  for (const file of files) {
    // Validar extensão
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (GENIUS_CONFIG.BLOCKED_EXTENSIONS.includes(ext)) {
      errors.push(`O arquivo "${file.name}" tem uma extensão não permitida (${ext}).`);
      continue;
    }

    // Validar MIME type
    if (GENIUS_CONFIG.BLOCKED_MIME_TYPES.includes(file.type)) {
      errors.push(`O arquivo "${file.name}" tem um tipo não permitido.`);
      continue;
    }

    if (!GENIUS_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
      errors.push(`O arquivo "${file.name}" tem um tipo não suportado (${file.type}).`);
      continue;
    }

    // Validar tamanho individual
    const maxSizeBytes = GENIUS_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const sizeMB = Math.round(file.size / 1024 / 1024);
      errors.push(
        `O arquivo "${file.name}" excede o limite de ${GENIUS_CONFIG.MAX_FILE_SIZE_MB}MB (tamanho: ${sizeMB}MB).`
      );
      continue;
    }

    totalSize += file.size;
  }

  // Validar tamanho total
  const maxTotalBytes = GENIUS_CONFIG.MAX_TOTAL_SIZE_MB * 1024 * 1024;
  if (totalSize > maxTotalBytes) {
    const totalMB = Math.round(totalSize / 1024 / 1024);
    errors.push(
      `O tamanho total dos arquivos (${totalMB}MB) excede o limite de ${GENIUS_CONFIG.MAX_TOTAL_SIZE_MB}MB.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formatar tamanho em bytes para string legível
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Verificar se URL de anexo expirou
 */
export function isAttachmentExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  return now >= expiry;
}

/**
 * Calcular dias até expiração
 */
export function daysUntilExpiry(expiresAt?: string): number {
  if (!expiresAt) return Infinity;
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = expiry - now;
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Converter File para base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remover prefixo data:*/*;base64,
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Preparar arquivos para envio
 */
export async function prepareFilesForUpload(files: File[]): Promise<Array<{
  filename: string;
  content: string;
  size_bytes: number;
  mime_type: string;
}>> {
  const prepared = [];

  for (const file of files) {
    const content = await fileToBase64(file);
    prepared.push({
      filename: file.name,
      content,
      size_bytes: file.size,
      mime_type: file.type,
    });
  }

  return prepared;
}
