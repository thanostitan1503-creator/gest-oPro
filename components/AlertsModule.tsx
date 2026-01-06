
import React, { useState, useEffect } from 'react';
import { 
  X, Siren, BellRing, Settings, Package, 
  TrendingDown, CalendarClock, ShieldAlert,
  CheckCircle2, AlertTriangle, AlertOctagon,
  Save, Search, Eye
} from 'lucide-react';
import { scanSystemForAlerts } from '@/domain/alert.logic';
import { getAlertsConfig, saveAlertsConfig } from '@/domain/storage';
import { listProducts } from '@/domain/repositories/index';
import { SystemAlert, AlertConfig, Produto } from '@/domain/types';

const isDeliveryFeeProduct = (product: any) => {
  const flag = product?.is_delivery_fee ?? product?.isDeliveryFee;
  if (flag === true) return true;
  const group = String(product?.product_group ?? product?.codigo ?? '').toLowerCase();
  if (group === 'delivery_fee') return true;
  const name = String(product?.nome ?? '').toLowerCase();
  return name === 'taxa de entrega';
};

const isServiceProduct = (product: any) => {
  if (isDeliveryFeeProduct(product)) return true;
  const track = product?.track_stock ?? product?.trackStock;
  if (track === false) return true;
  return product?.type === 'SERVICE';
};

interface AlertsModuleProps {
  onClose: () => void;
}

