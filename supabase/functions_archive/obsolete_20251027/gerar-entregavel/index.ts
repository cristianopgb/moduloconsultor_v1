import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GerarEntregavelRequest {
  jornada_id: string;
  area_id?: string;
  tipo: string;
  template_nome: string;
  dados: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jornada_id, area_id, tipo, template_nome, dados }: GerarEntregavelRequest = await req.json();

    if (!jornada_id || !tipo || !template_nome || !dados) {
      throw new Error('Campos obrigatórios: jornada_id, tipo, template_nome, dados');
    }

    const { data: template, error: templateError } = await supabase
      .from('models')
      .select('*')
      .eq('name', template_nome)
      .eq('destination', 'consultor_entregavel')
      .maybeSingle();

    if (templateError || !template) {
      throw new Error(`Template '${template_nome}' não encontrado`);
    }

    let htmlConteudo = template.content_html || template.template_content || '';

    const placeholders = extrairPlaceholders(htmlConteudo);
    const placeholdersFaltando = placeholders.filter(ph => !(ph in dados));

    if (placeholdersFaltando.length > 0) {
      throw new Error(`Placeholders faltando: ${placeholdersFaltando.join(', ')}`);
    }

    htmlConteudo = preencherPlaceholders(htmlConteudo, dados);

    const nomeEntregavel = gerarNomeEntregavel(tipo, dados);

    const { data: entregavel, error: entregavelError } = await supabase
      .from('entregaveis_consultor')
      .insert({
        jornada_id,
        area_id,
        nome: nomeEntregavel,
        tipo,
        html_conteudo: htmlConteudo,
        etapa_origem: determinarEtapaOrigem(tipo),
        template_usado_id: template.id,
        data_geracao: new Date().toISOString()
      })
      .select()
      .single();

    if (entregavelError) throw entregavelError;

    return new Response(
      JSON.stringify({
        success: true,
        entregavel_id: entregavel.id,
        nome: nomeEntregavel,
        tipo
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao gerar entregável:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao gerar entregável' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extrairPlaceholders(html: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const placeholders: string[] = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    if (!placeholders.includes(match[1])) {
      placeholders.push(match[1]);
    }
  }

  return placeholders;
}

function preencherPlaceholders(html: string, dados: Record<string, any>): string {
  let resultado = html;

  for (const [key, value] of Object.entries(dados)) {
    const placeholder = `{{${key}}}`;
    let valorFormatado = '';

    if (Array.isArray(value)) {
      valorFormatado = value.map(item => {
        if (typeof item === 'string') return `<li>${item}</li>`;
        if (typeof item === 'object') return formatarObjeto(item);
        return `<li>${item}</li>`;
      }).join('');
      valorFormatado = `<ul>${valorFormatado}</ul>`;
    } else if (typeof value === 'object' && value !== null) {
      valorFormatado = formatarObjeto(value);
    } else {
      valorFormatado = String(value || '');
    }

    resultado = resultado.replaceAll(placeholder, valorFormatado);
  }

  return resultado;
}

function formatarObjeto(obj: Record<string, any>): string {
  const items = Object.entries(obj)
    .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function gerarNomeEntregavel(tipo: string, dados: Record<string, any>): string {
  const tipoMap: Record<string, string> = {
    'anamnese': 'Anamnese Empresarial',
    'mapa_geral': 'Mapa de Processos Geral',
    'mapa_area': `Mapa de Processos - ${dados.nome_area || 'Área'}`,
    'bpmn': `BPMN AS-IS - ${dados.nome_area || 'Área'}`,
    'diagnostico': `Diagnóstico - ${dados.nome_area || 'Área'}`,
    'plano_acao': `Plano de Ação - ${dados.nome_area || 'Área'}`
  };

  return tipoMap[tipo] || `Entregável - ${tipo}`;
}

function determinarEtapaOrigem(tipo: string): string {
  const etapaMap: Record<string, string> = {
    'anamnese': 'anamnese',
    'mapa_geral': 'mapeamento',
    'mapa_area': 'as_is',
    'bpmn': 'as_is',
    'diagnostico': 'analise',
    'plano_acao': 'plano'
  };

  return etapaMap[tipo] || 'execucao';
}
