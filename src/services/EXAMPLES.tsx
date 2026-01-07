/**
 * 📚 GUIA DE MIGRAÇÃO PARA SERVICE PATTERN
 * 
 * Este arquivo mostra COMO usar os serviços nos componentes React.
 * 
 * ⚠️ ANTES vs DEPOIS:
 * 
 * ANTES (❌ Ruim - lógica espalhada):
 * ```tsx
 * const { data } = await supabase.from('deposits').select('*');
 * ```
 * 
 * DEPOIS (✅ Bom - camada de serviço):
 * ```tsx
 * const deposits = await depositService.getAll();
 * ```
 */

import { useState, useEffect } from 'react';
import {
  depositService,
  productService,
  stockService,
  serviceOrderService,
  clientService,
  financialService,
  deliveryService,
  type Deposit,
  type Product,
  type ServiceOrder
} from '@/services';

// ==================== EXEMPLO 1: LISTAGEM SIMPLES ====================

export function DepositsListExample() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDeposits();
  }, []);

  async function loadDeposits() {
    try {
      setLoading(true);
      const data = await depositService.getAll();
      setDeposits(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h1>Depósitos</h1>
      <ul>
        {deposits.map(dep => (
          <li key={dep.id}>{dep.name}</li>
        ))}
      </ul>
    </div>
  );
}

// ==================== EXEMPLO 2: CRIAR DEPÓSITO ====================

export function CreateDepositExample() {
  async function handleSubmit(formData: any) {
    try {
      const newDeposit = await depositService.create({
        name: formData.name,
        address: formData.address,
        color: formData.color || '#3b82f6'
        // ⚠️ VS Code VAI RECLAMAR se faltar campo obrigatório!
      });

      alert(`Depósito ${newDeposit.name} criado com sucesso!`);
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleSubmit(Object.fromEntries(formData));
    }}>
      <input name="name" placeholder="Nome do Depósito" required />
      <input name="address" placeholder="Endereço" />
      <input name="color" type="color" />
      <button type="submit">Salvar</button>
    </form>
  );
}

// ==================== EXEMPLO 3: VENDA COMPLETA (COMPLEXO) ====================

export function CreateSaleExample() {
  const [selectedProducts, setSelectedProducts] = useState<Array<{
    productId: string;
    quantity: number;
    saleMovementType: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null;
  }>>([]);

  async function handleSale(formData: any) {
    try {
      // 1. Calcula preços dos itens
      const items = await Promise.all(
        selectedProducts.map(async (item) => {
          const price = await productService.getFinalPrice(
            item.productId,
            formData.depositId,
            item.saleMovementType
          );

          return {
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: price,
            modality: 'VENDA',
            sale_movement_type: item.saleMovementType
          };
        })
      );

      // 2. Calcula total
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      // 3. Busca taxa de entrega (se DELIVERY)
      let deliveryFee = 0;
      if (formData.serviceType === 'DELIVERY' && formData.zoneId) {
        deliveryFee = await deliveryService.getDeliveryFee(formData.zoneId, formData.depositId);
      }

      const total = subtotal + deliveryFee;

      // 4. Cria O.S. completa (venda + itens + pagamentos + estoque)
      const order = await serviceOrderService.create({
        order: {
          // ⚠️ order_number NÃO deve ser enviado - Supabase gera automaticamente
          deposit_id: formData.depositId,
          client_name: formData.clientName,
          client_phone: formData.clientPhone,
          delivery_address: formData.deliveryAddress,
          service_type: formData.serviceType,
          total,
          delivery_fee: deliveryFee,
          zone_id: formData.zoneId,
          status: 'PENDENTE'
        },
        items,
        payments: [
          {
            payment_method_id: formData.paymentMethodId,
            amount: total
          }
        ]
      });

      alert(`Venda ${order.order_number} criada com sucesso!`);
      
      // 5. Se gerou fiado, cria conta a receber
      if (formData.paymentType === 'fiado') {
        await financialService.createReceivable({
          order_id: order.id,
          deposit_id: formData.depositId,
          client_id: formData.clientId,
          client_name: formData.clientName,
          original_amount: total,
          paid_amount: 0,
          remaining_amount: total,
          status: 'PENDENTE',
          due_date: formData.dueDate,
          notes: `Venda ${order.order_number}`
        });
      }

    } catch (error: any) {
      alert(`Erro ao criar venda: ${error.message}`);
    }
  }

  return (
    <div>
      <h2>Nova Venda</h2>
      {/* Formulário aqui */}
    </div>
  );
}

// ==================== EXEMPLO 4: CONSULTA DE ESTOQUE ====================

export function StockCheckExample({ productId, depositId }: { productId: string; depositId: string }) {
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    loadBalance();
  }, [productId, depositId]);

  async function loadBalance() {
    try {
      const bal = await stockService.getBalance(productId, depositId);
      setBalance(bal);
    } catch (error: any) {
      console.error(error);
    }
  }

  return (
    <div>
      <p>Estoque disponível: <strong>{balance}</strong></p>
    </div>
  );
}

// ==================== EXEMPLO 5: AJUSTE DE ESTOQUE ====================

export function StockAdjustmentExample({ productId, depositId }: { productId: string; depositId: string }) {
  async function handleAdjust(newQuantity: number) {
    try {
      await stockService.adjustStock(
        productId,
        depositId,
        newQuantity,
        'Ajuste manual via interface'
      );

      alert('Estoque ajustado com sucesso!');
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    }
  }

  return (
    <div>
      <input type="number" id="newQty" placeholder="Nova quantidade" />
      <button onClick={() => {
        const input = document.getElementById('newQty') as HTMLInputElement;
        handleAdjust(Number(input.value));
      }}>
        Ajustar Estoque
      </button>
    </div>
  );
}

