/**
 * Configuracao centralizada para chamadas LLM
 * Todas as Edge Functions devem importar daqui
 */

export const LLM_MODELS = {
  GPT4_MINI: 'gpt-4o-mini',
  GPT4: 'gpt-4o',
  GPT35_TURBO: 'gpt-3.5-turbo'
} as const;

export const DEFAULT_MODEL = Deno.env.get('OPENAI_MODEL') || LLM_MODELS.GPT4_MINI;

export interface LLMProfile {
  model: string;
  temperature: number;
  max_tokens: number;
  description: string;
}

export const LLM_PROFILES: Record<string, LLMProfile> = {
  precise: {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    max_tokens: 2000,
    description: 'Analises precisas e deterministicas'
  },

  analytical: {
    model: DEFAULT_MODEL,
    temperature: 0.3,
    max_tokens: 2000,
    description: 'Analises gerais e recomendacoes'
  },

  conversational: {
    model: DEFAULT_MODEL,
    temperature: 0.5,
    max_tokens: 1500,
    description: 'Conversas naturais com usuario'
  },

  creative: {
    model: DEFAULT_MODEL,
    temperature: 0.7,
    max_tokens: 3000,
    description: 'Geracao criativa de conteudo'
  }
};

/**
 * Obtem configuracao para um profile especifico
 */
export function getLLMConfig(profileName: keyof typeof LLM_PROFILES = 'analytical'): LLMProfile {
  const profile = LLM_PROFILES[profileName];

  if (!profile) {
    console.warn(`[LLM-CONFIG] Profile ${profileName} not found, using analytical`);
    return LLM_PROFILES.analytical;
  }

  console.log(`[LLM-CONFIG] Using profile: ${profileName}`, {
    model: profile.model,
    temperature: profile.temperature,
    max_tokens: profile.max_tokens
  });

  return profile;
}

/**
 * Cria payload padronizado para chamada OpenAI
 */
export function createOpenAIPayload(
  messages: any[],
  profileName: keyof typeof LLM_PROFILES = 'analytical',
  overrides?: Partial<LLMProfile>
) {
  const config = getLLMConfig(profileName);

  return {
    model: overrides?.model || config.model,
    temperature: overrides?.temperature ?? config.temperature,
    max_tokens: overrides?.max_tokens || config.max_tokens,
    messages
  };
}

/**
 * Wrapper para chamada OpenAI com config padronizada
 */
export async function callOpenAI(
  apiKey: string,
  messages: any[],
  profileName: keyof typeof LLM_PROFILES = 'analytical',
  overrides?: Partial<LLMProfile>
): Promise<Response> {
  const payload = createOpenAIPayload(messages, profileName, overrides);

  return await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
}
