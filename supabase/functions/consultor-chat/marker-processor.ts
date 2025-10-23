// supabase/functions/consultor-chat/marker-processor.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

export type MarkerAction =
  | { type: 'exibir_formulario'; params: { tipo: 'anamnese'|'canvas'|'cadeia_valor'|'atributos_processo'|'diagnostico'|'plano_acao' } }
  | { type: 'gerar_entregavel'; params: { tipo: string } }
  | { type: 'set_validacao'; params: { tipo: string } }
  | { type: 'acao_usuario'; params: { acao: string } }
  | { type: 'avancar_fase'; params: { fase: 'apresentacao'|'anamnese'|'mapeamento'|'priorizacao'|'execucao' } }
  | { type: 'gamificacao'; params: { xp: number; evento: string } };

export interface ProcessedLLM {
  displayContent: string;
  actions: MarkerAction[];
}

export class MarkerProcessor {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  parse(llmText: string): ProcessedLLM {
    let text = llmText || '';
    const actions: MarkerAction[] = [];

    // [EXIBIR_FORMULARIO:tipo]
    const formRx = /\[EXIBIR_FORMULARIO:(anamnese|canvas|cadeia_valor|atributos_processo|diagnostico|plano_acao)\]/gi;
    text = text.replace(formRx, (_m, tipo) => {
      actions.push({ type: 'exibir_formulario', params: { tipo } as any });
      return '';
    });

    // [GERAR_ENTREGAVEL:slug]
    const delivRx = /\[GERAR_ENTREGAVEL:([\w-]+)\]/gi;
    text = text.replace(delivRx, (_m, tipo) => {
      actions.push({ type: 'gerar_entregavel', params: { tipo } });
      return '';
    });

    // [SET_VALIDACAO:tipo]
    const valRx = /\[SET_VALIDACAO:(\w+)\]/gi;
    text = text.replace(valRx, (_m, tipo) => {
      actions.push({ type: 'set_validacao', params: { tipo } });
      return '';
    });

    // [AVANCAR_FASE:fase]
    const faseRx = /\[AVANCAR_FASE:(apresentacao|anamnese|mapeamento|priorizacao|execucao)\]/gi;
    text = text.replace(faseRx, (_m, fase) => {
      actions.push({ type: 'avancar_fase', params: { fase } as any });
      return '';
    });

    // [ACAO_USUARIO:acao]
    const acaoRx = /\[ACAO_USUARIO:(\w+)\]/gi;
    text = text.replace(acaoRx, (_m, acao) => {
      actions.push({ type: 'acao_usuario', params: { acao } });
      return '';
    });

    // [GAMIFICACAO:evento:xp]
    const gamRx = /\[GAMIFICACAO:([^:\]]+):(\d+)\]/gi;
    text = text.replace(gamRx, (_m, evento, xp) => {
      actions.push({ type: 'gamificacao', params: { xp: Number(xp), evento } });
      return '';
    });

    return { displayContent: text.trim(), actions };
  }

  async execute(actions: MarkerAction[], jornada: any): Promise<void> {
    for (const a of actions) {
      switch (a.type) {
        case 'exibir_formulario': {
          await this.timeline(jornada.id, jornada.etapa_atual, `Formulário exibido: ${a.params.tipo}`, { tipo: a.params.tipo });
          break;
        }
        case 'gerar_entregavel': {
          await this.timeline(jornada.id, jornada.etapa_atual, `Entregável gerado: ${a.params.tipo}`);
          break;
        }
        case 'set_validacao': {
          await this.timeline(jornada.id, jornada.etapa_atual, `Validação definida: ${a.params.tipo}`);
          break;
        }
        case 'acao_usuario': {
          if (a.params.acao === 'validar_escopo') {
            await this.timeline(jornada.id, jornada.etapa_atual, 'Aguardando validação do escopo pelo usuário');
          }
          break;
        }
        case 'avancar_fase': {
          await this.supabase.from('jornadas_consultor').update({ etapa_atual: a.params.fase }).eq('id', jornada.id);
          await this.timeline(jornada.id, a.params.fase, `Avanço de fase: ${a.params.fase}`);
          break;
        }
        case 'gamificacao': {
          if (a.params.xp > 0) {
            const { error } = await this.supabase.rpc('adicionar_xp_jornada', {
              p_jornada_id: jornada.id,
              p_quantidade: a.params.xp,
              p_motivo: a.params.evento,
            });
            if (!error) {
              await this.timeline(jornada.id, jornada.etapa_atual, `+${a.params.xp} XP • ${a.params.evento}`);
            } else {
              console.error('[Gamificação] RPC adicionar_xp_jornada falhou:', error);
            }
          }
          break;
        }
      }
    }
  }

  private async timeline(jornada_id: string, fase: string, evento: string, meta?: any) {
    // timeline_consultor table has columns: jornada_id, evento, fase, timestamp, created_at
    // do not insert a 'meta' field that doesn't exist in the schema
    await this.supabase.from('timeline_consultor').insert({
      jornada_id, fase, evento
    });
  }

  /**
   * Filter form actions based on checklist to prevent re-displaying completed forms
   */
  async filterFormActions(actions: MarkerAction[], conversationId: string): Promise<MarkerAction[]> {
    const { data: checklist } = await this.supabase
      .from('framework_checklist')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!checklist) return actions;

    return actions.filter(action => {
      if (action.type !== 'exibir_formulario') return true;

      const tipo = action.params.tipo;

      // Block forms that are already filled
      if (tipo === 'anamnese' && checklist.anamnese_formulario_exibido) {
        console.log('[MarkerProcessor] Blocking anamnese - already displayed');
        return false;
      }
      if (tipo === 'canvas' && checklist.canvas_formulario_exibido) {
        console.log('[MarkerProcessor] Blocking canvas - already displayed');
        return false;
      }
      if (tipo === 'cadeia_valor' && checklist.cadeia_valor_formulario_exibida) {
        console.log('[MarkerProcessor] Blocking cadeia_valor - already displayed');
        return false;
      }

      // Block if CTA hasn't been confirmed
      if (tipo === 'anamnese' && checklist.anamnese_cta_enviado && !checklist.anamnese_usuario_confirmou) {
        console.log('[MarkerProcessor] Blocking anamnese - waiting for user confirmation');
        return false;
      }
      if (tipo === 'canvas' && checklist.canvas_cta_enviado && !checklist.canvas_usuario_confirmou) {
        console.log('[MarkerProcessor] Blocking canvas - waiting for user confirmation');
        return false;
      }
      if (tipo === 'cadeia_valor' && checklist.cadeia_valor_cta_enviado && !checklist.cadeia_valor_usuario_confirmou) {
        console.log('[MarkerProcessor] Blocking cadeia_valor - waiting for user confirmation');
        return false;
      }

      return true;
    });
  }

  processResponse(llmResponse: string): ProcessedLLM {
    return this.parse(llmResponse);
  }
}