// ==================== EXEMPLO 6: ABERTURA DE TURNO ====================

export function OpenShiftExample({ userId, depositId }: { userId: string; depositId: string }) {
  async function handleOpenShift() {
    try {
      // Verifica se já tem turno aberto
      const existing = await financialService.hasOpenShift(userId, depositId);
      if (existing) {
        alert('Você já possui um turno aberto!');
        return;
      }

      // Abre turno
      const shift = await financialService.openShift(userId, depositId, 100.00);
      alert(`Turno aberto com sucesso! Saldo inicial: R$ ${shift.opening_balance}`);
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    }
  }

  return (
    <button onClick={handleOpenShift}>
      Abrir Turno
    </button>
  );
}

// ==================== EXEMPLO 7: FECHAMENTO DE TURNO ====================

export function CloseShiftExample({ shiftId }: { shiftId: string }) {
  async function handleCloseShift(declared: { cash: number; card: number; pix: number }) {
    try {
      const shift = await financialService.closeShift(shiftId, declared);
      
      if (shift.status === 'DISCREPANCY') {
        alert('⚠️ Turno fechado com discrepância!\n' +
              `Dinheiro - Sistema: R$ ${shift.system_cash}, Declarado: R$ ${shift.declared_cash}\n` +
              `Cartão - Sistema: R$ ${shift.system_card}, Declarado: R$ ${shift.declared_card}\n` +
              `PIX - Sistema: R$ ${shift.system_pix}, Declarado: R$ ${shift.declared_pix}`);
      } else {
        alert('✅ Turno fechado com sucesso!');
      }
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    }
  }

  return (
    <div>
      <h3>Fechar Turno</h3>
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        handleCloseShift({
          cash: Number(formData.get('cash')),
          card: Number(formData.get('card')),
          pix: Number(formData.get('pix'))
        });
      }}>
        <input name="cash" type="number" placeholder="Dinheiro" step="0.01" required />
        <input name="card" type="number" placeholder="Cartão" step="0.01" required />
        <input name="pix" type="number" placeholder="PIX" step="0.01" required />
        <button type="submit">Fechar Turno</button>
      </form>
    </div>
  );
}

// ==================== EXEMPLO 8: BUSCAR PRODUTO COM PREÇO POR DEPÓSITO ====================

export function ProductWithPriceExample({ depositId }: { depositId: string }) {
  const [products, setProducts] = useState<Array<Product & { finalPrice: number }>>([]);

  useEffect(() => {
    loadProducts();
  }, [depositId]);

  async function loadProducts() {
    try {
      const allProducts = await productService.getAll();
      
      // Busca preço de cada produto no depósito
      const withPrices = await Promise.all(
        allProducts.map(async (product) => {
          const pricing = await productService.getPricing(product.id, depositId);
          return {
            ...product,
            finalPrice: pricing?.sale_price || product.sale_price // Fallback
          };
        })
      );

      setProducts(withPrices);
    } catch (error: any) {
      console.error(error);
    }
  }

  return (
    <div>
      <h2>Produtos (Preços do Depósito)</h2>
      <ul>
        {products.map(p => (
          <li key={p.id}>
            {p.name} - R$ {p.finalPrice.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ==================== EXEMPLO 9: RELATÓRIO DE VENDAS ====================

export function SalesReportExample({ depositId }: { depositId: string }) {
  async function generateReport() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const report = await serviceOrderService.getSalesByPeriod(depositId, weekAgo, today);
      const topProducts = await serviceOrderService.getTopProducts(depositId, weekAgo, today, 5);

      console.log('Vendas da semana:', report);
      console.log('Top 5 produtos:', topProducts);

      alert(`Vendas: ${report.count} | Total: R$ ${report.total.toFixed(2)}`);
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    }
  }

  return (
    <button onClick={generateReport}>
      Gerar Relatório (Última Semana)
    </button>
  );
}

// ==================== EXEMPLO 10: CLIENTE COM DÉBITO ====================

export function ClientsWithDebtExample() {
  const [clients, setClients] = useState<Array<any>>([]);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const data = await clientService.getWithDebt();
      setClients(data);
    } catch (error: any) {
      console.error(error);
    }
  }

  return (
    <div>
      <h2>Clientes com Débito</h2>
      <ul>
        {clients.map(c => (
          <li key={c.id}>
            {c.name} - Deve: R$ {c.debt.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ==================== RESUMO DA MIGRAÇÃO ====================
 * 
 * ✅ O QUE FAZER:
 * 1. Importe os serviços de '@/services'
 * 2. Use try/catch para capturar erros
 * 3. Deixe o VS Code te ajudar com autocomplete
 * 4. Se faltar campo obrigatório, VS Code avisa
 * 
 * ❌ O QUE NÃO FAZER:
 * 1. Nunca chame supabase.from() diretamente nos componentes
 * 2. Nunca use 'any' nos tipos
 * 3. Nunca ignore erros (sempre trate com try/catch)
 * 
 * 🚀 BENEFÍCIOS:
 * 1. Código limpo e organizado
 * 2. Reutilização de lógica
 * 3. Tipagem forte (menos bugs)
 * 4. Fácil de testar
 * 5. Fácil de manter
 */
