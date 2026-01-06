/**
 * 📦 PASSO 1: DEFINIÇÃO DO PRODUTO
 * 
 * Campos:
 * - Nome do Produto
 * - Código/SKU (opcional)
 * - Unidade
 * - Tipo de Movimentação (CRÍTICO)
 * 
 * Se tipo = EXCHANGE, cria vasilhame automaticamente
 */

import React, { useState } from 'react';
import { Package, Cylinder, RefreshCw, Box, ChevronRight, Loader2, Info } from 'lucide-react';
import { db, generateId } from '@/domain/db';
import { Produto } from '@/domain/types';

interface Step1Props {
  onSuccess: (product: {
    id: string;
    nome: string;
    tipoMovimento: 'SIMPLE' | 'EXCHANGE' | 'VASILHAME';
    vasilhameId?: string | null;
    vasilhameNome?: string | null;
  }) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}

type TipoMovimento = 'SIMPLE' | 'EXCHANGE' | 'VASILHAME';

const MOVEMENT_OPTIONS = [
  {
    id: 'SIMPLE' as TipoMovimento,
    label: 'Venda Simples',
    description: 'Sai 1 unidade do estoque. Ex: Água, doces, acessórios.',
    icon: Box,
    color: 'blue',
  },
  {
    id: 'EXCHANGE' as TipoMovimento,
    label: 'Venda com Troca',
    description: 'Sai o cheio, entra o vazio. Ex: Gás P13, P45.',
    icon: RefreshCw,
    color: 'emerald',
  },
  {
    id: 'VASILHAME' as TipoMovimento,
    label: 'Vasilhame',
    description: 'Apenas controle de patrimônio (casco vazio).',
    icon: Cylinder,
    color: 'amber',
  },
];

export const Step1Definition: React.FC<Step1Props> = ({ onSuccess, onCancel, onError }) => {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [tipoMovimento, setTipoMovimento] = useState<TipoMovimento>('SIMPLE');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!nome.trim()) {
      onError('Informe o nome do produto');
      return;
    }

    if (!unidade.trim()) {
      onError('Informe a unidade');
      return;
    }

    setSaving(true);

    try {
      const nowIso = new Date().toISOString();
      const productId = generateId();
      let vasilhameId: string | null = null;
      let vasilhameNome: string | null = null;

      // Se EXCHANGE, criar vasilhame primeiro
      if (tipoMovimento === 'EXCHANGE') {
        vasilhameId = generateId();
        vasilhameNome = `Vasilhame ${nome.trim()}`;

        const vasilhame: Produto = {
          id: vasilhameId,
          nome: vasilhameNome,
          codigo: codigo ? `${codigo}-VZ` : '',
          unidade: unidade.trim(),
          tipo: 'VASILHAME_VAZIO',
          descricao: null,
          product_group: null,
          imagem_url: null,
          deposit_id: null, // Global
          preco_custo: 0,
          preco_venda: 0,
          preco_padrao: 0,
          marcacao: null as any,
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

        console.log('📦 Criando vasilhame:', vasilhameNome);
        await db.products.put(vasilhame);
        console.log('✅ Vasilhame criado:', vasilhameId);
      }

      // Criar produto principal
      const produto: Produto = {
        id: productId,
        nome: nome.trim(),
        codigo: codigo.trim() || '',
        unidade: unidade.trim(),
        tipo: tipoMovimento === 'VASILHAME' ? 'VASILHAME_VAZIO' : 'OUTROS',
        descricao: null,
        product_group: null,
        imagem_url: null,
        deposit_id: null, // Global - será vinculado no passo 2
        preco_custo: 0,
        preco_venda: 0,
        preco_padrao: 0,
        marcacao: null as any,
        track_stock: true,
        tracks_empties: false,
        ativo: true,
        current_stock: null,
        min_stock: null,
        movement_type: tipoMovimento === 'EXCHANGE' ? 'EXCHANGE' : 'SIMPLE',
        return_product_id: vasilhameId, // Vínculo com vasilhame
        is_delivery_fee: false,
        type: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      console.log('📦 Criando produto principal:', nome);
      await db.products.put(produto);
      console.log('✅ Produto criado:', productId);

      // Sucesso!
      onSuccess({
        id: productId,
        nome: nome.trim(),
        tipoMovimento,
        vasilhameId,
        vasilhameNome,
      });

    } catch (err: any) {
      console.error('❌ Erro ao criar produto:', err);
      onError(err?.message || 'Erro ao criar produto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nome */}
      <div>
        <label className="block text-xs font-black text-txt-muted uppercase tracking-wide mb-1">
          Nome do Produto *
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Gás P13, Água 20L, Refrigerante"
          className="w-full bg-app border border-bdr rounded-xl px-4 py-3 text-sm font-bold text-txt-main placeholder:text-txt-muted/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          autoFocus
        />
      </div>

      {/* Código e Unidade */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-txt-muted uppercase tracking-wide mb-1">
            Código/SKU
          </label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Opcional"
            className="w-full bg-app border border-bdr rounded-xl px-4 py-3 text-sm font-bold text-txt-main placeholder:text-txt-muted/50 focus:border-emerald-500 outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-black text-txt-muted uppercase tracking-wide mb-1">
            Unidade *
          </label>
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className="w-full bg-app border border-bdr rounded-xl px-4 py-3 text-sm font-bold text-txt-main focus:border-emerald-500 outline-none transition-all"
          >
            <option value="UN">UN (Unidade)</option>
            <option value="KG">KG (Quilograma)</option>
            <option value="LT">LT (Litro)</option>
            <option value="CX">CX (Caixa)</option>
            <option value="PCT">PCT (Pacote)</option>
          </select>
        </div>
      </div>

      {/* Tipo de Movimentação */}
      <div>
        <label className="block text-xs font-black text-txt-muted uppercase tracking-wide mb-2">
          Tipo de Movimentação *
        </label>
        <div className="grid gap-3">
          {MOVEMENT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = tipoMovimento === opt.id;
            
            return (
              <label
                key={opt.id}
                className={`relative flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? opt.color === 'blue' 
                      ? 'border-blue-500 bg-blue-50/50'
                      : opt.color === 'emerald'
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-amber-500 bg-amber-50/50'
                    : 'border-bdr bg-app hover:border-txt-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="tipoMovimento"
                  value={opt.id}
                  checked={isSelected}
                  onChange={() => setTipoMovimento(opt.id)}
                  className="sr-only"
                />
                
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  opt.color === 'blue' 
                    ? 'bg-blue-100 text-blue-600'
                    : opt.color === 'emerald'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-amber-100 text-amber-600'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                <div className="flex-1">
                  <p className="font-black text-txt-main">{opt.label}</p>
                  <p className="text-xs text-txt-muted mt-0.5">{opt.description}</p>
                </div>

                {isSelected && (
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                    opt.color === 'blue' 
                      ? 'bg-blue-500'
                      : opt.color === 'emerald'
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                  }`}>
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Info EXCHANGE */}
      {tipoMovimento === 'EXCHANGE' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-700">Vasilhame Automático</p>
            <p className="text-xs text-emerald-600 mt-1">
              Ao criar "{nome || 'este produto'}", o sistema criará automaticamente 
              o produto "<strong>Vasilhame {nome || '[Nome]'}</strong>" para controle do casco vazio.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-bdr">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-bold text-txt-muted border border-bdr rounded-xl hover:bg-app transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !nome.trim()}
          className="px-5 py-2.5 text-sm font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              Avançar
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
