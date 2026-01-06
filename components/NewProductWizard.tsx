import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, ChevronRight, ArrowLeft, Info } from 'lucide-react';
import { Produto } from '@/domain/types';
import { generateId } from '@/domain/db';
import { createProduct, updateProduct, upsertPricing, applyMovement, getBalance } from '@/domain/repositories/index';

type Step = 'definition' | 'pricing';

interface WizardProps {
  onClose: () => void;
  /** Depósito atual para vincular preço/estoque no Passo 2 */
  currentDepositId?: string | null;
  onFinished?: () => void;
}

const movementOptions = [
  {
    id: 'SIMPLE',
    label: 'Venda simples',
    description: 'Sai 1 unidade do estoque ao vender.',
  },
  {
    id: 'EXCHANGE',
    label: 'Venda com troca (gás)',
    description: 'Sai o cheio e entra o vasilhame vazio automaticamente.',
  },
  {
    id: 'VASILHAME',
    label: 'Vasilhame (patrimônio)',
    description: 'Controle apenas do casco vazio.',
  },
];

const step1Schema = z.object({
  nome: z.string().min(2, 'Informe o nome do produto'),
  codigo: z.string().optional(),
  unidade: z.string().min(1, 'Informe a unidade'),
  tipoMovimento: z.enum(['SIMPLE', 'EXCHANGE', 'VASILHAME']),
});

