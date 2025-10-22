// web/src/components/Consultor/Entregaveis/PainelEntregaveis.tsx
import { useEffect, useState } from 'react';
import { FileText, Download, Eye, Search, X, ExternalLink, Zap, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { EntregavelConsultor } from '../../../types/consultor';
import { uploadHtmlAndOpenPreview } from '../../../lib/storagePreview';
import { BpmnViewer } from '../BpmnViewer';

interface PainelEntregaveisProps {
  jornadaId?: string;
  onRefresh: () => void;
}

export function PainelEntregaveis({ jornadaId, onRefresh }: PainelEntregaveisProps) {
  const [entregaveis, setEntregaveis] = useState<EntregavelConsultor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('all');
  const [showBpmnModal, setShowBpmnModal] = useState(false);
  const [bpmnXml, setBpmnXml] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!jornadaId) return;

    void loadEntregaveis();
    const unsubscribe = setupRealtimeSubscription();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jornadaId]);

  function setupRealtimeSubscription() {
    if (!jornadaId) return () => {};

    const channel = supabase
      .channel(`entregaveis:${jornadaId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT/UPDATE/DELETE
          schema: 'public',
          table: 'entregaveis_consultor',
          filter: `jornada_id=eq.${jornadaId}`,
        },
        (_payload) => {
          // recarrega lista local
          void loadEntregaveis();
          // notifica o componente pai para recalcular badge / jornada (LateralConsultor tem sua própria lógica)
          try { onRefresh(); } catch (e) { /* ignore */ }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function loadEntregaveis() {
    if (!jornadaId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('entregaveis_consultor')
        .select('*')
        .eq('jornada_id', jornadaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntregaveis((data as EntregavelConsultor[]) || []);
    } catch (err) {
      console.error('Erro ao carregar entregáveis:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(entregavel: EntregavelConsultor) {
    try {
      const html = entregavel.html_conteudo || '';
      if (!html || html.trim().length < 20) {
        alert('Erro: O conteúdo HTML do entregável está vazio ou muito curto. Gere novamente.');
        console.error('HTML inválido. Comprimento:', html?.length || 0);
        return;
      }

      await uploadHtmlAndOpenPreview({
        html,
        title: entregavel.nome,
        conversationId: null,
        userId: null,
        persistToStorage: true,
      });

      // Marca como visualizado (se existir essa coluna)
      if (!(entregavel as any).visualizado) {
        await supabase.from('entregaveis_consultor').update({ visualizado: true }).eq('id', entregavel.id);
        // recarrega lista local e notifica o pai para recalcular badge/jornada
        void loadEntregaveis();
        try { onRefresh(); } catch (e) { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('entregavel:visualizado', { detail: { entregavelId: entregavel.id, jornadaId } })); } catch (e) {}
      }
    } catch (err: any) {
      console.error('Erro ao visualizar:', err);
      alert(`Erro ao visualizar documento: ${err.message || 'Erro desconhecido'}`);
    }
  }

  async function handleDownload(entregavel: EntregavelConsultor) {
    const html = entregavel.html_conteudo || '';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entregavel.nome}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Extrai XML BPMN de diferentes formatos (campo direto, <pre><code>, etc.)
  function extractBpmnXmlFromHtml(html: string): string | null {
    if (!html) return null;

    try {
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(html, 'text/html');

      const candidates = [
        'pre code.language-xml',
        'pre code.language-bpmn',
        'pre code',
        'code.language-xml',
        'code',
      ];

      for (const sel of candidates) {
        const el = htmlDoc.querySelector(sel);
        if (el?.textContent && el.textContent.trim().length > 0) {
          const raw = el.textContent;
          return raw
            .replace(/&amp;lt;/g, '<')
            .replace(/&amp;gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;quot;/g, '"')
            .replace(/&quot;/g, '"')
            .trim();
        }
      }
    } catch {
      // ignore parser errors
    }

    // fallback: se o próprio HTML é o XML
    const trimmed = html.trim();
    if (trimmed.startsWith('<?xml') || trimmed.includes('<bpmn2:definitions') || trimmed.includes('<definitions')) {
      return trimmed;
    }

    return null;
  }

  async function handleViewBpmn(entregavel: EntregavelConsultor) {
    // opções:
    // - doc.bpmn_xml (se existir)
    // - XML dentro do html_conteudo em <pre><code>
    let xml = (entregavel as any).bpmn_xml as string | undefined;

    if (!xml) {
      xml = extractBpmnXmlFromHtml(entregavel.html_conteudo || '') || undefined;
    }

    // Se ainda não houver XML, tenta acionar função que o gera e recarrega
    if (!xml || xml.length < 20) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-bpmn`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversationId: null, docId: entregavel.id }),
        });
        if (resp.ok) {
          // busca novamente o documento para pegar o bpmn_xml
          const { data: recarregado } = await supabase
            .from('entregaveis_consultor')
            .select('*')
            .eq('id', entregavel.id)
            .maybeSingle();
          xml = (recarregado as any)?.bpmn_xml || null;
        }
      } catch (e) {
        console.warn('Falha ao tentar gerar BPMN via função:', e);
      }
    }

    if (!xml || xml.length < 20) {
      alert('Não foi possível localizar o XML BPMN no entregável.');
      return;
    }

    setBpmnXml(xml);
    setShowBpmnModal(true);
  }

  async function handleAprovarDiagnostico(entregavel: EntregavelConsultor) {
    if (!entregavel.area_id) return;

    setActionLoading('aprovar-' + entregavel.id);
    try {
      const { data: diagnostico } = await supabase
        .from('diagnosticos_area')
        .select('id')
        .eq('area_id', entregavel.area_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (diagnostico?.id) {
        await supabase.from('diagnosticos_area').update({ status: 'aprovado' }).eq('id', diagnostico.id);

        alert('Diagnóstico aprovado! Agora você pode gerar o Plano de Ação.');
        void loadEntregaveis();
      } else {
        alert('Não encontrei o diagnóstico dessa área. Gere o diagnóstico antes de aprovar.');
      }
    } catch (err) {
      console.error('Erro ao aprovar diagnóstico:', err);
      alert('Erro ao aprovar diagnóstico');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGerarPlanoAcao(entregavel: EntregavelConsultor) {
    if (!entregavel.area_id) return;

    setActionLoading('plano-' + entregavel.id);
    try {
      const { data: diagnostico } = await supabase
        .from('diagnosticos_area')
        .select('id, status')
        .eq('area_id', entregavel.area_id)
        .eq('status', 'aprovado')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!diagnostico?.id) {
        alert('Você precisa aprovar o diagnóstico primeiro!');
        setActionLoading(null);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-plano-acao`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ diagnostico_id: diagnostico.id }),
      });

      if (!response.ok) throw new Error('Erro ao gerar plano');

      alert('Plano de Ação gerado com sucesso!');
      void loadEntregaveis();
      onRefresh();
    } catch (err: any) {
      console.error('Erro ao gerar plano:', err);
      alert('Erro: ' + (err.message || 'Falha ao gerar plano'));
    } finally {
      setActionLoading(null);
    }
  }

  const tiposDisponiveis = [
    { value: 'all', label: 'Todos' },
    { value: 'anamnese', label: 'Anamnese' },
    { value: 'canvas', label: 'Canvas' },
    { value: 'cadeia_valor', label: 'Cadeia de Valor' },
    { value: 'matriz_priorizacao', label: 'Matriz de Priorização' },
    { value: 'escopo_projeto', label: 'Escopo do Projeto' },
    { value: 'bpmn', label: 'BPMN' },
    { value: 'diagnostico', label: 'Diagnóstico' },
    { value: 'plano_acao', label: 'Plano de Ação' },
    // compat
    { value: 'mapa_geral', label: 'Mapa Geral' },
    { value: 'mapa_area', label: 'Mapa de Área' },
  ];

  const entregaveisFiltrados = entregaveis.filter((e) => {
    const matchSearch = e.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = selectedTipo === 'all' || e.tipo === selectedTipo;
    return matchSearch && matchTipo;
  });

  const agrupadosPorEtapa = entregaveisFiltrados.reduce((acc, e) => {
    const etapa = e.etapa_origem || 'Outros';
    if (!acc[etapa]) acc[etapa] = [];
    acc[etapa].push(e);
    return acc;
  }, {} as Record<string, EntregavelConsultor[]>);

  if (!jornadaId) {
    return (
      <div className="p-6 text-center text-gray-400">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-600" />
        <p className="text-sm">Nenhuma jornada ativa.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
          <p className="text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Entregáveis</h3>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar entregável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {tiposDisponiveis.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {entregaveisFiltrados.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-600" />
          <p className="text-sm">Nenhum entregável encontrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(agrupadosPorEtapa).map(([etapa, docs]) => (
            <div key={etapa}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">{etapa}</h4>
              <div className="space-y-2">
                {docs.map((doc) => {
                  // detectar possibilidade de BPMN
                  const hasBpmn =
                    doc.tipo === 'bpmn' ||
                    !!(doc as any).bpmn_xml ||
                    !!extractBpmnXmlFromHtml(doc.html_conteudo || '');

                  const dataVisivel =
                    (doc as any).data_geracao ||
                    (doc as any).created_at ||
                    new Date().toISOString();

                  return (
                    <div
                      key={doc.id}
                      className={`bg-gray-800 rounded-lg p-3 border transition-all group ${
                        !(doc as any).visualizado
                          ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                          : 'border-gray-700 hover:border-blue-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <h5 className="text-sm font-medium text-gray-100 truncate">{doc.nome}</h5>
                            {!(doc as any).visualizado && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded-full animate-pulse">
                                NOVO
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(dataVisivel).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {hasBpmn && (
                            <button
                              onClick={() => handleViewBpmn(doc)}
                              className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                              title="Ver BPMN"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {doc.tipo === 'diagnostico' && (
                            <>
                              <button
                                onClick={() => handleAprovarDiagnostico(doc)}
                                disabled={actionLoading === 'aprovar-' + doc.id}
                                className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                                title="Aprovar Diagnóstico"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleGerarPlanoAcao(doc)}
                                disabled={actionLoading === 'plano-' + doc.id}
                                className="p-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors disabled:opacity-50"
                                title="Gerar Plano de Ação"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handlePreview(doc)}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showBpmnModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Visualizador BPMN</h3>
              <button onClick={() => setShowBpmnModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <BpmnViewer xml={bpmnXml} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
