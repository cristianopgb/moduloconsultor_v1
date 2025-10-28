// supabase/functions/consultor-chat/marker-processor-v2.ts
// Nova versão do MarkerProcessor com métodos de timeline e checklist corrigidos

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Supa = ReturnType<typeof createClient>;

export type Fase =
  | 'anamnese'
  | 'modelagem'     // Canvas + Cadeia acontecem aqui
  | 'priorizacao'   // Validação do escopo / matriz
  | 'execucao';

export interface ChecklistPatch {
  jornada_id: string;
  conversation_id: string;
  // flags opcionais:
  apresentacao_feita?: boolean;
  anamnese_cta_enviado?: boolean;
  anamnese_usuario_confirmou?: boolean;
  anamnese_formulario_exibido?: boolean;
  anamnese_preenchida?: boolean;

  canvas_cta_enviado?: boolean;
  canvas_usuario_confirmou?: boolean;
  canvas_formulario_exibido?: boolean;
  canvas_preenchido?: boolean;

  cadeia_valor_cta_enviado?: boolean;
  cadeia_valor_usuario_confirmou?: boolean;
  cadeia_valor_formulario_exibida?: boolean;
  cadeia_valor_preenchida?: boolean;

  matriz_priorizacao_solicitada?: boolean;
  matriz_priorizacao_formulario_exibido?: boolean;
  matriz_priorizacao_preenchida?: boolean;

  escopo_validado_pelo_usuario?: boolean;
  aguardando_validacao_escopo?: boolean;

  fase_atual?: Fase;
}

export class MarkerProcessorV2 {
  private supabase: Supa;

  constructor(supabase: Supa) {
    this.supabase = supabase;
  }

  async patchChecklist(patch: ChecklistPatch) {
    const { jornada_id, conversation_id, ...rest } = patch;

    // Remove updated_at se existir no patch
    const cleanRest: any = { ...rest };
    delete cleanRest.updated_at;

    const { error } = await this.supabase
      .from('framework_checklist')
      .upsert(
        {
          jornada_id,
          conversation_id,
          ...cleanRest
        },
        { onConflict: 'jornada_id', ignoreDuplicates: false }
      );

    if (error) {
      console.error('[MarkerProcessorV2] patchChecklist error:', error);
      throw new Error(`patchChecklist failed: ${error.message}`);
    }
  }

  async timeline(jornadaId: string, tipo_evento: string, fase: Fase | null, detalhe: Record<string, unknown> = {}) {
    try {
      const { error } = await this.supabase.rpc('consultor_register_timeline', {
        p_jornada_id: jornadaId,
        p_tipo_evento: tipo_evento,
        p_fase: fase,
        p_detalhe: detalhe
      });

      if (error) {
        console.error('[MarkerProcessorV2] timeline RPC error:', error);
        // Fallback: insert direto
        const { error: insertError } = await this.supabase
          .from('timeline_consultor')
          .insert({
            jornada_id: jornadaId,
            tipo_evento: tipo_evento,
            fase: fase,
            detalhe: detalhe
          });

        if (insertError) {
          console.error('[MarkerProcessorV2] timeline insert error:', insertError);
        }
      }
    } catch (e) {
      console.error('[MarkerProcessorV2] timeline exception:', e);
    }
  }

  /**
   * Marca "form exibido" + timeline
   */
  async markFormShown(jornadaId: string, conversationId: string, tipo: 'anamnese' | 'canvas' | 'cadeia_valor' | 'matriz_priorizacao') {
    const map: Record<string, Partial<ChecklistPatch>> = {
      anamnese: { anamnese_formulario_exibido: true },
      canvas: { canvas_formulario_exibido: true },
      cadeia_valor: { cadeia_valor_formulario_exibida: true },
      matriz_priorizacao: { matriz_priorizacao_formulario_exibido: true }
    };

    await this.patchChecklist({
      jornada_id: jornadaId,
      conversation_id: conversationId,
      ...map[tipo]
    } as ChecklistPatch);

    await this.timeline(jornadaId, `form_exibido:${tipo}`, 'modelagem', {});
  }

  /**
   * Marca "form preenchido" + timeline
   */
  async markFormFilled(jornadaId: string, conversationId: string, tipo: 'anamnese' | 'canvas' | 'cadeia_valor' | 'matriz_priorizacao', detalhe: Record<string, unknown> = {}) {
    const map: Record<string, Partial<ChecklistPatch>> = {
      anamnese: { anamnese_preenchida: true, fase_atual: 'modelagem' },
      canvas: { canvas_preenchido: true, fase_atual: 'modelagem' },
      cadeia_valor: { cadeia_valor_preenchida: true, fase_atual: 'modelagem' },
      matriz_priorizacao: { matriz_priorizacao_preenchida: true, fase_atual: 'priorizacao' }
    };

    await this.patchChecklist({
      jornada_id: jornadaId,
      conversation_id: conversationId,
      ...map[tipo]
    } as ChecklistPatch);

    await this.timeline(jornadaId, `form_preenchido:${tipo}`, tipo === 'matriz_priorizacao' ? 'priorizacao' : 'modelagem', detalhe);
  }

  /**
   * Marca solicitação de validação de escopo
   */
  async requestEscopoValidation(jornadaId: string, conversationId: string) {
    await this.patchChecklist({
      jornada_id: jornadaId,
      conversation_id: conversationId,
      aguardando_validacao_escopo: true,
      fase_atual: 'priorizacao'
    } as ChecklistPatch);

    await this.timeline(jornadaId, 'validacao_solicitada:escopo', 'priorizacao', {});
  }

  /**
   * Marca escopo validado e avança para execução
   */
  async confirmEscopo(jornadaId: string, conversationId: string) {
    await this.patchChecklist({
      jornada_id: jornadaId,
      conversation_id: conversationId,
      escopo_validado_pelo_usuario: true,
      aguardando_validacao_escopo: false,
      fase_atual: 'execucao'
    } as ChecklistPatch);

    await this.timeline(jornadaId, 'validacao_confirmada:escopo', 'execucao', {});
  }

  /**
   * Marca entregável gerado
   */
  async markDeliverableGenerated(jornadaId: string, tipo: string, fase: Fase) {
    await this.timeline(jornadaId, `entregavel_gerado:${tipo}`, fase, { tipo });
  }
}
