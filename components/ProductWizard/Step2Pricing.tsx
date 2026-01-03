/**
 * 💰 PASSO 2: PRECIFICAÇÃO E ESTOQUE
 * 
 * Campos:
 * - Preço de Custo
 * - Preço de Venda
 * - Estoque Inicial
 * 
 * Aqui vinculamos o produto ao depósito via zone_pricing e stock_balance
 */

import React, { useState } from 'react';
import { DollarSign, Package, ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { db, generateId } from '../../src/domain/db';
import { MovimentoEstoque } from '../../src/domain/types';
import { CreatedProductInfo } from './index';

interface Step2Props {
  product: CreatedProductInfo;
  depositoId: string;
  depositoNome: string;
  onSuccess: () => void;
  onBack: () => void;
  onError: (msg: string) => void;
}

export const Step2Pricing: React.FC<Step2Props> = ({
  product,
  depositoId,
  depositoNome,
  onSuccess,
  onBack,
  onError,
}) => {
  const [precoCusto, setPrecoCusto] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [estoqueInicial, setEstoqueInicial] = useState('0');
  const [estoqueVasilhame, setEstoqueVasilhame] = useState('0');
  const [saving, setSaving] = useState(false);

  const custoNum = parseFloat(precoCusto) || 0;
  const vendaNum = parseFloat(precoVenda) || 0;
  const estoqueNum = parseInt(estoqueInicial) || 0;
  const estoqueVazioNum = parseInt(estoqueVasilhame) || 0;
  
  const margem = custoNum > 0 ? ((vendaNum - custoNum) / custoNum) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (vendaNum <= 0) {
      onError('Informe o preço de venda');
      return;
    }

    if (vendaNum < custoNum) {
      const confirma = window.confirm(
        `O preço de venda (R$ ${vendaNum.toFixed(2)}) é menor que o custo (R$ ${custoNum.toFixed(2)}). Deseja continuar?`
      );
      if (!confirma) return;
    }

    setSaving(true);

    try {
      const nowIso = new Date().toISOString();

      // 1. Atualizar produto com preços
      await db.products.update(product.id, {
        preco_custo: custoNum,
        preco_venda: vendaNum,
        updated_at: nowIso,
      });
      console.log('✅ Produto atualizado com preços');

      // 2. Criar pricing por depósito
      const pricingId = `${product.id}:${depositoId}`;
      await db.zone_pricing.put({
        id: pricingId,
        productId: product.id,
        depositoId: depositoId,
        price: vendaNum,
        created_at: nowIso,
        updated_at: nowIso,
      });
      console.log('✅ Pricing criado para depósito:', depositoId);

      // 3. Criar estoque inicial via movimento (se > 0)
      if (estoqueNum > 0) {
        const movimento: MovimentoEstoque = {
          id: generateId(),
          dataHora: nowIso,
          depositoId: depositoId,
          produtoId: product.id,
          produtoNome: product.nome,
          tipo: 'ENTRADA',
          quantidade: estoqueNum,
          origem: 'AJUSTE_MANUAL',
          usuarioId: 'sistema',
          usuarioNome: 'Sistema',
          motivo: 'Estoque inicial (cadastro)',
        };
        await db.stock_movements.put(movimento);

        // Atualizar stock_balance
        const balanceId = `${depositoId}:${product.id}`;
        await db.stock_balance.put({
          id: balanceId,
          deposit_id: depositoId,
          product_id: product.id,
          quantidade_atual: estoqueNum,
        });
        console.log('✅ Estoque inicial criado:', estoqueNum);
      }

      // 4. Se tem vasilhame, criar pricing e estoque para ele também
      if (product.vasilhameId && product.tipoMovimento === 'EXCHANGE') {
        // Pricing do vasilhame (preço 0 por padrão)
        const vasilhamePricingId = `${product.vasilhameId}:${depositoId}`;
        await db.zone_pricing.put({
          id: vasilhamePricingId,
          productId: product.vasilhameId,
          depositoId: depositoId,
          price: 0,
          created_at: nowIso,
          updated_at: nowIso,
        });
        console.log('✅ Pricing do vasilhame criado');

        // Estoque inicial do vasilhame (se informado)
        if (estoqueVazioNum > 0) {
          const movimentoVazio: MovimentoEstoque = {
            id: generateId(),
            dataHora: nowIso,
            depositoId: depositoId,
            produtoId: product.vasilhameId,
            produtoNome: product.vasilhameNome || 'Vasilhame',
            tipo: 'ENTRADA',
            quantidade: estoqueVazioNum,
            origem: 'AJUSTE_MANUAL',
            usuarioId: 'sistema',
            usuarioNome: 'Sistema',
            motivo: 'Estoque inicial vasilhame (cadastro)',
          };
          await db.stock_movements.put(movimentoVazio);

          const vasilhameBalanceId = `${depositoId}:${product.vasilhameId}`;
          await db.stock_balance.put({
            id: vasilhameBalanceId,
            deposit_id: depositoId,
            product_id: product.vasilhameId,
            quantidade_atual: estoqueVazioNum,
          });
          console.log('✅ Estoque inicial do vasilhame criado:', estoqueVazioNum);
        }
      }

      // Sucesso!
      onSuccess();

    } catch (err: any) {
      console.error('❌ Erro ao salvar preço/estoque:', err);
      onError(err?.message || 'Erro ao salvar preço e estoque');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Info do Produto */}
      <div className="p-4 bg-app rounded-xl border border-bdr">
        <p className="text-xs font-black text-txt-muted uppercase tracking-wide mb-1">Produto Criado</p>
        <p className="text-lg font-black text-txt-main">{product.nome}</p>
        {product.vasilhameNome && (
          <p className="text-xs text-emerald-600 font-bold mt-1">
            + Vasilhame: {product.vasilhameNome}
          </p>
        )}
      </div>

      {/* Preços */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-txt-muted uppercase tracking-wide mb-1">
            Preço de Custo
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted font-bold">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={precoCusto}
              onChange={(e) => setPrecoCusto(e.target.value)}
              placeholder="0,00"
              className="w-full bg-app border border-bdr rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-txt-main placeholder:text-txt-muted/50 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-black text-txt-muted uppercase tracking-wide mb-1">
            Preço de Venda *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted font-bold">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={precoVenda}
              onChange={(e) => setPrecoVenda(e.target.value)}
              placeholder="0,00"
              className="w-full bg-app border border-bdr rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-txt-main placeholder:text-txt-muted/50 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Margem */}
      {custoNum > 0 && vendaNum > 0 && (
        <div className={`p-3 rounded-xl border ${
          margem >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm font-black ${margem >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            Margem: {margem >= 0 ? '+' : ''}{margem.toFixed(1)}%
          </p>
          <p className={`text-xs ${margem >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            Lucro por unidade: R$ {(vendaNum - custoNum).toFixed(2)}
          </p>
        </div>
      )}

      {/* Estoque Inicial */}
      <div className={`grid ${product.vasilhameId ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
        <div>
          <label className="block text-xs font-black text-txt-muted uppercase tracking-wide mb-1">
            Estoque Inicial {product.nome}
          </label>
          <input
            type="number"
            min="0"
            value={estoqueInicial}
            onChange={(e) => setEstoqueInicial(e.target.value)}
            className="w-full bg-app border border-bdr rounded-xl px-4 py-3 text-sm font-bold text-txt-main placeholder:text-txt-muted/50 focus:border-emerald-500 outline-none transition-all"
          />
        </div>

        {/* Estoque Vasilhame (se EXCHANGE) */}
        {product.vasilhameId && (
          <div>
            <label className="block text-xs font-black text-txt-muted uppercase tracking-wide mb-1">
              Estoque Inicial Vasilhame
            </label>
            <input
              type="number"
              min="0"
              value={estoqueVasilhame}
              onChange={(e) => setEstoqueVasilhame(e.target.value)}
              className="w-full bg-app border border-bdr rounded-xl px-4 py-3 text-sm font-bold text-txt-main placeholder:text-txt-muted/50 focus:border-amber-500 outline-none transition-all"
            />
            <p className="text-xs text-txt-muted mt-1">Cascos vazios em estoque</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-4 border-t border-bdr">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-bold text-txt-muted border border-bdr rounded-xl hover:bg-app transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <button
          type="submit"
          disabled={saving || vendaNum <= 0}
          className="px-5 py-2.5 text-sm font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Finalizar Cadastro
            </>
          )}
        </button>
      </div>
    </form>
  );
};
