import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DynamicFormAnamnese } from '../Consultor/Forms/DynamicFormAnamnese';
import { MatrizPriorizacaoForm } from '../Consultor/Forms/MatrizPriorizacaoForm';

interface FormularioModalProps {
  tipo: 'anamnese' | 'canvas' | 'cadeia_valor' | 'matriz_priorizacao' | 'processo_as_is';
  onClose: () => void;
  onComplete: (dados: any) => void;
  dadosIniciais?: any;
  processos?: any[];
}

export function FormularioModal({
  tipo,
  onClose,
  onComplete,
  dadosIniciais,
  processos
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
      <div className="relative bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4 border border-blue-500/30">
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
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-blue-400">Business Model Canvas</h2>
              <p className="text-gray-300">Mapeie seu modelo de negócio nos 9 blocos do Canvas</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const dados = Object.fromEntries(formData.entries());
                handleComplete(dados);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Segmentos de Clientes</label>
                  <textarea name="segmentos_clientes" rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Quem são seus clientes-alvo?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Proposta de Valor</label>
                  <textarea name="proposta_valor" rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Que valor você entrega?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Canais</label>
                  <textarea name="canais" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Como você alcança os clientes?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Relacionamento</label>
                  <textarea name="relacionamento" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Como você se relaciona com clientes?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Fontes de Receita</label>
                  <textarea name="fontes_receita" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Como você gera receita?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Recursos-Chave</label>
                  <textarea name="recursos_chave" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Quais recursos são essenciais?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Atividades-Chave</label>
                  <textarea name="atividades_chave" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="O que você faz de mais importante?" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Parcerias-Chave</label>
                  <textarea name="parcerias_chave" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Quem são seus parceiros estratégicos?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Estrutura de Custos</label>
                  <textarea name="estrutura_custos" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Quais são seus principais custos?" required />
                </div>
                <button type="submit" className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Concluir Canvas</button>
              </form>
            </div>
          )}

          {tipo === 'cadeia_valor' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-blue-400">Cadeia de Valor (Porter)</h2>
              <p className="text-gray-300">Liste seus processos separados por vírgula em cada categoria</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const dados = Object.fromEntries(formData.entries());
                handleComplete(dados);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <span className="text-blue-400">Inputs</span> (Entradas)
                  </label>
                  <input name="inputs" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: Matéria-prima, Pedidos de clientes, Dados de mercado (separe por vírgula)" required />
                  <p className="text-xs text-gray-400 mt-1">Entradas necessárias para iniciar os processos</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <span className="text-green-400">Processos Finalísticos</span>
                  </label>
                  <input name="finalisticos" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: Atendimento ao cliente, Vendas, Produção, Entrega (separe por vírgula)" required />
                  <p className="text-xs text-gray-400 mt-1">Processos com interação direta com o cliente e valor percebido</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <span className="text-purple-400">Processos de Gestão</span>
                  </label>
                  <input name="gestao" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: Planejamento estratégico, Controle financeiro, Gestão de pessoas (separe por vírgula)" required />
                  <p className="text-xs text-gray-400 mt-1">Processos gerenciais e de planejamento</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <span className="text-yellow-400">Processos de Suporte</span>
                  </label>
                  <input name="suporte" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: TI, RH, Jurídico, Contabilidade, Manutenção (separe por vírgula)" required />
                  <p className="text-xs text-gray-400 mt-1">Processos de apoio às atividades principais</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <span className="text-orange-400">Outputs</span> (Entregas)
                  </label>
                  <input name="outputs" type="text" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: Produto entregue, Serviço prestado, Relatório gerado (separe por vírgula)" required />
                  <p className="text-xs text-gray-400 mt-1">Entregas finais para o cliente</p>
                </div>
                <button type="submit" className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Concluir Cadeia de Valor</button>
              </form>
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
        </div>
      </div>
    </div>
  );
}
