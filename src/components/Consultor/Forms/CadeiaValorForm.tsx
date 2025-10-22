// web/src/components/Consultor/Forms/CadeiaValorForm.tsx
import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  userId: string;
  edgeUrl?: string; // opcional
}

const defaultEdge = (url?: string) =>
  url || `${(window as any)?.SUPABASE_FUNCTIONS_URL || '/functions/v1'}/consultor-chat`;

export default function CadeiaValorForm({ isOpen, onClose, conversationId, userId, edgeUrl }: Props) {
  const [fornecedoresText, setFornecedoresText] = useState('');
  const [primariosText, setPrimariosText] = useState('');
  const [gestaoText, setGestaoText] = useState('');
  const [suporteText, setSuporteText] = useState('');
  const [outputsText, setOutputsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // parse lines into processos: allow lines like "Nome do processo - descrição curta"
  const parseProcessos = (raw: string, categoria: string) => {
    const lines = String(raw || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
    return lines.map((ln) => {
      const parts = ln.split(/\s+-\s+/); // split by ' - '
      const nome = parts[0].trim();
      const descricao = parts[1] ? parts.slice(1).join(' - ').trim() : null;
      return {
        nome: nome.slice(0, 240),
        descricao: descricao || null,
        impacto: null,
        criticidade: null,
        esforco: null,
        categoria
      };
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const fornecedores = parseProcessos(fornecedoresText, 'fornecedor');
    const primarios = parseProcessos(primariosText || primariosText === '' ? primariosText : primariosText, 'primario');
    const gestao = parseProcessos(gestaoText, 'gestao');
    const suporte = parseProcessos(suporteText, 'suporte');
    const principais = parseProcessos(primariosText || primariosText === '' ? primariosText : primariosText, 'primario');

    // if user used the principal field (primariosText) we'll use it; otherwise combine all
    const processos = [ ...fornecedores, ...primarios, ...gestao, ...suporte, ...principais ].filter(p => p && p.nome);
    if (!processos || processos.length === 0) {
      setErro('Descreva ao menos um processo em algum dos campos (uma linha por processo).');
      return;
    }

    const outputs = String(outputsText || '').split(/\n+/).map(l=>l.trim()).filter(Boolean).map(o=>({ nome: o.slice(0,240) }));

    try {
      setLoading(true);
      const payload = {
        message: 'Formulário de Cadeia de Valor enviado',
        conversation_id: conversationId,
        user_id: userId,
        form_type: 'cadeia_valor',
        form_data: { processos, outputs },
      };

      // Prefer using Supabase Functions invocation (keeps auth/session)
      try {
        if ((window as any).supabase && (window as any).supabase.functions && (window as any).supabase.functions.invoke) {
          await (window as any).supabase.functions.invoke('consultor-chat', { body: payload });
        } else {
          // fallback: try to send via fetch with session token if available
          let token: string | undefined = undefined;
          try {
            const { data: sessionData } = await (window as any).supabase.auth.getSession();
            token = sessionData?.session?.access_token;
          } catch (e) {
            // ignore - no session available
          }
          const res = await fetch(defaultEdge(edgeUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || j?.message || `Erro ao enviar formulário. HTTP ${res.status}`);
          }
        }
      } catch (e: any) {
        throw e;
      }

      onClose();
    } catch (err: any) {
      setErro(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalWrapper isOpen={isOpen} title="Cadeia de Valor" onClose={onClose} maxWidthClass="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-300">
          Preencha os processos por seção. Em cada campo, coloque um processo por linha. Opcionalmente use " - " para separar uma descrição curta.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400">Fornecedores / Entradas (externos)</label>
            <textarea
              className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              value={fornecedoresText}
              onChange={(e) => setFornecedoresText(e.target.value)}
              placeholder={"Fornecedor A - Fornece matéria-prima\nFornecedor B - Logística"}
              rows={6}
            />
            <p className="text-xs text-gray-500 mt-1">Processos externos que fornecem insumos/serviços.</p>
          </div>

          <div>
            <label className="text-xs text-gray-400">Processos Primários (foco no cliente)</label>
            <textarea
              className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              value={primariosText}
              onChange={(e) => setPrimariosText(e.target.value)}
              placeholder={"Venda online - Pedido e checkout\nEntrega - Logística de entrega ao cliente"}
              rows={6}
            />
            <p className="text-xs text-gray-500 mt-1">Use o campo principal abaixo para listar todos os processos e categorizarei automaticamente.</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">Processos de Gestão (governança / operação)</label>
          <textarea
            className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
            value={gestaoText}
            onChange={(e) => setGestaoText(e.target.value)}
            placeholder={"Gestão financeira - Contabilidade e DRE\nGestão de pessoas - RH"}
            rows={3}
          />
        </div>

        <div>
          <label className="text-xs text-gray-400">Processos de Suporte</label>
          <textarea
            className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
            value={suporteText}
            onChange={(e) => setSuporteText(e.target.value)}
            placeholder={"Suporte técnico - Atendimento interno\nInfraestrutura - TI"}
            rows={3}
          />
        </div>

        <div>
          <label className="text-xs text-gray-400">Processos (campo único - um por linha) — principal</label>
          <textarea
            id="cadeia-principal"
            className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
            value={primariosText}
            onChange={(e) => setPrimariosText(e.target.value)}
            placeholder={"Receber pedido - Registro no ERP\nConferir mercadorias - Conferência física\n..."}
            rows={8}
          />
          <p className="text-xs text-gray-500 mt-1">Use este campo para listar todos os processos principais; os campos acima são informativos/duplicados para ajudar o usuário.</p>
        </div>

        <div>
          <label className="text-xs text-gray-400">Outputs / Valor entregue ao cliente (um por linha)</label>
          <textarea
            className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
            value={outputsText}
            onChange={(e) => setOutputsText(e.target.value)}
            placeholder={"Pedido entregue - Produto entregue ao cliente\nFatura emitida - Comprovante financeiro"}
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">Processos detectados: <strong className="text-white">{[
              ...parseProcessos(fornecedoresText, 'fornecedor'),
              ...parseProcessos(primariosText, 'primario'),
              ...parseProcessos(gestaoText, 'gestao'),
              ...parseProcessos(suporteText, 'suporte')
            ].length}</strong></div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-xs px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
            >
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>

        {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
      </form>
    </ModalWrapper>
  );
}
