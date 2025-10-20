// supabase/functions/consultor-chat/marker-processor.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

export type MarkerAction =
  | { type: 'exibir_formulario'; params: { tipo: 'anamnese'|'canvas'|'cadeia_valor'|'atributos_processo'|'diagnostico'|'plano_acao' } }
  | { type: 'gerar_entregavel'; params: { tipo: string } }
  | { type: 'set_validacao'; params: { tipo: string } }
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
    await this.supabase.from('timeline_consultor').insert({
      jornada_id, fase, evento, meta: meta || null
    });
  }
}
