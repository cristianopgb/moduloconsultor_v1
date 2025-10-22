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
  processos?: ProcessoOption[];
  initialProcesso?: { id?: string | null; nome?: string | null } | null;
  onSubmitted?: (response: any) => void;
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
  processos,
  initialProcesso
  , onSubmitted
}: Props) {
  const [fetchedProcessos, setFetchedProcessos] = useState<ProcessoOption[]>([]);
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
  setFetchedProcessos(rows || []);
        // If initialProcesso provided, try to pre-select
        if (initialProcesso) {
          const found = (rows || []).find((r:any) => String(r.id) === String(initialProcesso.id));
          if (found) setSelected(found.id);
          else if (initialProcesso.nome) {
            // If nome provided but id not found, set selected to the nome (will be submitted as nome)
            setSelected(String(initialProcesso.nome));
          }
        }
      } catch {
        // silencioso
      }
    }
    fetchProcessos();
  }, [isOpen, jornadaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!selected && (fetchedProcessos.length > 0)) {
      setErro('Selecione um processo.');
      return;
    }

    // determine processo_id and nome
    let processo_id: string | null = null;
    let processo_nome: string = '';
    const found = fetchedProcessos.find((p) => String(p.id) === String(selected));
    if (found) {
      processo_id = found.id;
      processo_nome = found.nome;
    } else if (selected) {
      // user typed a nome fallback
      processo_id = null;
      processo_nome = selected;
    }

    const form = {
      processo_id,
      processo_nome,
      input, regras, passos, ferramentas, metas, pessoas, clientes_fornecedores: clientesFornecedores, output
    };

    try {
      setLoading(true);

      // Use Supabase Functions invocation to keep same auth context
      // attempt to get session token
      const { data: sessionData } = await (window as any).supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const payload = {
        message: 'Formulário de Atributos do Processo enviado',
        conversation_id: conversationId,
        user_id: userId,
        form_type: 'atributos_processo',
        form_data: form,
      };

      // Prefer using supabase.functions.invoke if available on window.supabase
      let json: any = null;
      try {
        if ((window as any).supabase && (window as any).supabase.functions && (window as any).supabase.functions.invoke) {
          const resp = await (window as any).supabase.functions.invoke('consultor-chat', { body: payload });
          json = resp;
        } else {
          // fallback to direct fetch to functions URL with token if present
          const res = await fetch(defaultEdge(edgeUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            // try parse error body
            const txt = await res.text().catch(() => '');
            let parsed = null;
            try { parsed = JSON.parse(txt) } catch {};
            throw new Error(parsed?.error || parsed?.message || txt || `Erro HTTP ${res.status}`);
          }
          json = await res.json().catch(() => null);
        }
      } catch (err2: any) {
        throw err2;
      }

      try { if (onSubmitted) onSubmitted(json); } catch (e) { /* ignore */ }
      onClose();
    } catch (err: any) {
      setErro(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalWrapper isOpen={isOpen} title="Atributos do Processo" onClose={onClose} maxWidthClass="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {(processos && processos.length > 0) || (fetchedProcessos.length > 0) ? (
          <div>
            <label className="text-xs text-gray-400">Selecione o processo</label>
            <select
              className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              required
            >
              <option value="">-- Selecione --</option>
              {(processos || fetchedProcessos).map((p) => (
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
              rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Principais entradas deste processo (ex.: pedidos clientes, notas fiscais, solicitações)" />
            <p className="text-xs text-gray-400 mt-1">Liste as entradas necessárias para iniciar o processo.</p>
          </div>
          <div>
            <label className="text-xs text-gray-400">Regras de negócio</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={regras} onChange={(e) => setRegras(e.target.value)} placeholder="Regras, validações e restrições aplicáveis (ex.: verificar estoque, validação de pagamento)" />
            <p className="text-xs text-gray-400 mt-1">Descreva regras, validações e exceções relevantes.</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">Passo a passo (detalhado)</label>
          <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
            rows={4} value={passos} onChange={(e) => setPassos(e.target.value)} placeholder="Descreva as etapas em ordem (ex.: 1) Recebe pedido → 2) Confere pagamento → 3) Embala produto)" />
          <p className="text-xs text-gray-400 mt-1">Detalhe o fluxo atual passo a passo.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Ferramentas / Sistemas</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={ferramentas} onChange={(e) => setFerramentas(e.target.value)} placeholder="Sistemas e ferramentas usadas (ex.: ERP, planilha Excel, CRM)" />
            <p className="text-xs text-gray-400 mt-1">Indique sistemas, integrações e ferramentas envolvidas.</p>
          </div>
          <div>
            <label className="text-xs text-gray-400">Metas / Métricas</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={metas} onChange={(e) => setMetas(e.target.value)} placeholder="Indicadores e metas associadas (ex.: tempo médio, taxa de retrabalho, SLA)" />
            <p className="text-xs text-gray-400 mt-1">Defina indicadores e metas para este processo.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Pessoas (papéis)</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={pessoas} onChange={(e) => setPessoas(e.target.value)} placeholder="Quem participa? (ex.: vendedor, estoquista, financeiro)" />
            <p className="text-xs text-gray-400 mt-1">Liste papéis e responsáveis principais.</p>
          </div>
          <div>
            <label className="text-xs text-gray-400">Clientes / Fornecedores</label>
            <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
              rows={2} value={clientesFornecedores} onChange={(e) => setClientesFornecedores(e.target.value)} placeholder="Principais clientes ou fornecedores envolvidos" />
            <p className="text-xs text-gray-400 mt-1">Indique stakeholders externos relevantes.</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">Output (saída)</label>
          <textarea className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
            rows={2} value={output} onChange={(e) => setOutput(e.target.value)} placeholder="O que é gerado ao final (ex.: nota fiscal, entrega, relatório)" />
          <p className="text-xs text-gray-400 mt-1">Descreva o resultado final do processo.</p>
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
