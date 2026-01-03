
import React, { useState, useEffect } from 'react';
import { X, FileClock, Search, Filter, Calendar, AlertCircle } from 'lucide-react';
import { MovimentoEstoque } from '../domain/types';
import { supabase } from '../domain/supabaseClient';
import { GlobalStatsDashboard } from '../src/components/Audit/GlobalStatsDashboard';
import { normalizeDepositId } from '../src/domain_old/utils/dataSanitizer';

interface AuditModuleProps {
  onClose: () => void;
}

export const AuditModule: React.FC<AuditModuleProps> = ({ onClose }) => {
  const [movements, setMovements] = useState<MovimentoEstoque[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const parseMs = (value: any) => {
      if (!value) return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !Number.isNaN(Number(trimmed))) return Number(trimmed);
      }
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const normalizeMovement = (row: any): MovimentoEstoque => {
      const dataHora =
        row.data_hora ??
        row.dataHora ??
        row.created_at ??
        row.createdAt ??
        new Date().toISOString();
      const normalized = normalizeDepositId(row);
      return {
        id: String(row.id ?? ''),
        dataHora,
        depositoId: normalized.depositoId ?? '',
        produtoId:
          row.produto_id ??
          row.produtoId ??
          row.product_id ??
          row.productId ??
          '',
        produtoNome:
          row.produto_nome ??
          row.produtoNome ??
          row.product_name ??
          row.productName ??
          '',
        tipo: row.tipo ?? row.type ?? 'AJUSTE',
        quantidade: Number(row.quantidade ?? row.qty ?? row.quantity ?? 0) || 0,
        origem: row.origem ?? row.source ?? '',
        referenciaId:
          row.referencia_id ??
          row.referenciaId ??
          row.reference_id ??
          row.referenceId ??
          null,
        usuarioId:
          row.usuario_id ??
          row.usuarioId ??
          row.user_id ??
          row.userId ??
          'SISTEMA',
        usuarioNome:
          row.usuario_nome ??
          row.usuarioNome ??
          row.user_name ??
          row.userName ??
          row.usuario ??
          'Sistema',
        motivo: row.motivo ?? row.reason ?? '',
      } as MovimentoEstoque;
    };
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.from('stock_movements').select('*');
        if (error) throw error;
        const now = Date.now();
        const limitMs = now - 30 * 24 * 60 * 60 * 1000;
        const normalized = (data ?? [])
          .map(normalizeMovement)
          .filter((m) => {
            const ms = parseMs((m as any).dataHora);
            return ms >= limitMs && ms <= now;
          })
          .sort((a, b) => parseMs((b as any).dataHora) - parseMs((a as any).dataHora));
        if (!alive) return;
        setMovements(normalized);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || 'Falha ao carregar auditoria.');
        setMovements([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const term = searchTerm.toLowerCase();
  const filteredMovements = movements.filter(m => {
    const produtoNome = String(m.produtoNome ?? '').toLowerCase();
    const usuarioNome = String(m.usuarioNome ?? '').toLowerCase();
    const tipo = String(m.tipo ?? '').toLowerCase();
    const motivo = String(m.motivo ?? '').toLowerCase();
    return (
      produtoNome.includes(term) ||
      usuarioNome.includes(term) ||
      tipo.includes(term) ||
      motivo.includes(term)
    );
  });

  return (
    <div className="fixed inset-0 bg-app z-[60] flex flex-col animate-in slide-in-from-bottom-4 duration-300 transition-colors">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0 transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500/10 p-2.5 rounded-xl border border-orange-500/20">
            <FileClock className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Auditoria e Logs</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Rastreabilidade total de operações</p>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="p-2 hover:bg-red-500/10 text-txt-muted hover:text-red-500 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-app px-6 py-4 flex flex-col md:flex-row gap-4 items-center shrink-0 border-b border-bdr transition-colors">
         <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
            <input 
              type="text" 
              placeholder="Buscar por produto, usuário ou motivo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-bdr rounded-xl text-sm font-bold text-txt-main focus:ring-2 focus:ring-orange-500 outline-none shadow-sm transition-colors"
            />
         </div>
         
         <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-bdr rounded-xl text-sm font-bold text-txt-muted shadow-sm transition-colors">
            <Calendar className="w-4 h-4" />
            <span>Últimos 30 dias</span>
         </div>
         
         <div className="flex-1 text-right text-xs font-bold text-txt-muted uppercase tracking-wider">
            {loading && <span className="text-txt-muted">Carregando...</span>}
            {!loading && error && <span className="text-red-500">{error}</span>}
            {!loading && !error && (
              <span>
                Total de registros: <span className="text-txt-main">{filteredMovements.length}</span>
              </span>
            )}
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-app transition-colors">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <GlobalStatsDashboard />
          <div className="bg-surface rounded-2xl shadow-sm border border-bdr overflow-hidden transition-colors">
          <table className="w-full text-left text-sm">
            <thead className="bg-app text-[10px] font-black text-txt-muted uppercase tracking-widest border-b border-bdr transition-colors">
              <tr>
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Tipo de Ação</th>
                <th className="px-6 py-4">Depósito / Origem</th>
                <th className="px-6 py-4">Item Afetado</th>
                <th className="px-6 py-4 text-right">Qtd.</th>
                <th className="px-6 py-4">Detalhes / Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr transition-colors">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-txt-muted opacity-50">
                    <div className="flex flex-col items-center gap-3">
                       <AlertCircle className="w-10 h-10" />
                       <p className="font-bold text-sm">Nenhum registro de auditoria encontrado.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-app transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-txt-muted">
                      {new Date(mov.dataHora).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                       <span className="font-black text-txt-main text-xs bg-app px-2 py-1 rounded border border-bdr">{mov.usuarioNome}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${
                        mov.tipo.includes('ENTRADA') ? 'bg-green-500/10 text-green-600 border-green-500/20' : 
                        mov.tipo.includes('SAIDA') ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                        'bg-blue-500/10 text-blue-600 border-blue-500/20'
                      }`}>
                        {mov.tipo.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-txt-muted text-xs font-bold uppercase tracking-wide">
                       {mov.depositoId}
                    </td>
                    <td className="px-6 py-4 font-bold text-txt-main">{mov.produtoNome}</td>
                    <td className={`px-6 py-4 text-right font-black ${mov.quantidade > 0 ? 'text-emerald-600' : 'text-txt-main'}`}>
                      {mov.quantidade > 0 ? '+' : ''}{mov.quantidade}
                    </td>
                    <td className="px-6 py-4 text-txt-muted text-xs font-medium italic truncate max-w-xs group-hover:text-txt-main transition-colors" title={mov.motivo}>
                      {mov.motivo || mov.origem}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  );
};
