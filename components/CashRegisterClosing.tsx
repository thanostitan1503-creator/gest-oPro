
import React, { useState, useEffect } from 'react';
import { 
  X, Printer, FileText, CheckSquare, Save, 
  Calendar, DollarSign, ArrowRight, Banknote,
  TrendingUp, AlertTriangle
} from 'lucide-react';
import { getOrders, getProducts } from '../src/domain/storage';
import { OrdemServico } from '../src/domain/types';

interface CashRegisterClosingProps {
  onClose: () => void;
}

export const CashRegisterClosing: React.FC<CashRegisterClosingProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'usuario' | 'produtos'>('geral');
  const [data, setData] = useState<any>(null);

  // Load Real Data for Today
  useEffect(() => {
    const orders = getOrders();
    const today = new Date().toISOString().split('T')[0];
    
    // Filter for today's concluded orders
    const dailyOrders = orders.filter(o => 
      o.status === 'CONCLUIDA' && 
      (o.dataHoraConclusao && new Date(o.dataHoraConclusao).toISOString().split('T')[0] === today)
    );

    // Totals
    const totalVendas = dailyOrders.reduce((acc, o) => acc + o.total, 0);
    const qtdVendas = dailyOrders.length;

    // Payment Breakdowns
    const payments = { dinheiro: 0, cartao: 0, pix: 0 };
    dailyOrders.forEach(o => {
      o.pagamentos.forEach(p => {
        // Simplified mapping, assuming method names or IDs
        // In real app, join with payment methods list
        if (p.formaPagamentoId.includes('dinheiro')) payments.dinheiro += p.valor;
        else if (p.formaPagamentoId.includes('pix')) payments.pix += p.valor;
        else payments.cartao += p.valor;
      });
    });

    // Products Stats
    const prodStats: Record<string, number> = {};
    dailyOrders.forEach(o => {
      o.itens.forEach(i => {
        prodStats[i.produtoId] = (prodStats[i.produtoId] || 0) + i.quantidade;
      });
    });
    const products = getProducts();
    const topProducts = Object.entries(prodStats).map(([pid, qty]) => {
      const p = products.find(p => p.id === pid);
      return { produto: p?.nome || pid, qtd: qty, vendas: 0 }; // Vendas count tricky without detail iter
    }).sort((a,b) => b.qtd - a.qtd);

    setData({
      sessao: {
        id: Date.now().toString().slice(-6),
        status: 'ABERTO',
        data_abertura: today,
        usuario: 'Usuário Atual', // Mock user for now
        deposito_nome: 'Todos'
      },
      totais: {
        total_vendas: totalVendas,
        qtd_vendas: qtdVendas,
        total_dinheiro_vendas: payments.dinheiro,
        total_cartao: payments.cartao,
        total_pix: payments.pix,
        total_suprimentos: 0, // Need 'CashMovements' table for this
        total_sangrias: 0,
        total_dinheiro_caixa: payments.dinheiro // Simple cash = cash sales
      },
      por_forma: [
        { forma_pagamento: 'Dinheiro', total: payments.dinheiro },
        { forma_pagamento: 'Pix', total: payments.pix },
        { forma_pagamento: 'Cartões', total: payments.cartao },
      ],
      por_usuario: [], // skipping for now
      produtos_vendidos: topProducts
    });

  }, []);

  const [conferencia, setConferencia] = useState({
    dinheiro: '',
    pix: '',
    cartao: ''
  });

  const handleConferenciaChange = (campo: string, valor: string) => {
    setConferencia(prev => ({ ...prev, [campo]: valor }));
  };

  const calcularDiferenca = (valorSistema: number, valorConferido: string) => {
    const conferido = parseFloat(valorConferido.replace(',', '.') || '0');
    return conferido - valorSistema;
  };

  if (!data) return <div className="p-10 text-center text-txt-muted">Carregando dados do caixa...</div>;

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300 transition-colors">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-3 shadow-sm shrink-0 z-20">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg shadow-sm">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-txt-main">Fechamento de Caixa</h2>
              <p className="text-xs text-txt-muted font-medium">
                Data: {data.sessao.data_abertura} • Visualização em Tempo Real
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-bdr text-txt-main hover:bg-app rounded-lg text-sm font-medium transition-colors shadow-sm">
              <Printer className="w-4 h-4 text-txt-muted" />
              Imprimir
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
              <CheckSquare className="w-4 h-4" />
              Fechar Caixa
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-red-50 text-txt-muted hover:text-red-500 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mt-6 border-b border-bdr overflow-x-auto">
          {[
            { id: 'geral', label: '📊 Visão Geral' },
            { id: 'produtos', label: '🛒 Produtos e Serviços Vendidos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-emerald-600 font-bold' 
                  : 'text-txt-muted hover:text-txt-main'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-app p-6 transition-colors">
        <div className="max-w-[1600px] mx-auto space-y-6">

          {/* TAB: GERAL */}
          {activeTab === 'geral' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Cards de Totais */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface p-5 rounded-xl shadow-sm border border-bdr relative overflow-hidden transition-colors">
                   <p className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-1">Total de Vendas (Hoje)</p>
                   <p className="text-2xl font-bold text-txt-main">R$ {data.totais.total_vendas.toFixed(2)}</p>
                   <p className="text-xs text-txt-muted mt-1">{data.totais.qtd_vendas} pedidos concluídos</p>
                   <div className="absolute top-0 right-0 p-3 opacity-5 bg-blue-500 rounded-bl-3xl">
                      <DollarSign className="w-8 h-8 text-blue-700" />
                   </div>
                </div>

                <div className="bg-surface p-5 rounded-xl shadow-sm border border-bdr relative overflow-hidden transition-colors">
                   <p className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-1">Dinheiro em Caixa (Estimado)</p>
                   <p className="text-2xl font-bold text-emerald-600">R$ {data.totais.total_dinheiro_caixa.toFixed(2)}</p>
                   <p className="text-xs text-txt-muted mt-1">Vendas em Espécie</p>
                   <div className="absolute top-0 right-0 p-3 opacity-5 bg-emerald-500 rounded-bl-3xl">
                      <Banknote className="w-8 h-8 text-emerald-700" />
                   </div>
                </div>
              </div>

              {/* Área de Conferência (Input do Usuário) */}
              <div className="bg-surface rounded-xl shadow-sm border border-bdr overflow-hidden transition-colors">
                <div className="px-6 py-4 border-b border-bdr bg-app/50 flex items-center justify-between">
                  <h3 className="font-bold text-txt-main text-sm uppercase tracking-wide flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    Conferência de Valores (Cego)
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                    <AlertTriangle className="w-3 h-3" />
                    Informe os valores contados fisicamente
                  </div>
                </div>
                
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Dinheiro */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-txt-main">Dinheiro Físico</label>
                      <span className="text-xs text-txt-muted">Sistema: R$ {data.totais.total_dinheiro_caixa.toFixed(2)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-txt-muted font-medium">R$</span>
                      <input 
                        type="number" 
                        value={conferencia.dinheiro}
                        onChange={(e) => handleConferenciaChange('dinheiro', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-app border border-bdr rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-txt-main"
                        placeholder="0.00"
                      />
                    </div>
                    {conferencia.dinheiro && (
                      <div className={`text-xs font-bold text-right ${calcularDiferenca(data.totais.total_dinheiro_caixa, conferencia.dinheiro) === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        Diferença: R$ {calcularDiferenca(data.totais.total_dinheiro_caixa, conferencia.dinheiro).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Cartão (Soma) */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-txt-main">Cartões (POS)</label>
                      <span className="text-xs text-txt-muted">Sistema: R$ {(data.totais.total_cartao).toFixed(2)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-txt-muted font-medium">R$</span>
                      <input 
                        type="number" 
                        value={conferencia.cartao}
                        onChange={(e) => handleConferenciaChange('cartao', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-app border border-bdr rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-txt-main"
                        placeholder="0.00"
                      />
                    </div>
                    {conferencia.cartao && (
                      <div className={`text-xs font-bold text-right ${calcularDiferenca(data.totais.total_cartao, conferencia.cartao) === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        Diferença: R$ {calcularDiferenca(data.totais.total_cartao, conferencia.cartao).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* PIX */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-txt-main">PIX (Banco)</label>
                      <span className="text-xs text-txt-muted">Sistema: R$ {data.totais.total_pix.toFixed(2)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-txt-muted font-medium">R$</span>
                      <input 
                        type="number" 
                        value={conferencia.pix}
                        onChange={(e) => handleConferenciaChange('pix', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-app border border-bdr rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-txt-main"
                        placeholder="0.00"
                      />
                    </div>
                    {conferencia.pix && (
                      <div className={`text-xs font-bold text-right ${calcularDiferenca(data.totais.total_pix, conferencia.pix) === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        Diferença: R$ {calcularDiferenca(data.totais.total_pix, conferencia.pix).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Detalhe por Forma de Pagamento */}
              <div className="bg-surface rounded-xl shadow-sm border border-bdr overflow-hidden transition-colors">
                <div className="px-6 py-4 border-b border-bdr bg-app/50">
                  <h3 className="font-bold text-txt-main text-sm uppercase tracking-wide">Detalhamento por Forma de Pagamento</h3>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface text-xs text-txt-muted uppercase font-bold border-b border-bdr">
                    <tr>
                      <th className="px-6 py-3">Forma</th>
                      <th className="px-6 py-3 text-right">Valor Total</th>
                      <th className="px-6 py-3 text-right">Participação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bdr">
                    {data.por_forma.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-app transition-colors">
                        <td className="px-6 py-3 font-medium text-txt-main">{item.forma_pagamento}</td>
                        <td className="px-6 py-3 text-right font-bold text-txt-main">R$ {item.total.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right text-txt-muted">
                          {data.totais.total_vendas > 0 
                            ? ((item.total / data.totais.total_vendas) * 100).toFixed(1) 
                            : '0.0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB: PRODUTOS */}
          {activeTab === 'produtos' && (
            <div className="bg-surface rounded-xl shadow-sm border border-bdr overflow-hidden animate-in fade-in transition-colors">
              <table className="w-full text-sm text-left">
                <thead className="bg-app text-xs text-txt-muted uppercase font-bold border-b border-bdr">
                  <tr>
                    <th className="px-6 py-4">Produto</th>
                    <th className="px-6 py-4 text-center">Qtd. Total Saída</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr">
                  {data.produtos_vendidos.length === 0 ? (
                     <tr><td colSpan={2} className="p-8 text-center text-txt-muted">Nenhum produto vendido hoje.</td></tr>
                  ) : (
                    data.produtos_vendidos.map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-app transition-colors">
                        <td className="px-6 py-4 font-medium text-txt-main">{p.produto}</td>
                        <td className="px-6 py-4 text-center font-bold text-txt-main">{p.qtd}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
