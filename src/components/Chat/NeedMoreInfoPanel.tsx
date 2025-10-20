// /src/components/Chat/NeedMoreInfoPanel.tsx
// (OPCIONAL) UI simples para mostrar perguntas quando a função retornar need_more_info.

import { useState } from 'react';

type Gap = { id: string; label: string; question: string; hint?: string };

export default function NeedMoreInfoPanel({
  questions,
  onSubmit,
}: {
  questions: Gap[];
  onSubmit: (answers: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <div className="p-4 border rounded-xl bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-2">Faltam algumas informações</h3>
      <p className="text-sm mb-4">Responda para gerar o documento com precisão.</p>
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.id}>
            <label className="block text-sm font-medium mb-1">{q.label}</label>
            <p className="text-xs text-gray-600 mb-1">
              {q.question} {q.hint ? <em>({q.hint})</em> : null}
            </p>
            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={3}
              value={answers[q.id] || ''}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
              }
              placeholder="Digite aqui..."
            />
          </div>
        ))}
      </div>
      <button
        className="mt-4 px-4 py-2 rounded-xl border shadow-sm hover:bg-gray-50"
        onClick={() => {
          const txt = Object.entries(answers)
            .map(([k, v]) => `# ${k}\n${v}`)
            .join('\n\n');
          console.log('[DEBUG][NeedMoreInfoPanel] respostas:', answers, txt);
          onSubmit(txt);
        }}
      >
        Enviar respostas
      </button>
    </div>
  );
}
