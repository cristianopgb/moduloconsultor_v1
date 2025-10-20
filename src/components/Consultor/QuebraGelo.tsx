import React from 'react';
import { Briefcase, TrendingUp, Target, ArrowRight } from 'lucide-react';

interface QuebraGeloProps {
  onStart: () => void;
}

export function QuebraGelo({ onStart }: QuebraGeloProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Briefcase className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Proceda Consultor IA
        </h1>

        <p className="text-xl text-gray-600 mb-8">
          Especialista em Gest�o Empresarial
        </p>

        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8 shadow-sm">
          <p className="text-gray-800 text-lg italic leading-relaxed">
            "Tem algumas coisas aqui que poderiam funcionar melhor,<br />
            mas n�o sei bem como mudar..."
          </p>
        </div>

        <p className="text-gray-700 text-lg mb-8 leading-relaxed">
          Se voc� j� pensou isso sobre sua empresa, <strong>est� no lugar certo</strong>.<br />
          Vou te ajudar a identificar e resolver os problemas que est�o<br />
          limitando seu crescimento.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Diagn�stico Preciso</h3>
            <p className="text-sm text-gray-600">
              Detectamos problemas ocultos baseados no perfil da sua empresa
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Solu��es Pr�ticas</h3>
            <p className="text-sm text-gray-600">
              Planos de a��o customizados para sua realidade e capacidade
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Acompanhamento</h3>
            <p className="text-sm text-gray-600">
              Monitoramento completo com Kanban e entreg�veis autom�ticos
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Sua Jornada de Transforma��o</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
            <div>
              <div className="text-2xl font-bold text-blue-600 mb-1">1</div>
              <div className="text-sm font-medium text-gray-900">Anamnese</div>
              <div className="text-xs text-gray-600">Conhecer seu neg�cio</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 mb-1">2</div>
              <div className="text-sm font-medium text-gray-900">Mapeamento</div>
              <div className="text-xs text-gray-600">Entender processos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 mb-1">3</div>
              <div className="text-sm font-medium text-gray-900">Prioriza��o</div>
              <div className="text-xs text-gray-600">Definir roadmap</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 mb-1">4</div>
              <div className="text-sm font-medium text-gray-900">Execu��o</div>
              <div className="text-xs text-gray-600">Implementar solu��es</div>
            </div>
          </div>
        </div>

        <button
          onClick={onStart}
          className="group bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl text-lg font-semibold flex items-center gap-3 mx-auto"
        >
          Iniciar Consultoria
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-xs text-gray-500 mt-6">
          Metodologia comprovada com 500+ empresas transformadas
        </p>
      </div>
    </div>
  );
}
