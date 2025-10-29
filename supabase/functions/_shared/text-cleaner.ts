/**
 * Limpa texto da LLM preservando estrutura util
 */
export function cleanLLMResponse(text: string): string {
  let cleaned = text;

  // Preservar blocos de codigo
  const codeBlocks: string[] = [];
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Remover apenas avisos do modelo
  const warningsToRemove = [
    /I'm an AI assistant[.\s\S]*?(?=\n\n)/gi,
    /As an AI[.\s\S]*?(?=\n\n)/gi,
    /I cannot[.\s\S]*?(?=\n\n)/gi,
    /Please note[.\s\S]*?(?=\n\n)/gi
  ];

  warningsToRemove.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Remover multiplas linhas vazias (mais de 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Restaurar blocos de codigo
  codeBlocks.forEach((block, idx) => {
    cleaned = cleaned.replace(`__CODE_BLOCK_${idx}__`, block);
  });

  return cleaned.trim();
}

/**
 * Extrai texto conversacional (antes de PARTE B)
 */
export function extractConversationalText(text: string): string {
  // Tentar extrair PARTE A
  const parteAMatch = text.match(/\[PARTE A\]([\s\S]*?)(?:\[PARTE B\]|---)/i);
  if (parteAMatch) {
    return cleanLLMResponse(parteAMatch[1]);
  }

  // Fallback: tudo antes de --- ou {
  const beforeJson = text.split(/---|\{/)[0];
  return cleanLLMResponse(beforeJson);
}
