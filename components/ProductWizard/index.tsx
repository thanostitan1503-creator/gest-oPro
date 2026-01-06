/**
 * 🚀 WIZARD DE CADASTRO DE PRODUTOS
 * 
 * Implementação limpa em 2 etapas:
 * - Passo 1: Definição & Tipo de Movimentação
 * - Passo 2: Precificação & Estoque por Depósito
 */

import React, { useState } from 'react';
import { X, Package, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { Step1Definition } from './Step1Definition.tsx';
import { Step2Pricing } from './Step2Pricing.tsx';

export interface ProductWizardProps {
  isOpen: boolean;
  onClose: () => void;
  depositoId: string;
  depositoNome: string;
  onSuccess?: () => void;
}

export interface CreatedProductInfo {
  id: string;
  nome: string;
  tipoMovimento: 'SIMPLE' | 'EXCHANGE' | 'VASILHAME';
  vasilhameId?: string | null;
  vasilhameNome?: string | null;
}

export const ProductWizard: React.FC<ProductWizardProps> = ({
  isOpen,
  onClose,
  depositoId,
  depositoNome,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [createdProduct, setCreatedProduct] = useState<CreatedProductInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStep1Success = (product: CreatedProductInfo) => {
    console.log('✅ Passo 1 concluído:', product);
    setCreatedProduct(product);
    setCurrentStep(2);
    setError(null);
  };

  const handleStep2Success = () => {
    console.log('✅ Passo 2 concluído - Produto vinculado ao depósito');
    onSuccess?.();
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep(1);
    setCreatedProduct(null);
    setError(null);
    onClose();
  };

  const handleError = (msg: string) => {
    setError(msg);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-surface rounded-2xl border border-bdr shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Novo Produto</h2>
              <p className="text-xs text-white/80 font-medium">Cadastro em 2 passos simples</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-app border-b border-bdr">
          <div className="flex items-center gap-4">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                currentStep === 1 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-emerald-500 text-white'
              }`}>
                {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-sm font-bold ${currentStep === 1 ? 'text-emerald-600' : 'text-txt-muted'}`}>
                Definição
              </span>
            </div>

            <ChevronRight className="w-4 h-4 text-txt-muted" />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                currentStep === 2 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-app text-txt-muted border-2 border-bdr'
              }`}>
                2
              </div>
              <span className={`text-sm font-bold ${currentStep === 2 ? 'text-emerald-600' : 'text-txt-muted'}`}>
                Preço & Estoque
              </span>
            </div>
          </div>

          {/* Depósito Info */}
          <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700 font-bold">
              📍 Depósito: <span className="text-blue-900">{depositoNome}</span>
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">Erro</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {currentStep === 1 && (
            <Step1Definition
              onSuccess={handleStep1Success}
              onCancel={handleClose}
              onError={handleError}
            />
          )}

          {currentStep === 2 && createdProduct && (
            <Step2Pricing
              product={createdProduct}
              depositoId={depositoId}
              depositoNome={depositoNome}
              onSuccess={handleStep2Success}
              onBack={() => setCurrentStep(1)}
              onError={handleError}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductWizard;



