// web/src/components/Consultor/Forms/AtributosProcessoForm.tsx
import React, { useEffect, useState } from 'react';
import ModalWrapper from './ModalWrapper';

type ProcessoOption = { id: string; nome: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  userId: string;
  jornadaId?: string;
  edgeUrl?: string;
}

const defaultEdge = (url?: string) =>
  url || `${(window as any)?.SUPABASE_FUNCTIONS_URL || '/functions/v1'}/consultor-chat`;

export default function AtributosProcessoForm({
  isOpen,
  onClose,
  conversationId,
  userId,
  jornadaId,
  edgeUrl,
}: Props) {
  const [processos, setProcessos] = useState<ProcessoOption[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [regras, setRegras] = useState('');
  const [passos, setPassos] = useState('');
  const [ferramentas, setFerramentas] = useState('');
  const [metas, setMetas] = useState('');
  const [pessoas, setPessoas] = useState('');
  const [clientesFornecedores, setClientesFornecedores] = useState('');
  const [output, setOutput] = useState('');

  useEffect(() => {
    async function fetchProcessos() {
      try {
        if (!isOpen || !jornadaId) return;
        const baseUrl = (window as any)?.SUPABASE_REST_URL;
        const anonKey = (window as any)?.SUPABASE_ANON_KEY;
        if (!baseUrl || !anonKey) return;

        const res = await fetch(`${baseUrl}/cadeia_valor_processos?select=id,nome&jornada_id=eq.${jornadaId}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
        });
        if (!res.ok) return;
        const rows = await res.json();
        setProcessos(rows || []);
      } catch {
        // silencioso
      }
    }
    fetchProcessos();
  }, [isOpen, jornadaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!selected && processos.length > 0) {
      setErro('Selecione um processo.');
      return;
    }

    const form = {
      processo_id: selected || null,
      processo_nome: selected ? (processos.find((p) => p.id === selected)?.nome || '') : selected,
      input, regras, passos, ferramentas, metas, pessoas, clientes_fornecedores: clientesFornecedores, output
    };

    try {
      setLoading(true);
      const payload = {
        message: 'Formulário de Atributos do Processo enviado',
        conversation_id: conversationId,
        user_id: userId,
        form_type: 'atributos_processo',
        form_data: form,
      };

      const res = await fetch(defaultEdge(edgeUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Erro ao enviar formulário.');
      }

      onClose();
    } catch (err: any) {
      setErro(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalWrapper isOpen={isOpen} title="Atributos do Processo" onClose={onClose} maxWidthClass="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {processos.length > 0 ? (
          <div>
            <label className="text-xs text-gray-400">Selecione o processo</label>
            <select
              className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              required
            >
              <option value="">-- Selecione --</option>
              {processos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs text-gray-400">Nome do processo (se não aparecer na lista)</label>
            <input
              className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              placeholder="Ex.: Faturar pedido"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              required
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Input (entradas)</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Regras de negócio</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={regras} onChange={(e) => setRegras(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">Passo a passo (detalhado)</label>
          <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
            rows={4} value={passos} onChange={(e) => setPassos(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Ferramentas / Sistemas</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={ferramentas} onChange={(e) => setFerramentas(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Metas / Métricas</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={metas} onChange={(e) => setMetas(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Pessoas (papéis)</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={pessoas} onChange={(e) => setPessoas(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Clientes / Fornecedores</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={clientesFornecedores} onChange={(e) => setClientesFornecedores(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">Output (saída)</label>
          <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
            rows={2} value={output} onChange={(e) => setOutput(e.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-2">
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

        {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
      </form>
    </ModalWrapper>
  );
}
