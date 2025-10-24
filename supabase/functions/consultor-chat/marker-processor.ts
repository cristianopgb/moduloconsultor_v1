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

  // Lightweight validation for userId to avoid passing invalid/null values to RPCs
  private isValidUserId(id?: string): boolean {
    if (!id || typeof id !== 'string') return false;
    const v = id.trim();
    if (!v) return false;
    if (v.toLowerCase() === 'null') return false;
    // basic check: should contain hex or dash characters (UUID-like) or be reasonably long
    return /[0-9a-fA-F\-]{8,}/.test(v);
  }

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

  async execute(actions: MarkerAction[], jornada: any, userId?: string, conversationId?: string): Promise<{updates: any, gamificationResult: any, postActions: any[]}> {
    const updates: any = {};
    const postActions: any[] = [];
    let gamificationResult: any = null;

    // refresh jornada from DB to avoid stale state when processing actions
    try {
      if (jornada && jornada.id) {
        const { data: refreshedJornada } = await this.supabase
          .from('jornadas_consultor').select('*').eq('id', jornada.id).single();
        if (refreshedJornada) {
          jornada = refreshedJornada;
          console.log('[MARKER] Refreshed jornada before executing actions, etapa_atual:', jornada.etapa_atual, 'aguardando_validacao:', jornada.aguardando_validacao);
        }
      }
    } catch (e) {
      console.warn('[MARKER] failed to refresh jornada before executeActions:', e);
    }

    console.log('[MARKER] executeActions received actions:', actions.map((a:any)=>a.type));

    for (const a of actions) {
      switch (a.type) {
        case 'exibir_formulario': {
          await this.timeline(jornada.id, jornada.etapa_atual, `Formulário exibido: ${a.params.tipo}`);
          break;
        }
        case 'gerar_entregavel': {
          await this.timeline(jornada.id, jornada.etapa_atual, `Entregável gerado: ${a.params.tipo}`);
          break;
        }
        case 'set_validacao': {
          const tipo = a.params.tipo;
          console.log(`[MARKER] processing set_validacao for tipo='${tipo}' (jornada.aguardando_validacao='${jornada.aguardando_validacao}')`);

          // If user validated priorizacao, advance to execucao
          if (tipo === 'priorizacao' && jornada.aguardando_validacao === 'priorizacao') {
            updates.etapa_atual = 'execucao';
            updates.aguardando_validacao = null;
            await this.supabase.from('jornadas_consultor')
              .update({ etapa_atual: 'execucao', aguardando_validacao: null })
              .eq('id', jornada.id);
            await this.timeline(jornada.id, 'execucao', `Fase avançada para: execucao`);
            try {
              gamificationResult = await this.awardXPByJornada(jornada.id, 100, `Fase execucao iniciada`, userId, conversationId);
            } catch (e) {
              console.warn('[MARKER] awardXPByJornada failed on set_validacao:priorizacao', e);
            }
            await this.ensureAreasFromScope(jornada.id);
            // enqueue atributos_processo after advancing
            try {
              const ctx = jornada.contexto_coleta || {};
              const processos = ctx?.matriz_priorizacao?.processos || ctx?.priorizacao?.processos || ctx?.escopo?.processos || [];
              if (Array.isArray(processos) && processos.length > 0) {
                const primeiro = processos[0];
                const pa = { type: 'exibir_formulario', params: { tipo: 'atributos_processo', processo: { id: primeiro.id || null, nome: primeiro.nome || primeiro.processo || primeiro } } };
                postActions.push(pa);
                console.log('[MARKER] enqueued atributos_processo prefilled with process:', pa.params.processo);
              } else {
                postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
                console.log('[MARKER] enqueued atributos_processo without prefilling (no prioritized processes found)');
              }
            } catch (e) {
              postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
              console.warn('[MARKER] error while trying to enqueue atributos_processo, enqueued empty form instead:', e);
            }
          } else {
            updates.aguardando_validacao = tipo;
            await this.supabase.from('jornadas_consultor')
              .update({ aguardando_validacao: tipo })
              .eq('id', jornada.id);
          }
          await this.timeline(jornada.id, jornada.etapa_atual, `Validação definida: ${tipo}`);
          break;
        }
        case 'acao_usuario': {
          if (a.params.acao === 'validar_escopo') {
            await this.timeline(jornada.id, jornada.etapa_atual, 'Aguardando validação do escopo pelo usuário');
          }
          break;
        }
        case 'avancar_fase': {
          updates.etapa_atual = a.params.fase;
          updates.aguardando_validacao = null;
          await this.supabase.from('jornadas_consultor').update({ etapa_atual: a.params.fase, aguardando_validacao: null }).eq('id', jornada.id);
          await this.timeline(jornada.id, a.params.fase, `Avanço de fase: ${a.params.fase}`);
          gamificationResult = await this.awardXPByJornada(jornada.id, 100, `Fase ${a.params.fase} iniciada`, userId, conversationId);
          if (a.params.fase === 'execucao') {
            await this.ensureAreasFromScope(jornada.id);
            // ensure we ask for atributos_processo once execution starts
            try {
              const ctx = jornada.contexto_coleta || {};
              const processos = ctx?.matriz_priorizacao?.processos || ctx?.priorizacao?.processos || ctx?.escopo?.processos || [];
              if (Array.isArray(processos) && processos.length > 0) {
                const primeiro = processos[0];
                postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo', processo: { id: primeiro.id || null, nome: primeiro.nome || primeiro.processo || primeiro } } });
              } else {
                postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
              }
            } catch (e) {
              postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
            }
          }
          break;
        }
        case 'gamificacao': {
          if (a.params.xp > 0) {
            gamificationResult = await this.awardXPByJornada(jornada.id, a.params.xp, a.params.evento, userId, conversationId);
          }
          break;
        }
      }
    }
    return { updates, gamificationResult, postActions };
  }

  private async timeline(jornada_id: string, fase: string, evento: string, meta?: any) {
    // Estratégia: tentar RPC primeiro (mais estável com RLS), fallback para insert direto
    try {
      // Tentar RPC add_timeline_event primeiro
      const { error: rpcError } = await this.supabase.rpc('add_timeline_event', {
        p_jornada_id: jornada_id,
        p_evento: evento,
        p_fase: fase
      });

      if (rpcError) {
        console.warn('[TIMELINE] RPC failed, trying direct insert:', rpcError.message);
        // Fallback: insert direto
        const { error: insertError } = await this.supabase.from('timeline_consultor').insert({
          jornada_id,
          fase,
          evento
        });

        if (insertError) {
          console.warn('[TIMELINE] Direct insert also failed:', insertError.message);
        } else {
          console.log(`[TIMELINE] ✅ Evento registrado (via insert direto): ${evento} (fase: ${fase})`);
        }
      } else {
        console.log(`[TIMELINE] ✅ Evento registrado (via RPC): ${evento} (fase: ${fase})`);
      }
    } catch (e) {
      console.warn('[TIMELINE] Exception ao registrar evento (não-fatal):', e);
    }
  }

  async ensureAreasFromScope(jornadaId: string) {
    try {
      const { data: j } = await this.supabase
        .from('jornadas_consultor').select('contexto_coleta').eq('id', jornadaId).single();
      const ctx = j?.contexto_coleta || {};
      const processos = ctx?.escopo?.processos || ctx?.escopo_projeto?.processos || ctx?.matriz_priorizacao?.processos || ctx?.priorizacao?.processos || [];
      if (!Array.isArray(processos) || processos.length === 0) return;

      const { data: existentes } = await this.supabase
        .from('areas_trabalho').select('id, nome_area').eq('jornada_id', jornadaId);
      const nomesExistentes = new Set((existentes || []).map((a:any)=>(a.nome_area || '').toLowerCase().trim()));
      let pos = (existentes || []).length + 1;

      for (const p of processos){
        const nome = (typeof p === 'string' ? p : p.nome || p.processo || '').trim();
        if (!nome) continue;
        if (nomesExistentes.has(nome.toLowerCase())) continue;

        await this.supabase.from('areas_trabalho').insert({
          jornada_id: jornadaId,
          nome_area: nome,
          etapa_area: 'as_is',
          posicao_prioridade: pos++,
          progresso_area: 0
        });
      }
    } catch (e) {
      console.error('[AREAS] Erro ao garantir áreas do escopo:', e);
    }
  }

  // Award XP by conversation (jornada-specific RPC doesn't exist)
  async awardXPByJornada(jornadaId: string, xp: number, conquista: string, userId?: string, conversationId?: string) {
    try {
      // NOTE: add_xp_to_jornada RPC does not exist in the database
      // We use add_xp_to_conversation which works with conversation_id only
      if (!conversationId) {
        console.warn('[MARKER] No conversationId provided, cannot award XP');
        return null;
      }

      const { data, error } = await this.supabase.rpc('add_xp_to_conversation', {
        p_conversation_id: conversationId,
        p_xp_amount: xp,
        p_conquista_nome: conquista
      });

      if (error) {
        console.error('[MARKER] add_xp_to_conversation failed:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[MARKER] Exception awarding XP:', err);
      return null;
    }
  }

  async autoAwardXPByEvent(jornadaId: string, userId: string, event: 'formulario_preenchido'|'entregavel_gerado'|'fase_concluida'|'acao_iniciada', conversationId?: string) {
    const xpMap: Record<string, number> = {
      formulario_preenchido: 50,
      entregavel_gerado: 75,
      fase_concluida: 100,
      acao_iniciada: 25
    };
    const xp = xpMap[event];
    if (!xp) return null;
    return await this.awardXPByJornada(jornadaId, xp, event, userId, conversationId);
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
