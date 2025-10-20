// web/src/components/Consultor/Forms/ModalWrapper.tsx
import React from 'react';
import { X } from 'lucide-react';

interface ModalWrapperProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export default function ModalWrapper({
  isOpen,
  title,
  onClose,
  children,
  maxWidthClass = 'max-w-3xl',
}: ModalWrapperProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative w-full ${maxWidthClass} mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-xl`}>
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-800 text-gray-300"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
