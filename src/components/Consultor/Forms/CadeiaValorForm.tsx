// web/src/components/Consultor/Forms/CadeiaValorForm.tsx
import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';

type Processo = {
  id?: string;
  nome: string;
  descricao?: string;
  impacto?: number;       // 1..5
  criticidade?: number;   // 1..5
  esforco?: number;       // 1..5
  categoria: 'primaria' | 'suporte';
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  userId: string;
  edgeUrl?: string; // opcional
}

const defaultEdge = (url?: string) =>
  url || `${(window as any)?.SUPABASE_FUNCTIONS_URL || '/functions/v1'}/consultor-chat`;

export default function CadeiaValorForm({
  isOpen,
  onClose,
  conversationId,
  userId,
  edgeUrl,
}: Props) {
  const [processos, setProcessos] = useState<Processo[]>([
    { nome: '', descricao: '', impacto: 3, criticidade: 3, esforco: 3, categoria: 'primaria' },
  ]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const addProcesso = () => {
    setProcessos((prev) => [...prev, { nome: '', descricao: '', impacto: 3, criticidade: 3, esforco: 3, categoria: 'primaria' }]);
  };

  const removeProcesso = (idx: number) => {
    setProcessos((prev) => prev.filter((_, i) => i !== idx));
  };

  const update = (idx: number, k: keyof Processo, v: any) => {
    setProcessos((prev) => prev.map((p, i) => (i === idx ? { ...p, [k]: v } : p)));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (processos.length === 0 || processos.some((p) => !p.nome.trim())) {
      setErro('Inclua pelo menos um processo com nome.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        message: 'Formulário de Cadeia de Valor enviado',
        conversation_id: conversationId,
        user_id: userId,
        form_type: 'cadeia_valor',
        form_data: { processos },
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
    <ModalWrapper isOpen={isOpen} title="Cadeia de Valor" onClose={onClose} maxWidthClass="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-300">
          Liste seus processos. Defina <strong>Primária</strong> ou <strong>Suporte</strong>.
          Preencha impacto, criticidade e esforço (1 a 5) — isso alimenta a priorização.
        </p>

        {processos.map((p, idx) => (
          <div key={idx} className="rounded-lg border border-gray-700 p-3 bg-gray-900/60">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-400">Nome do processo</label>
                <input
                  className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
                  value={p.nome}
                  onChange={(e) => update(idx, 'nome', e.target.value)}
                  placeholder="Ex.: Receber pedido"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">Categoria</label>
                <select
                  className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
                  value={p.categoria}
                  onChange={(e) => update(idx, 'categoria', e.target.value as any)}
                >
                  <option value="primaria">Primária</option>
                  <option value="suporte">Suporte</option>
                </select>
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => removeProcesso(idx)}
                  className="text-xs px-3 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Remover
                </button>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-gray-400">Descrição (opcional)</label>
              <textarea
                className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
                value={p.descricao || ''}
                onChange={(e) => update(idx, 'descricao', e.target.value)}
                placeholder="Breve descrição do processo"
                rows={2}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400">Impacto (1..5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
                  value={p.impacto ?? 3}
                  onChange={(e) => update(idx, 'impacto', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Criticidade (1..5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
                  value={p.criticidade ?? 3}
                  onChange={(e) => update(idx, 'criticidade', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Esforço (1..5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="w-full mt-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100"
                  value={p.esforco ?? 3}
                  onChange={(e) => update(idx, 'esforco', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={addProcesso}
            className="text-xs px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700"
          >
            + Adicionar processo
          </button>

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