export const AlertsModule: React.FC<AlertsModuleProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'config-stock' | 'config-fin'>('monitor');
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [config, setConfig] = useState<AlertConfig>({
    minStock: {},
    financialDaysNotice: 3,
    minMarginPercent: 15,
    enabledStock: true,
    enabledFinancial: true,
    enabledMargin: true
  });
  
  const [products, setProducts] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Load Data
  useEffect(() => {
      let alive = true;
      (async () => {
         const [alertsNow, productsNow] = await Promise.all([scanSystemForAlerts(), listProducts()]);
         if (!alive) return;
         setAlerts(alertsNow);
         setConfig(getAlertsConfig());
         setProducts(productsNow);
      })();

      return () => {
         alive = false;
      };
  }, []);

   const refreshAlerts = () => {
      (async () => {
         const alertsNow = await scanSystemForAlerts();
         setAlerts(alertsNow);
      })();
   };

  const handleSaveConfig = () => {
    saveAlertsConfig(config);
    refreshAlerts(); // Re-scan with new rules
    alert('Configurações de alerta salvas e aplicadas!');
  };

  const toggleAlertCategory = (category: 'enabledStock' | 'enabledFinancial' | 'enabledMargin') => {
    const newConfig = { ...config, [category]: !config[category] };
    setConfig(newConfig);
    saveAlertsConfig(newConfig);
    setTimeout(refreshAlerts, 100);
  };

  const handleMinStockChange = (prodId: string, val: string) => {
    const num = parseInt(val);
    setConfig(prev => ({
      ...prev,
      minStock: {
        ...prev.minStock,
        [prodId]: isNaN(num) ? 0 : num
      }
    }));
  };

  // Filter products for config table
  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) && 
    p.tipo !== 'OUTROS' &&
    !isServiceProduct(p)
  );

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
            <Siren className="w-6 h-6 text-red-600 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Central de Alertas</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Monitoramento Inteligente</p>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="p-2 hover:bg-red-500/10 text-txt-muted hover:text-red-500 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Navigation */}
        <div className="w-72 bg-surface border-r border-bdr flex flex-col p-4 gap-2">
           <button 
             onClick={() => setActiveTab('monitor')}
             className={`p-4 rounded-xl flex items-center gap-3 transition-all text-left ${activeTab === 'monitor' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'hover:bg-app text-txt-muted'}`}
           >
              <ShieldAlert className="w-5 h-5" />
              <div>
                 <span className="block text-sm font-black uppercase">Monitoramento</span>
                 <span className={`text-[10px] font-bold ${activeTab === 'monitor' ? 'text-red-100' : 'text-txt-muted'}`}>{alerts.length} alertas ativos</span>
              </div>
           </button>

           <div className="h-px bg-bdr my-2" />
           <p className="px-2 text-[10px] font-black text-txt-muted uppercase tracking-widest mb-1">Configuração</p>

           <button 
             onClick={() => setActiveTab('config-stock')}
             className={`p-3 rounded-xl flex items-center gap-3 transition-all text-left ${activeTab === 'config-stock' ? 'bg-app border-2 border-primary text-txt-main' : 'hover:bg-app border-2 border-transparent text-txt-muted'}`}
           >
              <Package className="w-4 h-4" />
              <span className="text-sm font-bold">Estoque Mínimo</span>
           </button>

           <button 
             onClick={() => setActiveTab('config-fin')}
             className={`p-3 rounded-xl flex items-center gap-3 transition-all text-left ${activeTab === 'config-fin' ? 'bg-app border-2 border-primary text-txt-main' : 'hover:bg-app border-2 border-transparent text-txt-muted'}`}
           >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-bold">Regras Gerais</span>
           </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-app p-8">
           
           {/* TAB: MONITOR */}
           {activeTab === 'monitor' && (
             <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Status Banner */}
                <div className={`p-6 rounded-2xl border-2 flex items-center gap-6 shadow-sm ${alerts.length > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                   <div className={`p-4 rounded-full ${alerts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {alerts.length > 0 ? <AlertOctagon className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
                   </div>
                   <div>
                      <h3 className={`text-2xl font-black ${alerts.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                         {alerts.length > 0 ? 'Atenção Necessária' : 'Sistema Estável'}
                      </h3>
                      <p className="text-sm font-bold opacity-70 text-txt-main">
                         {alerts.length > 0 
                           ? `Foram detectados ${alerts.length} pontos de atenção que requerem sua intervenção.` 
                           : 'Todos os indicadores operacionais estão dentro dos conformes.'}
                      </p>
                   </div>
                </div>

                {/* Alerts List */}
                <div className="space-y-4">
                   {alerts.map(alert => (
                      <div key={alert.id} className="bg-surface p-5 rounded-xl border border-bdr shadow-sm hover:shadow-md transition-shadow flex items-start gap-4 group">
                         <div className={`mt-1 p-2 rounded-lg shrink-0 ${alert.severity === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-amber-100 text-amber-600'}`}>
                            {alert.type === 'STOCK' && <Package className="w-5 h-5" />}
                            {alert.type === 'FINANCIAL' && <CalendarClock className="w-5 h-5" />}
                            {alert.type === 'MARGIN' && <TrendingDown className="w-5 h-5" />}
                         </div>
                         <div className="flex-1">
                            <div className="flex justify-between items-start">
                               <h4 className="text-sm font-black text-txt-main uppercase tracking-wide">{alert.title}</h4>
                               <span className={`text-[10px] font-black px-2 py-1 rounded border uppercase ${alert.severity === 'CRITICAL' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  {alert.severity === 'CRITICAL' ? 'Crítico' : 'Aviso'}
                               </span>
                            </div>
                            <p className="text-sm text-txt-muted mt-1 font-medium">{alert.message}</p>
                            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-primary">
                               <span className="bg-app px-2 py-1 rounded border border-bdr text-txt-muted uppercase">{alert.location}</span>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           )}

           {/* TAB: CONFIG STOCK */}
           {activeTab === 'config-stock' && (
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-surface p-6 rounded-2xl border border-bdr shadow-sm flex items-center justify-between">
                   <div>
                      <h3 className="text-lg font-black text-txt-main">Alertas de Estoque Mínimo</h3>
                      <p className="text-xs text-txt-muted font-bold">Defina a quantidade mínima para disparar avisos</p>
                   </div>
                   <div className="flex items-center gap-3">
                      <span className="text-xs font-bold uppercase text-txt-muted">{config.enabledStock ? 'Ativado' : 'Desativado'}</span>
                      <button 
                        onClick={() => toggleAlertCategory('enabledStock')}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${config.enabledStock ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      >
                         <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${config.enabledStock ? 'translate-x-6' : ''}`} />
                      </button>
                   </div>
                </div>

                <div className="bg-surface rounded-2xl border border-bdr overflow-hidden shadow-sm">
                   <div className="p-4 border-b border-bdr flex gap-4">
                      <Search className="w-5 h-5 text-txt-muted" />
                      <input 
                        type="text" 
                        placeholder="Filtrar produtos..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm font-bold text-txt-main"
                      />
                   </div>
                   <table className="w-full text-left text-sm">
                      <thead className="bg-app text-[10px] font-black text-txt-muted uppercase tracking-widest">
                         <tr>
                            <th className="px-6 py-4">Produto</th>
                            <th className="px-6 py-4 w-40 text-center">Estoque Mínimo</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-bdr">
                         {filteredProducts.map(p => (
                            <tr key={p.id} className="hover:bg-app transition-colors">
                               <td className="px-6 py-4 font-bold text-txt-main">{p.nome}</td>
                               <td className="px-6 py-4 text-center">
                                  <input 
                                    type="number" 
                                    value={config.minStock[p.id] || 0}
                                    onChange={e => handleMinStockChange(p.id, e.target.value)}
                                    className="w-20 text-center bg-app border border-bdr rounded-lg p-2 font-bold text-txt-main focus:ring-2 focus:ring-primary outline-none"
                                  />
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>

                <div className="flex justify-end">
                   <button onClick={handleSaveConfig} className="bg-primary text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-transform">
                      <Save className="w-5 h-5" /> SALVAR ALTERAÇÕES
                   </button>
                </div>
             </div>
           )}

           {/* TAB: CONFIG FIN/MARGIN */}
           {activeTab === 'config-fin' && (
             <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Financeiro */}
                <div className="bg-surface p-8 rounded-2xl border border-bdr shadow-sm space-y-6">
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-lg font-black text-txt-main flex items-center gap-2"><CalendarClock className="w-5 h-5 text-blue-500" /> Alertas Financeiros</h3>
                         <p className="text-xs text-txt-muted font-bold mt-1">Avisos sobre contas a pagar e receber</p>
                      </div>
                      <button 
                        onClick={() => toggleAlertCategory('enabledFinancial')}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${config.enabledFinancial ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      >
                         <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${config.enabledFinancial ? 'translate-x-6' : ''}`} />
                      </button>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-100 transition-opacity">
                      <div className={`space-y-2 ${!config.enabledFinancial && 'opacity-50 pointer-events-none'}`}>
                         <label className="text-xs font-black text-txt-muted uppercase">Antecedência do Aviso (Dias)</label>
                         <input 
                           type="number" 
                           value={config.financialDaysNotice}
                           onChange={e => setConfig({...config, financialDaysNotice: parseInt(e.target.value)})}
                           className="w-full bg-app border border-bdr rounded-xl p-3 font-bold text-txt-main outline-none focus:ring-2 focus:ring-blue-500"
                         />
                         <p className="text-[10px] text-txt-muted">Dias antes do vencimento para começar a alertar.</p>
                      </div>
                   </div>
                </div>

                {/* Margem */}
                <div className="bg-surface p-8 rounded-2xl border border-bdr shadow-sm space-y-6">
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-lg font-black text-txt-main flex items-center gap-2"><TrendingDown className="w-5 h-5 text-amber-500" /> Proteção de Margem</h3>
                         <p className="text-xs text-txt-muted font-bold mt-1">Alerta se o preço de venda estiver próximo do custo</p>
                      </div>
                      <button 
                        onClick={() => toggleAlertCategory('enabledMargin')}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${config.enabledMargin ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      >
                         <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${config.enabledMargin ? 'translate-x-6' : ''}`} />
                      </button>
                   </div>
                   
                   <div className={`space-y-2 ${!config.enabledMargin && 'opacity-50 pointer-events-none'}`}>
                      <label className="text-xs font-black text-txt-muted uppercase">Margem de Lucro Mínima (%)</label>
                      <div className="relative">
                         <input 
                           type="number" 
                           value={config.minMarginPercent}
                           onChange={e => setConfig({...config, minMarginPercent: parseFloat(e.target.value)})}
                           className="w-full bg-app border border-bdr rounded-xl p-3 font-bold text-txt-main outline-none focus:ring-2 focus:ring-amber-500"
                         />
                         <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-txt-muted">%</span>
                      </div>
                      <p className="text-[10px] text-txt-muted">Se a margem (Markup) cair abaixo deste valor, um alerta será gerado.</p>
                   </div>
                </div>

                <div className="flex justify-end pt-4">
                   <button onClick={handleSaveConfig} className="bg-primary text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-transform">
                      <Save className="w-5 h-5" /> SALVAR TODAS REGRAS
                   </button>
                </div>
             </div>
           )}

        </div>
      </div>
    </div>
  );
};



