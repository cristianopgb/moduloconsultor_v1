import { useState } from 'react';
import { Send, Check, Pencil, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  plan: {
    id: string;
    understanding: string;
    summary: string;
    needs_clarification: boolean;
    questions: string[];
  };
  onApprove: (planId: string) => void;
  onReject: (planId: string, feedback: string) => void;
  onAnswer: (planId: string, answers: string) => void;
}

export function AnalysisPlanValidation({ plan, onApprove, onReject, onAnswer }: Props) {
  const [feedback, setFeedback] = useState('');
  const [answers, setAnswers] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 shadow-sm border border-blue-200">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Entendi sua solicitação</h3>
          <p className="text-sm text-gray-600 mt-1">{plan.understanding}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Vou fazer esta análise:</h4>
        <div className="text-gray-800 whitespace-pre-line">{plan.summary}</div>
      </div>

      {plan.needs_clarification && plan.questions && plan.questions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900 mb-1">Preciso de esclarecimentos:</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                {plan.questions.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            </div>
          </div>
          <textarea
            className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
            rows={3}
            placeholder="Me conte mais..."
            value={answers}
            onChange={(e) => setAnswers(e.target.value)}
          />
          <button
            onClick={() => onAnswer(plan.id, answers)}
            disabled={!answers.trim()}
            className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Responder
          </button>
        </div>
      )}

      {!plan.needs_clarification && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onApprove(plan.id)}
            className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Check className="w-5 h-5" />
            Sim, pode analisar
          </button>
          <button
            onClick={() => setShowFeedbackForm(true)}
            className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Não, quero outra coisa
          </button>
        </div>
      )}

      {showFeedbackForm && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Me conte: o que exatamente você gostaria de ver?
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            placeholder="Descreva o que você quer ver..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                onReject(plan.id, feedback);
                setShowFeedbackForm(false);
              }}
              disabled={!feedback.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enviar correção
            </button>
            <button
              onClick={() => {
                setShowFeedbackForm(false);
                setFeedback('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