const step2Schema = z.object({
  precoCusto: z.number().positive('Preço de custo deve ser > 0'),
  precoVenda: z.number().positive('Preço de venda deve ser > 0'),
  estoqueInicial: z.number().min(0, 'Estoque inicial não pode ser negativo'),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export const NewProductWizard: React.FC<WizardProps> = ({ onClose, currentDepositId, onFinished }) => {
  const [step, setStep] = useState<Step>('definition');
  const [loading, setLoading] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [createdEmptyId, setCreatedEmptyId] = useState<string | null>(null);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      nome: '',
      codigo: '',
      unidade: 'UN',
      tipoMovimento: 'SIMPLE',
    },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      precoCusto: 0,
      precoVenda: 0,
      estoqueInicial: 0,
    },
  });

  const depositRequiredWarning = useMemo(() => {
    if (step === 'pricing' && !currentDepositId) {
      return 'Selecione um depósito para vincular preço e estoque.';
    }
    return null;
  }, [step, currentDepositId]);

  const handleStep1 = async (data: Step1Data) => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const productId = generateId();
      let emptyProductId: string | null = null;

      const baseProduct: Produto = {
        id: productId,
        nome: data.nome.trim(),
        codigo: data.codigo?.trim() || '',
        unidade: data.unidade.trim(),
        tipo: data.tipoMovimento === 'VASILHAME' ? 'VASILHAME_VAZIO' : 'OUTROS',
        product_group: null,
        descricao: null,
        imagem_url: null,
        preco_custo: 0,
        preco_venda: 0,
        preco_padrao: 0,
        marcacao: null as any,
        depositoId: null,
        track_stock: true,
        tracks_empties: false,
        ativo: true,
        current_stock: null,
        min_stock: null,
        movement_type: data.tipoMovimento === 'EXCHANGE' ? 'EXCHANGE' : 'SIMPLE',
        return_product_id: null,
        is_delivery_fee: false,
        type: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      if (data.tipoMovimento === 'EXCHANGE') {
        // Criar vasilhame automático
        emptyProductId = generateId();
        const emptyProduct: Produto = {
          id: emptyProductId,
          nome: `Vasilhame ${data.nome.trim()}`,
          codigo: baseProduct.codigo ? `${baseProduct.codigo}-VZ` : '',
          unidade: data.unidade.trim(),
          tipo: 'VASILHAME_VAZIO',
          product_group: null,
          descricao: null,
          imagem_url: null,
          preco_custo: 0,
          preco_venda: 0,
          preco_padrao: 0,
          marcacao: null as any,
          depositoId: null,
          track_stock: true,
          tracks_empties: false,
          ativo: true,
          current_stock: null,
          min_stock: null,
          movement_type: 'SIMPLE',
          return_product_id: null,
          is_delivery_fee: false,
          type: null,
          created_at: nowIso,
          updated_at: nowIso,
        };

        await createProduct(emptyProduct);
        baseProduct.return_product_id = emptyProductId;
      }

      await createProduct(baseProduct);

      setCreatedProductId(productId);
      setCreatedEmptyId(emptyProductId);
      setStep('pricing');
    } catch (error: any) {
      console.error('Erro ao criar definição do produto', error);
      alert(error?.message || 'Erro ao criar produto');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (data: Step2Data) => {
    if (!createdProductId) {
      alert('Produto não criado na Etapa 1');
      return;
    }
    if (!currentDepositId) {
      alert('Selecione um depósito antes de salvar.');
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();

      // Atualiza produto principal com preço e depósito
      await updateProduct(createdProductId, {
        preco_custo: data.precoCusto,
        preco_venda: data.precoVenda,
        depositoId: currentDepositId,
        updated_at: nowIso,
        track_stock: true,
      } as Partial<Produto>);

      // Upsert pricing por depósito
      await upsertPricing({
        productId: createdProductId,
        depositoId: currentDepositId,
        price: data.precoVenda,
        created_at: nowIso,
        updated_at: nowIso,
      });

      // Estoque inicial via movimento
      const currentBalance = await getBalance(currentDepositId, createdProductId);
      const currentStock = currentBalance?.quantidade_atual ?? 0;
      const desired = data.estoqueInicial;
      if (desired !== currentStock) {
        const divergence = desired - currentStock;
        await applyMovement({
          id: generateId(),
          dataHora: nowIso,
          depositoId: currentDepositId,
          produtoId: createdProductId,
          produtoNome: 'Estoque inicial',
          tipo: divergence > 0 ? 'ENTRADA' : 'SAIDA',
          quantidade: Math.abs(divergence),
          origem: 'AJUSTE_MANUAL',
          usuarioId: 'sistema',
          usuarioNome: 'Sistema',
          motivo: 'Estoque inicial (wizard)',
        });
      }

      onFinished?.();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar preço/estoque', error);
      alert(error?.message || 'Erro ao salvar preço/estoque');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <form onSubmit={step1Form.handleSubmit(handleStep1)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-txt-muted">Nome</label>
          <input
            className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm text-txt-main"
            placeholder="Ex: Gás P13"
            {...step1Form.register('nome')}
          />
          <p className="text-xs text-red-500">{step1Form.formState.errors.nome?.message}</p>
        </div>
        <div>
          <label className="text-xs font-bold text-txt-muted">Código / SKU</label>
          <input
            className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm text-txt-main"
            placeholder="Opcional"
            {...step1Form.register('codigo')}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-txt-muted">Unidade</label>
          <input
            className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm text-txt-main"
            placeholder="UN, KG, LT"
            {...step1Form.register('unidade')}
          />
          <p className="text-xs text-red-500">{step1Form.formState.errors.unidade?.message}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black text-txt-muted uppercase tracking-wide">Tipo de movimentação</p>
        <div className="grid md:grid-cols-3 gap-3">
          {movementOptions.map(opt => (
            <label
              key={opt.id}
              className={`border rounded-xl p-3 cursor-pointer transition-all ${
                step1Form.watch('tipoMovimento') === opt.id
                  ? 'border-emerald-500 bg-emerald-50/10'
                  : 'border-bdr bg-app'
              }`}
            >
              <input
                type="radio"
                value={opt.id}
                className="hidden"
                {...step1Form.register('tipoMovimento')}
              />
              <p className="text-sm font-black text-txt-main">{opt.label}</p>
              <p className="text-xs text-txt-muted leading-relaxed">{opt.description}</p>
              {opt.id === 'EXCHANGE' && (
                <div className="mt-2 flex items-start gap-2 text-amber-500 text-xs font-bold">
                  <Info className="w-4 h-4" />
                  <span>Um vasilhame correspondente será criado automaticamente.</span>
                </div>
              )}
            </label>
          ))}
        </div>
        <p className="text-xs text-red-500">{step1Form.formState.errors.tipoMovimento?.message}</p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-bold text-txt-muted border border-bdr rounded-lg hover:bg-app"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2"
        >
          Avançar
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );

  const renderStep2 = () => (
    <form onSubmit={step2Form.handleSubmit(handleStep2)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-bold text-txt-muted">Preço de custo</label>
          <input
            type="number"
            step="0.01"
            className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm text-txt-main"
            {...step2Form.register('precoCusto', { valueAsNumber: true })}
          />
          <p className="text-xs text-red-500">{step2Form.formState.errors.precoCusto?.message}</p>
        </div>
        <div>
          <label className="text-xs font-bold text-txt-muted">Preço de venda</label>
          <input
            type="number"
            step="0.01"
            className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm text-txt-main"
            {...step2Form.register('precoVenda', { valueAsNumber: true })}
          />
          <p className="text-xs text-red-500">{step2Form.formState.errors.precoVenda?.message}</p>
        </div>
        <div>
          <label className="text-xs font-bold text-txt-muted">Estoque inicial</label>
          <input
            type="number"
            step="1"
            className="w-full bg-app border border-bdr rounded-lg px-3 py-2 text-sm text-txt-main"
            {...step2Form.register('estoqueInicial', { valueAsNumber: true })}
          />
          <p className="text-xs text-red-500">{step2Form.formState.errors.estoqueInicial?.message}</p>
        </div>
      </div>

      {depositRequiredWarning && (
        <div className="p-3 rounded-lg border border-amber-400 text-amber-500 text-sm font-bold bg-amber-50/10">
          {depositRequiredWarning}
        </div>
      )}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep('definition')}
          className="px-4 py-2 text-sm font-bold text-txt-muted border border-bdr rounded-lg hover:bg-app flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-txt-muted border border-bdr rounded-lg hover:bg-app"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !currentDepositId}
            className="px-4 py-2 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-60"
          >
            Concluir
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-surface rounded-2xl border border-bdr shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bdr bg-app">
          <div>
            <p className="text-xs font-black text-txt-muted uppercase tracking-[0.2em]">Cadastro de Produto</p>
            <h3 className="text-xl font-black text-txt-main">Wizard em 2 passos</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-app rounded-lg text-txt-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4 pb-2 flex gap-2 text-xs font-black uppercase tracking-widest">
          <span className={`px-3 py-1 rounded-full ${step === 'definition' ? 'bg-emerald-500 text-white' : 'bg-app text-txt-muted'}`}>
            1. Definição & Lógica
          </span>
          <span className={`px-3 py-1 rounded-full ${step === 'pricing' ? 'bg-emerald-500 text-white' : 'bg-app text-txt-muted'}`}>
            2. Preço & Estoque
          </span>
        </div>

        <div className="p-6">
          {step === 'definition' ? renderStep1() : renderStep2()}
        </div>
      </div>
    </div>
  );
};

export default NewProductWizard;