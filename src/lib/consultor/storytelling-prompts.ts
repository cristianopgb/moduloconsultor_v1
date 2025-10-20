import { formatarApresentacaoProblemas } from './detector-problemas';

export const STORYTELLING_PROMPTS = {
  apresentacao_inicial: (contexto: any) => `
<� **Ol�! Sou o Proceda Consultor IA, seu especialista em gest�o empresarial.**

Em 15 anos transformando PMEs, j� ajudei mais de 500 empresas similares � sua a resolver problemas que muitas vezes nem sabiam que tinham.

**Por que voc� est� aqui?**
${contexto.motivacao_detectada || 'Provavelmente sente que "tem algumas coisas que poderiam funcionar melhor, mas n�o sabe bem como mudar", certo?'}

**Minha metodologia � diferente:**
- N�o fa�o perguntas gen�ricas - detecto problemas ocultos baseado no seu perfil
- N�o entrego solu��es prontas - customizo tudo para sua realidade e capacidade
- N�o deixo voc� perdido - conduzo cada etapa com metodologia comprovada
- N�o prometo milagres - foco em resultados mensur�veis em 30-90 dias

**Sua Jornada de Transforma��o:**
1. **Anamnese** - Conhecer voc�, seu neg�cio e detectar problemas ocultos
2. **Mapeamento** - Entender processos, complexidade e cadeia de valor
3. **Prioriza��o** - Definir ordem ideal de implementa��o (matriz impacto x facilidade)
4. **Execu��o** - Planos detalhados por �rea com acompanhamento no Kanban

**Vamos come�ar?** Me conte: qual o nome da sua empresa e em que segmento atua?
`,

  transicao_anamnese_mapeamento: (contexto: any) => `
**ANAMNESE CONCLU�DA **

Perfeito, ${contexto.nome_usuario}! Coletei informa��es essenciais sobre voc� e a ${contexto.empresa_nome}.

**PROBLEMAS OCULTOS DETECTADOS:**
${contexto.problemas_detectados_formatados}

**ENTREG�VEIS GERADOS:**
=� Business Model Canvas da ${contexto.empresa_nome}
=� Relat�rio de Anamnese Empresarial

**PR�XIMO PASSO: MAPEAMENTO GERAL**
Agora vou mapear a estrutura e processos da sua empresa para entender a complexidade e identificar onde est�o os gargalos que confirmam os problemas que detectei.

Vou usar 3 ferramentas consultivas:
1. **Cadeia de Valor** - Processos ponta a ponta
2. **Mapa de Departamentos** - Estrutura organizacional
3. **Matriz de Prioriza��o** - Definir ordem de implementa��o

**ENTREG�VEIS DESTA ETAPA:**
=� Cadeia de Valor da ${contexto.empresa_nome}
=� Mapa de Departamentos e Responsabilidades
=� Escopo do Projeto de Transforma��o
=� Matriz de Prioriza��o de Processos

Vamos come�ar o mapeamento?
`,

  transicao_mapeamento_priorizacao: (contexto: any) => `
**MAPEAMENTO CONCLU�DO **

Excelente! Agora tenho vis�o completa da ${contexto.empresa_nome}:
- ${contexto.numero_areas || 'Diversas'} �reas mapeadas
- ${contexto.numero_processos || 'V�rios'} processos identificados
- ${contexto.numero_gaps || 'M�ltiplos'} gaps cr�ticos detectados

**ENTREG�VEIS GERADOS:**
=� Cadeia de Valor da ${contexto.empresa_nome}
=� Mapa de Departamentos

**PR�XIMO PASSO: PRIORIZA��O ESTRAT�GICA**
Vou aplicar a **Matriz de Prioriza��o** para definir a ordem ideal de implementa��o baseada em criticidade, urg�ncia, impacto, dificuldade e prazo.

[MOSTRAR_FORM:matriz_priorizacao]
`,

  transicao_priorizacao_execucao: (contexto: any) => `
**PRIORIZA��O DEFINIDA **

Perfeito! Temos o roadmap de transforma��o da ${contexto.empresa_nome}:

**SEQU�NCIA DE IMPLEMENTA��O:**
1. =% **CR�TICO** (30 dias): ${contexto.areas_criticas || '�reas priorit�rias'}
2. =6 **ALTO** (60 dias): ${contexto.areas_altas || '�reas importantes'}
3. =5 **M�DIO** (90 dias): ${contexto.areas_medias || '�reas secund�rias'}

**ENTREG�VEL GERADO:**
=� Matriz de Prioriza��o com scores calculados

**PR�XIMO PASSO: EXECU��O POR �REAS**
Agora vou trabalhar cada �rea individualmente:
- Mapeamento AS-IS (como est� hoje)
- Diagn�stico especializado
- Plano de a��o detalhado
- Acompanhamento no Kanban

**PARALELISMO INTELIGENTE:**
Voc� pode iniciar a 2� �rea quando a 1� chegar na fase de "Plano de A��o". Isso acelera o processo sem sobrecarregar.

Vamos come�ar pela �rea mais cr�tica: **${contexto.primeira_area || 'primeira �rea'}**?
`,

  apresentacao_problemas_contextualizados: (problemas: any, contexto: any) => `
${contexto.nome_usuario}, baseado no perfil da ${contexto.empresa_nome} (${contexto.segmento}, porte ${contexto.porte}),
minha experi�ncia me permite antecipar alguns desafios que provavelmente voc�s enfrentam:

${formatarApresentacaoProblemas(problemas, contexto.empresa_nome)}

**Por que consigo prever isso?**
N�o � adivinha��o - � padr�o. Empresas com caracter�sticas similares � ${contexto.empresa_nome}
passam pelos mesmos desafios estruturais. � como um m�dico que, ao ver os sintomas,
j� suspeita do diagn�stico antes dos exames.

**Agora vou confirmar:**
Durante o mapeamento, vou investigar cada um desses pontos para confirmar quais
realmente se aplicam � sua realidade e quantificar o impacto real.

Reconhece alguns desses padr�es na ${contexto.empresa_nome}?
`,

  feedback_loop_detectado: (contexto: any) => `
${contexto.nome_usuario}, percebo que estamos girando em c�rculos. Vamos avan�ar.

Baseado no que voc� j� me contou:
${contexto.resumo_contexto_coletado}

Isso j� � suficiente para eu come�ar a trabalhar. Vou prosseguir para a pr�xima etapa da consultoria.

**[AVAN�AR_ETAPA_FOR�ADO]**
`,

  feedback_frustacao_detectada: (contexto: any) => `
Entendo sua frustra��o, ${contexto.nome_usuario}. Vamos mudar a abordagem.

Em vez de perguntas, vou aplicar meu diagn�stico baseado no que j� sei da ${contexto.empresa_nome}.

Vou trabalhar com o contexto que tenho e voc� pode complementar quando necess�rio.

**[AVAN�AR_ETAPA_FOR�ADO]**
`,

  feedback_contexto_completo: () => `
Perfeito! J� tenho informa��es suficientes para avan�ar.

Vou consolidar tudo que coletamos e gerar os primeiros entreg�veis da consultoria.

**[AVAN�AR_ETAPA_FOR�ADO]**
`
};

export function construirMensagemTransicao(
  etapaAtual: string,
  proximaEtapa: string,
  contexto: any
): string {
  const transicoes: Record<string, (c: any) => string> = {
    'anamnese->mapeamento': STORYTELLING_PROMPTS.transicao_anamnese_mapeamento,
    'mapeamento->priorizacao': STORYTELLING_PROMPTS.transicao_mapeamento_priorizacao,
    'priorizacao->execucao': STORYTELLING_PROMPTS.transicao_priorizacao_execucao
  };

  const chave = `${etapaAtual}->${proximaEtapa}`;
  const construtor = transicoes[chave];

  if (construtor) {
    return construtor(contexto);
  }

  return `Avan�ando de ${etapaAtual} para ${proximaEtapa}...`;
}
