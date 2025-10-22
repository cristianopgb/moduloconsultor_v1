// React import not required with new JSX transform
import { X } from 'lucide-react';
import { DynamicFormAnamnese } from '../Consultor/Forms/DynamicFormAnamnese';
import { MatrizPriorizacaoForm } from '../Consultor/Forms/MatrizPriorizacaoForm';
import AtributosProcessoForm from '../Consultor/Forms/AtributosProcessoForm';
import CadeiaValorForm from '../Consultor/Forms/CadeiaValorForm';
import StableCanvas from '../Consultor/Forms/StableCanvas';

interface FormularioModalProps {
  tipo: 'anamnese' | 'canvas' | 'cadeia_valor' | 'matriz_priorizacao' | 'processo_as_is' | 'atributos_processo';
  onClose: () => void;
  onComplete: (dados: any) => void;
  dadosIniciais?: any;
  processos?: any[];
  processoInicial?: { id?: string | null; nome?: string | null } | null;
  conversationId?: string | null;
  userId?: string | null;
  jornadaId?: string | null;
}

export function FormularioModal({
  tipo,
  onClose,
  onComplete,
  dadosIniciais,
  processos,
  processoInicial
  , conversationId, userId, jornadaId
}: FormularioModalProps) {
  const handleComplete = (dados: any) => {
    onComplete(dados);
    onClose();
  };

  const handleInterrupt = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto m-4 border border-blue-500/30">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="p-6">
          {tipo === 'anamnese' && (
            <DynamicFormAnamnese
              onComplete={handleComplete}
              onInterrupt={handleInterrupt}
              dadosIniciais={dadosIniciais}
            />
          )}

          {tipo === 'canvas' && (
            <StableCanvas dadosIniciais={dadosIniciais} onComplete={handleComplete} />
          )}

          {tipo === 'cadeia_valor' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-blue-400">Cadeia de Valor (Porter)</h2>
              <p className="text-gray-300">Liste seus processos por categoria. Use o formulário para inserir processos estruturados.</p>
              <CadeiaValorForm
                isOpen={true}
                onClose={onClose}
                conversationId={conversationId || ''}
                userId={userId || ''}
                edgeUrl={undefined}
              />
            </div>
          )}

          {tipo === 'matriz_priorizacao' && processos && (
            <MatrizPriorizacaoForm
              processos={processos}
              onComplete={handleComplete}
            />
          )}

          {tipo === 'processo_as_is' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-blue-400">Mapeamento AS-IS (Processo Atual)</h2>
              <p className="text-gray-300">Descreva como o processo funciona atualmente</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const dados = Object.fromEntries(formData.entries());
                handleComplete(dados);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Processo</label>
                  <input name="nome_processo" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: Atendimento ao Cliente" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Objetivo do Processo</label>
                  <textarea name="objetivo" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Qual o propósito deste processo?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Responsáveis</label>
                  <input name="responsaveis" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Quem executa? (ex: time comercial, gerente)" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Etapas do Processo Atual</label>
                  <textarea name="etapas_atuais" rows={5} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Descreva passo a passo como funciona hoje..." required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sistemas/Ferramentas Utilizados</label>
                  <input name="sistemas" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: Excel, CRM, e-mail..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tempo Médio de Execução</label>
                  <input name="tempo_medio" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 2 horas, 1 dia..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Principais Problemas/Gargalos</label>
                  <textarea name="problemas" rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Quais dificuldades você enfrenta neste processo?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Inputs (Entradas)</label>
                  <input name="inputs" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="O que é necessário para iniciar?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Outputs (Saídas)</label>
                  <input name="outputs" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="O que é gerado ao final?" />
                </div>
                <button type="submit" className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Concluir Mapeamento AS-IS</button>
              </form>
            </div>
          )}

          {tipo === 'atributos_processo' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-blue-400">Atributos do Processo</h2>
              <p className="text-gray-300">Forneça atributos que serão usados na priorização (impacto, criticidade, esforço)</p>
              <AtributosProcessoForm
                isOpen={true}
                onClose={onClose}
                conversationId={conversationId || ''}
                userId={userId || ''}
                jornadaId={jornadaId || undefined}
                edgeUrl={undefined}
                processos={processos}
                initialProcesso={processoInicial || null}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
