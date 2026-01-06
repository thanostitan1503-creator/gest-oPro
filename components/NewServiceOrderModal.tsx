import React, { useState, useEffect, useMemo, useRef } from 'react';
// ⚠️ REMOVIDO v3.0: useLiveQuery (use useState + useEffect + Services)
import { X } from 'lucide-react';
import { generateId } from '@/utils/idGenerator';
// ⚠️ REMOVIDO v3.0: import { getEmployees } from '@/domain/storage';
// ⚠️ REMOVIDO v3.0: import { enqueueOutboxEvent } from '@/domain/sync/outbox';
// IMPORTANTE: Importando o componente que acabamos de criar
import { ServiceOrderItems } from './ServiceOrderItems'; 

const NewServiceOrderModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [dateTime, setDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState('Pendente');
  const [serviceType, setServiceType] = useState('Entrega');
  const [employeeId, setEmployeeId] = useState('');
  const [depositId, setDepositId] = useState('');
  const [zone, setZone] = useState('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [isNewClientMode, setIsNewClientMode] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    phone: '',
    address: '',
    cpf: '',
  });
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement | null>(null);

  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const [totalValue, setTotalValue] = useState(0);
  const [remainingValue, setRemainingValue] = useState(0);
  const [observations, setObservations] = useState('');

  // --- BUSCA INTELIGENTE DE ENTREGADORES ---
  const availableDrivers = useLiveQuery(
    async () => {
      const dbEmployees = await db.employees.filter((e: any) => (e.is_active ?? e.ativo) !== false).toArray();
      const storageEmployees = (getEmployees() || []).filter((e: any) => (e?.ativo ?? e?.is_active) !== false);
      
      // Remove duplicatas por ID
      const seen = new Set<string>();
      const allActive = [...dbEmployees, ...storageEmployees].filter((e: any) => {
        if (!e?.id || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      // Filtra cargos de entrega (Case Insensitive)
      return allActive.filter((e: any) => {
        const cargo = String(e.role ?? e.cargo ?? '').toUpperCase().trim();
        return cargo.includes('ENTREG') || cargo.includes('MOTOR');
      });
    },
    []
  ) || [];

  const availableDeposits = useLiveQuery(() => db.deposits.filter((d: any) => (d.is_active ?? d.ativo) !== false).toArray(), []) || [];

  // Pré-seleção inteligente se houver apenas 1 opção
  useEffect(() => {
    if ((!depositId || depositId === '') && availableDeposits.length === 1) {
      setDepositId(availableDeposits[0].id);
    }
    // Entregador não precisa pré-selecionar obrigatoriamente, mas se quiser pode descomentar:
    // if ((!employeeId || employeeId === '') && availableDrivers.length === 1) {
    //   setEmployeeId(availableDrivers[0].id);
    // }
  }, [availableDeposits]);

  // Carrega clientes
  useEffect(() => {
    let alive = true;
    (async () => {
      const clients = await db.clients.toArray();
      if (!alive) return;
      setClientSuggestions(clients);
    })();
    return () => { alive = false; };
  }, []);

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtro de Clientes na busca
  const filteredClientSuggestions = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!showClientSuggestions) return [];
    return clientSuggestions.filter((c) => {
      if (!query) return true;
      const nome = (c?.nome ?? c?.name ?? '').toLowerCase();
      const telefone = c?.telefone ?? c?.phone ?? '';
      const endereco = (c?.endereco ?? c?.address ?? '').toLowerCase();
      return nome.includes(query) || telefone.includes(query) || endereco.includes(query);
    });
  }, [clientSuggestions, customerSearch, showClientSuggestions]);

  // Seleciona cliente ao clicar na busca
  const selectClient = (c: any) => {
    setCustomer({
        id: c.id,
        name: c.nome ?? c.name ?? '',
        phone: c.telefone ?? c.phone ?? '',
        address: c.endereco ?? c.address ?? '',
        cpf: c.cpf ?? '',
    });
    setCustomerSearch(c.nome ?? c.name ?? '');
    setShowClientSuggestions(false);
  };

  const handleAddPayment = () => {
    const newPayment = { id: generateId(), method: '', value: 0, installments: 1, dueDate: '', machine: '', observation: '' };
    setPayments([...payments, newPayment]);
  };

  // Cálculos de Totais
  useEffect(() => {
    const total = orderItems.reduce((sum, item) => sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0), 0);
    const paymentsTotal = payments.reduce((sum, payment) => sum + (Number(payment.value) || 0), 0);
    setTotalValue(total);
    setRemainingValue(total - paymentsTotal);
  }, [orderItems, payments]);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveOrder = async () => {
    let selectedClient = customer;
    
    // Validações Básicas
    if (orderItems.length === 0) {
      alert('Adicione pelo menos um produto!');
      return;
    }
    if (!depositId) {
        alert('Selecione um Depósito!');
        return;
    }

    const now = Date.now();
    const osId = generateId();

    // Lógica de Novo Cliente (Inline)
    if (isNewClientMode) {
      if (!newClientData.name.trim()) {
        alert('Nome do Cliente é obrigatório!');
        return;
      }
      const clientId = generateId();
      const newClient = {
        id: clientId,
        nome: newClientData.name.trim(),
        name: newClientData.name.trim(), // Duplicado para segurança
        telefone: newClientData.phone.trim(),
        phone: newClientData.phone.trim(),
        endereco: newClientData.address.trim(),
        address: newClientData.address.trim(),
        cpf: newClientData.cpf,
        ativo: true,
        criado_em: now,
        atualizado_em: now,
        deposit_id: null // CLiente Global
      };
      
      await db.clients.add(newClient as any);
      await enqueueOutboxEvent({ entity: 'clients', action: 'UPSERT', entity_id: clientId, payload_json: newClient });
      selectedClient = newClient;
    }

    if (!selectedClient || !selectedClient.id) {
      alert('Selecione um cliente!');
      return;
    }

    // Montagem da O.S.
    const itens = orderItems.map((item) => ({
      id: item.id || generateId(),
      produtoId: item.product_id,
      quantidade: Number(item.quantity),
      precoUnitario: Number(item.unit_price),
      modalidade: 'VENDA',
      total: Number(item.total)
    }));

    const pagamentos = payments.map((p) => ({
      formaPagamentoId: p.methodId ?? p.method ?? '',
      valor: Number(p.value)
    }));

    const serviceOrder = {
      id: osId,
      numeroOs: now.toString().slice(-6),
      depositoId: depositId,
      clienteId: selectedClient.id,
      clienteNome: selectedClient.name || selectedClient.nome,
      enderecoEntrega: selectedClient.address || selectedClient.endereco,
      clienteTelefone: selectedClient.phone || selectedClient.telefone,
      status: status.toUpperCase(),
      tipoAtendimento: serviceType.toUpperCase(),
      entregadorId: employeeId || null, // Salva o ID do Tatu, não o nome
      observacoes: observations,
      itens,
      pagamentos,
      total: totalValue,
      dataHoraCriacao: now,
      updated_at: now,
    };

    // Transação de Salvamento
    await db.transaction('rw', [db.service_orders, db.service_order_items, db.products, db.stock_movements, db.receivables, db.outbox_events], async () => {
        
        // 1. Salva O.S
        await db.service_orders.put(serviceOrder as any);
        if (itens.length > 0) await db.service_order_items.bulkPut(itens.map(i => ({ ...i, osId })));

        // 2. Baixa de Estoque
        for (const item of itens) {
            const product = await db.products.get(item.produtoId);
            if (product) {
                const movement = {
                    id: generateId(),
                    dataHora: new Date().toISOString(),
                    depositoId: serviceOrder.depositoId || currentDeposit?.id,
                    produtoId: item.produtoId || item.product_id || item.id,
                    produtoNome: product.nome, // Corrigido para 'nome'
                    tipo: 'SAIDA',
                    quantidade: item.quantidade,
                    origem: 'OS',
                    referenciaId: osId,
                    motivo: 'Venda'
                };
                console.log('Verificando IDs antes do insert:', {
                    produtoId: movement.produtoId,
                    depositoId: movement.depositoId
                });
                await db.stock_movements.put(movement as any);
                await enqueueOutboxEvent({ entity: 'stock_movements', action: 'UPSERT', entity_id: movement.id, payload_json: movement });
            }
        }

        // 3. Sincroniza O.S
        await enqueueOutboxEvent({ entity: 'service_orders', action: 'UPSERT', entity_id: osId, payload_json: serviceOrder });
    });

    alert('Pedido salvo com sucesso!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-[1200px] h-[90vh] bg-white rounded shadow-2xl border border-gray-300 flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="bg-gray-800 px-4 py-3 border-b border-gray-300 flex justify-between items-center text-white">
          <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-sm"></span>
            Nova Ordem de Serviço
          </h2>
          <button onClick={onClose} className="text-gray-200 hover:text-white p-1.5 rounded"><X size={18} /></button>
        </div>

        {/* BODY SCOLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#1e1e1e]">
          <div className="bg-white border border-gray-300 rounded-md shadow-sm p-3 space-y-4">
            
            {/* DADOS GERAIS */}
            <div className="border border-gray-300 rounded p-3 bg-[#f7f9fc]">
                <span className="text-xs font-bold text-blue-700 block mb-2">Dados Gerais</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Data/Hora:</label>
                    <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} className="w-full h-9 px-2 rounded border border-gray-300" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Status:</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-9 px-2 rounded border border-gray-300">
                      <option>Pendente</option>
                      <option>Em Andamento</option>
                      <option>Concluído</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Tipo:</label>
                    <select value={serviceType} onChange={e => setServiceType(e.target.value)} className="w-full h-9 px-2 rounded border border-gray-300">
                      <option value="DELIVERY">Delivery</option>
                      <option value="BALCAO">Balcão</option>
                    </select>
                  </div>
                  
                  {/* SELECT DE DEPÓSITO */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Depósito:</label>
                    <select value={depositId} onChange={e => setDepositId(e.target.value)} className="w-full h-9 px-2 border border-gray-300 rounded">
                      <option value="">Selecione...</option>
                      {availableDeposits.map((d: any) => <option key={d.id} value={d.id}>{d.nome || d.name}</option>)}
                    </select>
                  </div>

                  {/* SELECT DE ENTREGADOR (CORRIGIDO) */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Entregador:</label>
                    <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full h-9 px-2 border border-gray-300 rounded">
                      <option value="">Selecione...</option>
                      {availableDrivers.map((d: any) => <option key={d.id} value={d.id}>{d.nome || d.name}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-700">Bairro/Zona:</label>
                    <input type="text" value={zone} onChange={e => setZone(e.target.value)} className="w-full h-9 px-2 rounded border border-gray-300" />
                  </div>
                </div>
            </div>

            {/* SEÇÃO CLIENTE */}
            <div className="border border-gray-700 rounded p-4 mb-4 relative z-20">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-blue-400 font-bold text-sm uppercase">Cliente</h3>
                <button onClick={() => setIsNewClientMode(!isNewClientMode)} className="text-xs text-green-400 hover:text-green-300 underline">
                   {isNewClientMode ? 'Voltar para Busca' : '+ Novo Cliente'}
                </button>
              </div>

              {isNewClientMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-800 p-3 rounded">
                  <div className="col-span-2">
                     <input className="w-full h-9 px-2 border rounded" placeholder="Nome Completo *" value={newClientData.name} onChange={e => setNewClientData({...newClientData, name: e.target.value})} />
                  </div>
                  <input className="bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="Telefone" value={newClientData.phone} onChange={e => setNewClientData({...newClientData, phone: e.target.value})} />
                  <input className="bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="Endereço" value={newClientData.address} onChange={e => setNewClientData({...newClientData, address: e.target.value})} />
                </div>
              ) : (
                <div className="relative" ref={clientSearchRef}>
                  <input 
                    placeholder="Buscar cliente (Nome, Tel)..." 
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowClientSuggestions(true); }}
                    onFocus={() => setShowClientSuggestions(true)}
                  />
                  {showClientSuggestions && (
                    <div className="absolute top-full left-0 w-full max-h-40 overflow-y-auto bg-gray-900 border border-gray-700 z-50 rounded mt-1">
                      {filteredClientSuggestions.map(c => (
                        <div key={c.id} onMouseDown={() => selectClient(c)} className="px-3 py-2 hover:bg-gray-800 text-white cursor-pointer border-b border-gray-800">
                           <div className="font-bold">{c.nome || c.name}</div>
                           <div className="text-xs text-gray-400">{c.telefone || c.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ITENS DA ORDEM (NOVO COMPONENTE CONECTADO) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-blue-700">Itens da Ordem</span>
              <div className="border border-gray-300 rounded p-3 bg-white space-y-3">
                <ServiceOrderItems
                  selectedDepositId={depositId || null}
                  items={orderItems}
                  onItemsChange={setOrderItems}
                />
              </div>
            </div>

            {/* RESUMO FINANCEIRO E PAGAMENTOS */}
            <div className="border border-gray-300 rounded p-3 bg-white space-y-3">
               <div className="flex justify-between items-center text-lg font-bold">
                   <div>Total: R$ {totalValue.toFixed(2)}</div>
                   <div className="text-red-600">A Pagar: R$ {remainingValue.toFixed(2)}</div>
               </div>
               {/* Aqui você pode reinserir a tabela de pagamentos se desejar, removi para focar no erro principal dos itens */}
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-white border-t border-gray-300 px-4 py-3 flex justify-end gap-2">
           <button onClick={onClose} className="px-4 py-2 border rounded text-gray-700">Cancelar</button>
           <button onClick={handleSaveOrder} className="px-4 py-2 bg-blue-700 text-white rounded font-bold hover:bg-blue-800">Salvar O.S</button>
        </div>
      </div>
    </div>
  );
};

export default NewServiceOrderModal;


