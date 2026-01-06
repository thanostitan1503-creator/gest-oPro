import React, { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  X, Save, Plus, Trash2, Edit2, Warehouse, Package, ArrowLeftRight,
  ClipboardCheck, AlertTriangle, Users, ShoppingCart, Check, RefreshCw,
  Search, ChevronRight, MapPin, Hash, Palette, Loader2, Settings, Database,
  Box, Repeat, ShoppingBag, Tag
} from 'lucide-react';
import { db } from '@/domain/db';
import { Deposit, Colaborador, MovimentoEstoque, Product, StockMovementRule } from '@/domain/types';
import { upsertDeposit, deleteDeposit, listDeposits } from '@/domain/repositories/deposits.repo';
import { applyMovement } from '@/domain/repositories/stock.repo';

// ============================================================================
// TIPOS
// ============================================================================

type TabType = 'cadastro' | 'estoque' | 'transferencia' | 'contagem' | 'produtos';

interface DepositsStockModuleProps {
  onClose: () => void;
  currentUser?: Colaborador;
}

interface DepositForm {
  id?: string;
  nome: string;
  endereco?: string;
  numero?: string;
  cor?: string;
  ativo: boolean;
  require_stock_audit?: boolean;
}

interface TransferForm {
  originId: string;
  destId: string;
  productId: string;
  quantidade: number;
}

interface CountForm {
  depositId: string;
  counts: Record<string, number | ''>;
}

interface ProductForm {
  id?: string;
  codigo: string;
  nome: string;
  tipo: 'GAS_CHEIO' | 'VASILHAME_VAZIO' | 'AGUA' | 'OUTROS';
  movement_type: StockMovementRule;
  return_product_id?: string | null;
  preco_venda: number;
  preco_custo: number;
  track_stock: boolean;
  ativo: boolean;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const EMPTY_DEPOSIT_FORM: DepositForm = {
  nome: '',
  endereco: '',
  numero: '',
  cor: '#6366f1',
  ativo: true,
  require_stock_audit: false,
};

const EMPTY_PRODUCT_FORM: ProductForm = {
  codigo: '',
  nome: '',
  tipo: 'OUTROS',
  movement_type: 'SIMPLE',
  return_product_id: null,
  preco_venda: 0,
  preco_custo: 0,
  track_stock: true,
  ativo: true,
};

const PRODUCT_TYPES = [
  { value: 'GAS_CHEIO', label: 'Gás Cheio', icon: '🔥' },
  { value: 'VASILHAME_VAZIO', label: 'Vasilhame Vazio', icon: '📦' },
  { value: 'AGUA', label: 'Água', icon: '💧' },
  { value: 'OUTROS', label: 'Outros', icon: '📋' },
];

const MOVEMENT_TYPES = [
  { value: 'SIMPLE', label: 'Simples', desc: 'Venda normal sem retorno de vasilhame', icon: ShoppingBag },
  { value: 'EXCHANGE', label: 'Troca', desc: 'Cliente devolve vazio e leva cheio', icon: Repeat },
  { value: 'FULL', label: 'Completa', desc: 'Vende produto + casco (cliente novo)', icon: Package },
];

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#64748b', // Slate
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const DepositsStockModule: React.FC<DepositsStockModuleProps> = ({ onClose, currentUser }) => {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabType>('cadastro');
  const [depositForm, setDepositForm] = useState<DepositForm>(EMPTY_DEPOSIT_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Product state
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [deleteProductModal, setDeleteProductModal] = useState<Product | null>(null);
  
  // Transfer state
  const [transferForm, setTransferForm] = useState<TransferForm>({
    originId: '',
    destId: '',
    productId: '',
    quantidade: 1,
  });
  const [transferring, setTransferring] = useState(false);
  
  // Count state
  const [countForm, setCountForm] = useState<CountForm>({
    depositId: '',
    counts: {},
  });
  const [counting, setCounting] = useState(false);
  
  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{
    deposit: Deposit;
    hasEmployees: boolean;
    hasStock: boolean;
    hasPendingOS: boolean;
    employees: Colaborador[];
  } | null>(null);
  const [migrateToDepositId, setMigrateToDepositId] = useState<string>('');
  const [migrateStock, setMigrateStock] = useState<'migrate' | 'ignore' | null>(null);
  
  // Maintenance modal
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [orphanData, setOrphanData] = useState<{
    duplicateProducts: { id: string; nome: string; count: number }[];
    orphanStock: { deposit_id: string; product_id: string }[];
    orphanPricing: { product_id: string; deposit_id: string }[];
  } | null>(null);

  // -------------------------------------------------------------------------
  // QUERIES
  // -------------------------------------------------------------------------
  const deposits = useLiveQuery(() => db.deposits.toArray()) ?? [];
  const activeDeposits = useMemo(() => deposits.filter(d => d.ativo !== false), [deposits]);
  
  const employees = useLiveQuery(() => db.employees.toArray()) ?? [];
  
  // Produtos para estoque (apenas ativos com track_stock)
  const products = useLiveQuery(() => db.products.filter(p => 
    p.ativo !== false && 
    (p.track_stock ?? true) !== false &&
    p.type !== 'SERVICE'
  ).toArray()) ?? [];
  
  // TODOS os produtos (para gestão na aba Produtos)
  const allProducts = useLiveQuery(() => db.products.toArray()) ?? [];
  
  const serviceOrders = useLiveQuery(() => db.service_orders.toArray()) ?? [];
  const stockBalance = useLiveQuery(() => db.stock_balance.toArray()) ?? [];

  // -------------------------------------------------------------------------
  // COMPUTED
  // -------------------------------------------------------------------------
  const isGerente = currentUser?.cargo === 'GERENTE';
  
  const filteredDeposits = useMemo(() => {
    if (!searchTerm) return deposits;
    const term = searchTerm.toLowerCase();
    return deposits.filter(d => 
      d.nome?.toLowerCase().includes(term) ||
      d.endereco?.toLowerCase().includes(term)
    );
  }, [deposits, searchTerm]);

  // Produtos filtrados para aba de produtos
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return allProducts;
    const term = productSearchTerm.toLowerCase();
    return allProducts.filter(p => 
      p.nome?.toLowerCase().includes(term) ||
      p.codigo?.toLowerCase().includes(term)
    );
  }, [allProducts, productSearchTerm]);

  // Produtos vazios disponíveis para vínculo (EXCHANGE)
  const emptyProducts = useMemo(() => 
    allProducts.filter(p => p.tipo === 'VASILHAME_VAZIO' && p.ativo !== false),
  [allProducts]);

  // Stock map: { depositId: { productId: qty } }
  const stockMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    stockBalance.forEach(sb => {
      const depId = sb.deposit_id;
      const prodId = sb.product_id;
      if (!map[depId]) map[depId] = {};
      map[depId][prodId] = Number(sb.quantidade_atual ?? 0);
    });
    return map;
  }, [stockBalance]);

  // -------------------------------------------------------------------------
  // HANDLERS - CADASTRO
  // -------------------------------------------------------------------------
  const handleNewDeposit = () => {
    setDepositForm(EMPTY_DEPOSIT_FORM);
    setIsEditing(true);
  };

  const handleEditDeposit = (deposit: Deposit) => {
    setDepositForm({
      id: deposit.id,
      nome: deposit.nome || '',
      endereco: deposit.endereco || '',
      numero: (deposit as any).numero || '',
      cor: deposit.cor || '#6366f1',
      ativo: deposit.ativo ?? true,
      require_stock_audit: deposit.require_stock_audit ?? false,
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDepositForm(EMPTY_DEPOSIT_FORM);
    setIsEditing(false);
  };

  const handleSaveDeposit = async () => {
    if (!depositForm.nome.trim()) {
      alert('O nome do depósito é obrigatório!');
      return;
    }

    setSaving(true);
    try {
      const depositData: Deposit = {
        id: depositForm.id || crypto.randomUUID(),
        nome: depositForm.nome.trim(),
        endereco: depositForm.endereco?.trim() || undefined,
        cor: depositForm.cor || '#6366f1',
        ativo: depositForm.ativo,
        require_stock_audit: depositForm.require_stock_audit,
      };

      // Adiciona número ao endereço se fornecido
      if (depositForm.numero?.trim()) {
        depositData.endereco = depositData.endereco 
          ? `${depositData.endereco}, ${depositForm.numero.trim()}`
          : depositForm.numero.trim();
      }

      await upsertDeposit(depositData);
      setDepositForm(EMPTY_DEPOSIT_FORM);
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar depósito:', error);
      alert('Erro ao salvar depósito. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (deposit: Deposit) => {
    // Verificar dependências
    const linkedEmployees = employees.filter(e => e.depositoId === deposit.id);
    const depositStock = stockMap[deposit.id] || {};
    const hasStock = Object.values(depositStock).some(qty => qty > 0);
    const pendingOS = serviceOrders.filter(os => 
      os.depositoId === deposit.id && 
      (os.status === 'PENDENTE' || os.statusEntrega === 'PENDENTE_ENTREGA' || os.statusEntrega === 'EM_ROTA')
    );

    setDeleteModal({
      deposit,
      hasEmployees: linkedEmployees.length > 0,
      hasStock,
      hasPendingOS: pendingOS.length > 0,
      employees: linkedEmployees,
    });
    setMigrateToDepositId('');
    setMigrateStock(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    
    const { deposit, hasEmployees, hasStock, hasPendingOS, employees: linkedEmployees } = deleteModal;

    // Bloquear se tiver OS pendentes
    if (hasPendingOS) {
      alert('Não é possível excluir: existem O.S. pendentes neste depósito.');
      return;
    }

    // Verificar migração de colaboradores
    if (hasEmployees && !migrateToDepositId) {
      alert('Selecione um depósito para migrar os colaboradores ou cancele.');
      return;
    }

    // Verificar ação do estoque
    if (hasStock && !migrateStock) {
      alert('Selecione o que fazer com o estoque.');
      return;
    }

    setSaving(true);
    try {
      // 1. Migrar colaboradores se necessário
      if (hasEmployees && migrateToDepositId) {
        for (const emp of linkedEmployees) {
          await db.employees.update(emp.id, { depositoId: migrateToDepositId });
        }
      }

      // 2. Migrar ou ignorar estoque
      if (hasStock && migrateStock === 'migrate' && migrateToDepositId) {
        const depositStockEntries = stockBalance.filter(sb => sb.deposit_id === deposit.id);
        for (const entry of depositStockEntries) {
          if (entry.quantidade_atual > 0) {
            // Transferir para destino
            await applyMovement({
              id: crypto.randomUUID(),
              dataHora: new Date().toISOString(),
              depositoId: migrateToDepositId,
              produtoId: entry.product_id,
              produtoNome: products.find(p => p.id === entry.product_id)?.nome || 'Produto',
              tipo: 'ENTRADA',
              quantidade: entry.quantidade_atual,
              origem: 'TRANSFERENCIA',
              usuarioId: currentUser?.id || 'system',
              usuarioNome: currentUser?.nome || 'Sistema',
              motivo: `Migração de estoque do depósito ${deposit.nome} (excluído)`,
            });
          }
        }
        // Zerar estoque do depósito original
        await db.stock_balance.where('deposit_id').equals(deposit.id).delete();
      } else if (hasStock && migrateStock === 'ignore') {
        // Apenas zerar/remover registros de estoque
        await db.stock_balance.where('deposit_id').equals(deposit.id).delete();
      }

      // 3. Excluir o depósito
      await deleteDeposit(deposit.id);
      
      setDeleteModal(null);
    } catch (error) {
      console.error('Erro ao excluir depósito:', error);
      alert('Erro ao excluir depósito. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // HANDLERS - PRODUTOS
  // -------------------------------------------------------------------------
  const handleNewProduct = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
    setIsEditingProduct(true);
  };

  const handleEditProduct = (product: Product) => {
    setProductForm({
      id: product.id,
      codigo: product.codigo || '',
      nome: product.nome || '',
      tipo: (product.tipo as ProductForm['tipo']) || 'OUTROS',
      movement_type: (product.movement_type as StockMovementRule) || 'SIMPLE',
      return_product_id: product.return_product_id || null,
      preco_venda: product.preco_venda || 0,
      preco_custo: product.preco_custo || 0,
      track_stock: product.track_stock ?? true,
      ativo: product.ativo ?? true,
    });
    setIsEditingProduct(true);
  };

  const handleCancelProductEdit = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
    setIsEditingProduct(false);
  };

  const handleSaveProduct = async () => {
    if (!productForm.nome.trim()) {
      alert('O nome do produto é obrigatório!');
      return;
    }

    // Validar: se EXCHANGE, precisa de return_product_id
    if (productForm.movement_type === 'EXCHANGE' && !productForm.return_product_id) {
      alert('Para movimento tipo TROCA, é obrigatório vincular um vasilhame vazio!');
      return;
    }

    setSavingProduct(true);
    try {
      const productData: Product = {
        id: productForm.id || crypto.randomUUID(),
        codigo: productForm.codigo.trim() || null,
        nome: productForm.nome.trim(),
        tipo: productForm.tipo,
        movement_type: productForm.movement_type,
        return_product_id: productForm.movement_type === 'EXCHANGE' ? productForm.return_product_id : null,
        preco_venda: productForm.preco_venda || 0,
        preco_custo: productForm.preco_custo || 0,
        preco_padrao: productForm.preco_venda || 0,
        track_stock: productForm.track_stock,
        ativo: productForm.ativo,
        // Campos obrigatórios com defaults
        descricao: null,
        unidade: 'un',
        product_group: null,
        imagem_url: null,
        deposit_id: null,
        marcacao: productForm.preco_custo > 0 
          ? ((productForm.preco_venda - productForm.preco_custo) / productForm.preco_custo) * 100 
          : 0,
        tracks_empties: productForm.tipo === 'GAS_CHEIO' || productForm.movement_type === 'EXCHANGE',
        created_at: productForm.id ? undefined : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.products.put(productData);
      
      // Se criou um produto tipo GAS_CHEIO com EXCHANGE, criar automaticamente o vazio se não existir
      if (!productForm.id && productForm.tipo === 'GAS_CHEIO' && productForm.movement_type === 'EXCHANGE' && !productForm.return_product_id) {
        const emptyProduct: Product = {
          id: crypto.randomUUID(),
          codigo: `${productData.codigo}_VAZIO`,
          nome: `Vasilhame ${productForm.nome.trim()} (Vazio)`,
          tipo: 'VASILHAME_VAZIO',
          movement_type: 'SIMPLE',
          return_product_id: null,
          preco_venda: 0,
          preco_custo: 0,
          preco_padrao: 0,
          track_stock: true,
          ativo: true,
          descricao: null,
          unidade: 'un',
          product_group: null,
          imagem_url: null,
          deposit_id: null,
          marcacao: 0,
          tracks_empties: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await db.products.put(emptyProduct);
        // Atualizar o produto cheio com o link
        await db.products.update(productData.id, { return_product_id: emptyProduct.id });
      }

      setProductForm(EMPTY_PRODUCT_FORM);
      setIsEditingProduct(false);
      alert('Produto salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Erro ao salvar produto. Tente novamente.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductModal) return;
    
    // Verificar se produto está em uso em alguma OS
    const productInUse = serviceOrders.some(os => 
      os.itens?.some(item => item.produtoId === deleteProductModal.id)
    );
    
    if (productInUse) {
      alert('Este produto não pode ser excluído pois está sendo usado em Ordens de Serviço.');
      setDeleteProductModal(null);
      return;
    }

    setSavingProduct(true);
    try {
      await db.products.delete(deleteProductModal.id);
      // Limpar dados relacionados
      const stockToDelete = await db.stock_balance?.filter(sb => sb.product_id === deleteProductModal.id).toArray() ?? [];
      for (const sb of stockToDelete) {
        await db.stock_balance?.delete(sb.id);
      }
      const pricingToDelete = await db.product_pricing?.filter(pp => pp.productId === deleteProductModal.id).toArray() ?? [];
      for (const pp of pricingToDelete) {
        await db.product_pricing?.delete(pp.id);
      }
      
      setDeleteProductModal(null);
      alert('Produto excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      alert('Erro ao excluir produto.');
    } finally {
      setSavingProduct(false);
    }
  };

  // -------------------------------------------------------------------------
  // HANDLERS - TRANSFERÊNCIA
  // -------------------------------------------------------------------------
  const handleTransfer = async () => {
    const { originId, destId, productId, quantidade } = transferForm;

    if (!originId || !destId || !productId || quantidade <= 0) {
      alert('Preencha todos os campos corretamente.');
      return;
    }

    if (originId === destId) {
      alert('Origem e destino devem ser diferentes.');
      return;
    }

    const originStock = stockMap[originId]?.[productId] ?? 0;
    if (originStock < quantidade) {
      alert(`Estoque insuficiente. Disponível: ${originStock}`);
      return;
    }

    setTransferring(true);
    try {
      const product = products.find(p => p.id === productId);
      const productName = product?.nome || 'Produto';
      const timestamp = new Date().toISOString();

      // Saída da origem
      await applyMovement({
        id: crypto.randomUUID(),
        dataHora: timestamp,
        depositoId: originId,
        produtoId: productId,
        produtoNome: productName,
        tipo: 'SAIDA',
        quantidade,
        origem: 'TRANSFERENCIA',
        usuarioId: currentUser?.id || 'system',
        usuarioNome: currentUser?.nome || 'Sistema',
        motivo: `Transferência para ${activeDeposits.find(d => d.id === destId)?.nome}`,
      });

      // Entrada no destino
      await applyMovement({
        id: crypto.randomUUID(),
        dataHora: timestamp,
        depositoId: destId,
        produtoId: productId,
        produtoNome: productName,
        tipo: 'ENTRADA',
        quantidade,
        origem: 'TRANSFERENCIA',
        usuarioId: currentUser?.id || 'system',
        usuarioNome: currentUser?.nome || 'Sistema',
        motivo: `Transferência de ${activeDeposits.find(d => d.id === originId)?.nome}`,
      });

      setTransferForm({ originId: '', destId: '', productId: '', quantidade: 1 });
      alert('Transferência realizada com sucesso!');
    } catch (error) {
      console.error('Erro na transferência:', error);
      alert('Erro ao realizar transferência.');
    } finally {
      setTransferring(false);
    }
  };

  // -------------------------------------------------------------------------
  // HANDLERS - CONTAGEM
  // -------------------------------------------------------------------------
  const handleCountChange = (productId: string, value: string) => {
    const numValue = value === '' ? '' : parseInt(value);
    setCountForm(prev => ({
      ...prev,
      counts: { ...prev.counts, [productId]: numValue },
    }));
  };

  const handleSaveCount = async () => {
    if (!countForm.depositId) {
      alert('Selecione um depósito.');
      return;
    }

    const entries = Object.entries(countForm.counts).filter(([_, v]) => v !== '' && v !== undefined);
    if (entries.length === 0) {
      alert('Preencha a contagem de pelo menos um produto.');
      return;
    }

    setCounting(true);
    try {
      let cargaInicialCount = 0;
      let ajusteCount = 0;

      for (const [productId, counted] of entries) {
        if (counted === '' || counted === undefined) continue;
        
        const currentQty = stockMap[countForm.depositId]?.[productId] ?? 0;
        const countedNum = Number(counted);
        const diff = countedNum - currentQty;

        // Se não há diferença, não precisa de movimento
        if (diff === 0) continue;

        const product = products.find(p => p.id === productId);
        
        // CARGA INICIAL: quando o sistema está zerado e estamos cadastrando pela primeira vez
        // AJUSTE: quando já existe saldo no sistema e estamos corrigindo
        const isInitialLoad = currentQty === 0 && countedNum > 0;
        
        if (isInitialLoad) {
          // Carga inicial - apenas registra a quantidade inicial
          await applyMovement({
            id: crypto.randomUUID(),
            dataHora: new Date().toISOString(),
            depositoId: countForm.depositId,
            produtoId: productId,
            produtoNome: product?.nome || 'Produto',
            tipo: 'CARGA_INICIAL',
            quantidade: countedNum, // Quantidade total informada
            origem: 'TELA_CONTAGEM_MOVIMENTACAO',
            usuarioId: currentUser?.id || 'system',
            usuarioNome: currentUser?.nome || 'Sistema',
            motivo: 'Carga inicial de estoque',
            meta: { beforeQty: 0, afterQty: countedNum, isInitialLoad: true },
          });
          cargaInicialCount++;
        } else {
          // Ajuste de contagem - corrige diferenças
          await applyMovement({
            id: crypto.randomUUID(),
            dataHora: new Date().toISOString(),
            depositoId: countForm.depositId,
            produtoId: productId,
            produtoNome: product?.nome || 'Produto',
            tipo: 'AJUSTE_CONTAGEM',
            quantidade: Math.abs(diff),
            origem: 'TELA_CONTAGEM_MOVIMENTACAO',
            usuarioId: currentUser?.id || 'system',
            usuarioNome: currentUser?.nome || 'Sistema',
            motivo: diff > 0 ? 'Sobra identificada na contagem' : 'Falta identificada na contagem',
            meta: { beforeQty: currentQty, afterQty: countedNum, diff },
          });
          ajusteCount++;
        }
      }

      setCountForm({ depositId: countForm.depositId, counts: {} });
      
      // Mensagem diferenciada
      const msgs: string[] = [];
      if (cargaInicialCount > 0) msgs.push(`${cargaInicialCount} produto(s) com carga inicial`);
      if (ajusteCount > 0) msgs.push(`${ajusteCount} produto(s) ajustado(s)`);
      alert(`Registrado com sucesso!\n${msgs.join('\n')}`);
    } catch (error) {
      console.error('Erro ao salvar contagem:', error);
      alert('Erro ao salvar contagem.');
    } finally {
      setCounting(false);
    }
  };

  // -------------------------------------------------------------------------
  // HANDLERS - MANUTENÇÃO
  // -------------------------------------------------------------------------
  const analyzeOrphanData = useCallback(async () => {
    setMaintenanceLoading(true);
    try {
      const allProducts = await db.products.toArray();
      const allDeposits = await db.deposits.toArray();
      const allStockBalance = await db.stock_balance.toArray();
      const allProductPricing = await db.product_pricing?.toArray() ?? [];

      const depositIds = new Set(allDeposits.map(d => d.id));
      const productIds = new Set(allProducts.map(p => p.id));

      // 1. Encontrar produtos duplicados (mesmo nome)
      const productsByName: Record<string, typeof allProducts> = {};
      allProducts.forEach(p => {
        const name = (p.nome || (p as any).name || '').toLowerCase().trim();
        if (!productsByName[name]) productsByName[name] = [];
        productsByName[name].push(p);
      });
      
      const duplicateProducts = Object.entries(productsByName)
        .filter(([_, prods]) => prods.length > 1)
        .map(([name, prods]) => ({
          id: prods[0].id,
          nome: prods[0].nome || (prods[0] as any).name || 'Sem nome',
          count: prods.length,
          allIds: prods.map(p => p.id),
        }));

      // 2. Stock balance órfão (depósito ou produto não existe)
      const orphanStock = allStockBalance.filter(sb => 
        !depositIds.has(sb.deposit_id) || !productIds.has(sb.product_id)
      );

      // 3. Product pricing órfão (usa productId e depositoId - camelCase)
      const orphanPricing = allProductPricing.filter(pp => 
        !depositIds.has(pp.depositoId) || !productIds.has(pp.productId)
      ).map(pp => ({ product_id: pp.productId, deposit_id: pp.depositoId }));

      setOrphanData({
        duplicateProducts,
        orphanStock,
        orphanPricing,
      });
    } catch (error) {
      console.error('Erro ao analisar dados:', error);
      alert('Erro ao analisar dados órfãos.');
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  const handleOpenMaintenance = async () => {
    setShowMaintenanceModal(true);
    await analyzeOrphanData();
  };

  const handleCleanDuplicates = async () => {
    if (!orphanData?.duplicateProducts.length) return;
    
    const confirmed = confirm(
      `Isso irá manter apenas 1 produto de cada nome duplicado e remover os outros.\n\n` +
      `Produtos afetados: ${orphanData.duplicateProducts.map(d => `${d.nome} (${d.count}x)`).join(', ')}\n\n` +
      `Deseja continuar?`
    );
    
    if (!confirmed) return;

    setMaintenanceLoading(true);
    try {
      const allProducts = await db.products.toArray();
      const productsByName: Record<string, typeof allProducts> = {};
      
      allProducts.forEach(p => {
        const name = (p.nome || (p as any).name || '').toLowerCase().trim();
        if (!productsByName[name]) productsByName[name] = [];
        productsByName[name].push(p);
      });

      let removed = 0;
      for (const [_, prods] of Object.entries(productsByName)) {
        if (prods.length > 1) {
          // Manter o primeiro, remover os outros
          const idsToRemove = prods.slice(1).map(p => p.id);
          for (const id of idsToRemove) {
            await db.products.delete(id);
            // Também limpar dados relacionados (usando filter pois product_id não é indexado)
            const stockToDelete = await db.stock_balance?.filter(sb => sb.product_id === id).toArray() ?? [];
            for (const sb of stockToDelete) {
              await db.stock_balance?.delete(sb.id);
            }
            const pricingToDelete = await db.product_pricing?.filter(pp => pp.product_id === id).toArray() ?? [];
            for (const pp of pricingToDelete) {
              await db.product_pricing?.delete(pp.id);
            }
            removed++;
          }
        }
      }

      alert(`${removed} produto(s) duplicado(s) removido(s) com sucesso!`);
      await analyzeOrphanData();
    } catch (error) {
      console.error('Erro ao limpar duplicados:', error);
      alert('Erro ao limpar produtos duplicados.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleCleanOrphanStock = async () => {
    if (!orphanData?.orphanStock.length) return;
    
    const confirmed = confirm(
      `Isso irá remover ${orphanData.orphanStock.length} registro(s) de estoque órfão.\n\nDeseja continuar?`
    );
    
    if (!confirmed) return;

    setMaintenanceLoading(true);
    try {
      // Usar filter e delete por id (mais seguro)
      const allStock = await db.stock_balance?.toArray() ?? [];
      for (const orphan of orphanData.orphanStock) {
        const toDelete = allStock.find(s => 
          s.deposit_id === orphan.deposit_id && s.product_id === orphan.product_id
        );
        if (toDelete?.id) {
          await db.stock_balance?.delete(toDelete.id);
        }
      }
      alert('Estoque órfão removido com sucesso!');
      await analyzeOrphanData();
    } catch (error) {
      console.error('Erro ao limpar estoque órfão:', error);
      alert('Erro ao limpar estoque órfão.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleCleanOrphanPricing = async () => {
    if (!orphanData?.orphanPricing.length) return;
    
    const confirmed = confirm(
      `Isso irá remover ${orphanData.orphanPricing.length} registro(s) de preço órfão.\n\nDeseja continuar?`
    );
    
    if (!confirmed) return;

    setMaintenanceLoading(true);
    try {
      // Usar filter e delete por id (mais seguro - usa productId e depositoId camelCase)
      const allPricing = await db.product_pricing?.toArray() ?? [];
      for (const orphan of orphanData.orphanPricing) {
        const toDelete = allPricing.find(p => 
          p.productId === orphan.product_id && p.depositoId === orphan.deposit_id
        );
        if (toDelete?.id) {
          await db.product_pricing?.delete(toDelete.id);
        }
      }
      alert('Preços órfãos removidos com sucesso!');
      await analyzeOrphanData();
    } catch (error) {
      console.error('Erro ao limpar preços órfãos:', error);
      alert('Erro ao limpar preços órfãos.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleCleanAllOrphans = async () => {
    const total = (orphanData?.duplicateProducts.length || 0) + 
                  (orphanData?.orphanStock.length || 0) + 
                  (orphanData?.orphanPricing.length || 0);
    
    if (total === 0) {
      alert('Nenhum dado órfão encontrado!');
      return;
    }

    const confirmed = confirm(
      `Isso irá limpar TODOS os dados órfãos:\n\n` +
      `• ${orphanData?.duplicateProducts.length || 0} produto(s) duplicado(s)\n` +
      `• ${orphanData?.orphanStock.length || 0} registro(s) de estoque órfão\n` +
      `• ${orphanData?.orphanPricing.length || 0} registro(s) de preço órfão\n\n` +
      `Deseja continuar?`
    );
    
    if (!confirmed) return;

    setMaintenanceLoading(true);
    try {
      if (orphanData?.duplicateProducts.length) await handleCleanDuplicates();
      if (orphanData?.orphanStock.length) await handleCleanOrphanStock();
      if (orphanData?.orphanPricing.length) await handleCleanOrphanPricing();
      
      alert('Todos os dados órfãos foram limpos!');
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <header className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-purple-500/10 p-3 rounded-2xl border border-purple-500/20">
            <Warehouse className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Depósitos & Estoque</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Gestão Central</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGerente && (
            <button
              onClick={handleOpenMaintenance}
              className="p-2 hover:bg-orange-500/10 hover:text-orange-500 rounded-full text-txt-muted transition-colors"
              title="Manutenção de Dados"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full text-txt-muted transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-surface border-b border-bdr px-6">
        <div className="flex gap-8 overflow-x-auto">
          {[
            { id: 'cadastro', label: 'Depósitos', icon: Warehouse },
            { id: 'produtos', label: 'Produtos', icon: Box },
            { id: 'estoque', label: 'Estoque', icon: Package },
            { id: 'transferencia', label: 'Transferência', icon: ArrowLeftRight },
            { id: 'contagem', label: 'Contagem', icon: ClipboardCheck },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`pb-4 pt-4 text-sm font-black uppercase tracking-widest border-b-4 transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-txt-muted hover:text-txt-main'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6 bg-app">
        <div className="max-w-7xl mx-auto">
          
          {/* ============================================================= */}
          {/* ABA: CADASTRO */}
          {/* ============================================================= */}
          {activeTab === 'cadastro' && (
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
              {/* Lista de Depósitos */}
              <div className="bg-surface rounded-2xl border border-bdr overflow-hidden">
                <div className="p-4 border-b border-bdr bg-app/50 flex items-center justify-between">
                  <h3 className="text-sm font-black text-txt-main uppercase tracking-wide">
                    Depósitos ({deposits.length})
                  </h3>
                  {isGerente && (
                    <button
                      onClick={handleNewDeposit}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo
                    </button>
                  )}
                </div>

                {/* Busca */}
                <div className="p-3 border-b border-bdr">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" />
                    <input
                      type="text"
                      placeholder="Buscar depósito..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-app border border-bdr rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                  </div>
                </div>

                {/* Lista */}
                <div className="divide-y divide-bdr max-h-[500px] overflow-y-auto">
                  {filteredDeposits.length === 0 ? (
                    <div className="p-8 text-center text-txt-muted">
                      <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-bold">Nenhum depósito encontrado</p>
                    </div>
                  ) : (
                    filteredDeposits.map(deposit => {
                      const empCount = employees.filter(e => e.depositoId === deposit.id).length;
                      const stockCount = Object.values(stockMap[deposit.id] || {}).reduce((a, b) => a + b, 0);
                      
                      return (
                        <div
                          key={deposit.id}
                          className={`p-4 hover:bg-app/50 transition-colors ${deposit.ativo === false ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center border-2"
                                style={{ 
                                  backgroundColor: `${deposit.cor || '#6366f1'}20`,
                                  borderColor: deposit.cor || '#6366f1'
                                }}
                              >
                                <Warehouse className="w-5 h-5" style={{ color: deposit.cor || '#6366f1' }} />
                              </div>
                              <div>
                                <h4 className="font-bold text-txt-main flex items-center gap-2">
                                  {deposit.nome}
                                  {deposit.ativo === false && (
                                    <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-black uppercase">
                                      Inativo
                                    </span>
                                  )}
                                </h4>
                                {deposit.endereco && (
                                  <p className="text-xs text-txt-muted flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3" />
                                    {deposit.endereco}
                                  </p>
                                )}
                                <div className="flex gap-3 mt-1.5">
                                  <span className="text-[10px] font-bold text-txt-muted bg-app px-1.5 py-0.5 rounded">
                                    {empCount} colaborador{empCount !== 1 ? 'es' : ''}
                                  </span>
                                  <span className="text-[10px] font-bold text-txt-muted bg-app px-1.5 py-0.5 rounded">
                                    {stockCount} itens estoque
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {isGerente && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEditDeposit(deposit)}
                                  className="p-2 hover:bg-blue-500/10 text-blue-500 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(deposit)}
                                  className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Formulário de Edição */}
              <div className="bg-surface rounded-2xl border border-bdr overflow-hidden">
                <div className="p-4 border-b border-bdr bg-app/50">
                  <h3 className="text-sm font-black text-txt-main uppercase tracking-wide">
                    {isEditing 
                      ? (depositForm.id ? 'Editar Depósito' : 'Novo Depósito')
                      : 'Detalhes do Depósito'
                    }
                  </h3>
                </div>

                {!isGerente ? (
                  <div className="p-8 text-center">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
                    <p className="font-bold text-txt-main">Acesso Restrito</p>
                    <p className="text-sm text-txt-muted mt-1">
                      Apenas gerentes podem criar ou editar depósitos.
                    </p>
                  </div>
                ) : !isEditing ? (
                  <div className="p-8 text-center">
                    <Warehouse className="w-12 h-12 mx-auto mb-3 text-txt-muted opacity-30" />
                    <p className="font-bold text-txt-main">Nenhum Depósito Selecionado</p>
                    <p className="text-sm text-txt-muted mt-1">
                      Clique em "Novo" ou selecione um depósito para editar.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 space-y-5">
                    {/* Nome (obrigatório) */}
                    <div>
                      <label className="block text-xs font-black text-txt-muted uppercase mb-2">
                        Nome do Depósito *
                      </label>
                      <input
                        type="text"
                        value={depositForm.nome}
                        onChange={e => setDepositForm({ ...depositForm, nome: e.target.value })}
                        placeholder="Ex: Matriz, Filial Centro..."
                        className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                      />
                    </div>

                    {/* Endereço (opcional) */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-black text-txt-muted uppercase mb-2">
                          Endereço
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" />
                          <input
                            type="text"
                            value={depositForm.endereco || ''}
                            onChange={e => setDepositForm({ ...depositForm, endereco: e.target.value })}
                            placeholder="Rua, Bairro..."
                            className="w-full pl-10 bg-app border border-bdr rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-txt-muted uppercase mb-2">
                          Número
                        </label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" />
                          <input
                            type="text"
                            value={depositForm.numero || ''}
                            onChange={e => setDepositForm({ ...depositForm, numero: e.target.value })}
                            placeholder="123"
                            className="w-full pl-10 bg-app border border-bdr rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cor */}
                    <div>
                      <label className="block text-xs font-black text-txt-muted uppercase mb-2">
                        Cor de Identificação
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => setDepositForm({ ...depositForm, cor: color })}
                              className={`w-8 h-8 rounded-lg transition-transform ${
                                depositForm.cor === color ? 'scale-110 ring-2 ring-offset-2 ring-purple-500' : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Palette className="w-4 h-4 text-txt-muted" />
                          <input
                            type="color"
                            value={depositForm.cor || '#6366f1'}
                            onChange={e => setDepositForm({ ...depositForm, cor: e.target.value })}
                            className="w-10 h-8 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Opções */}
                    <div className="space-y-3 pt-2">
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-app rounded-xl border border-bdr hover:border-purple-500/30 transition-colors">
                        <input
                          type="checkbox"
                          checked={depositForm.ativo}
                          onChange={e => setDepositForm({ ...depositForm, ativo: e.target.checked })}
                          className="w-5 h-5 rounded text-purple-500 focus:ring-purple-500"
                        />
                        <div>
                          <span className="font-bold text-sm text-txt-main">Depósito Ativo</span>
                          <p className="text-xs text-txt-muted">Desmarque para desativar temporariamente</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-app rounded-xl border border-bdr hover:border-purple-500/30 transition-colors">
                        <input
                          type="checkbox"
                          checked={depositForm.require_stock_audit || false}
                          onChange={e => setDepositForm({ ...depositForm, require_stock_audit: e.target.checked })}
                          className="w-5 h-5 rounded text-purple-500 focus:ring-purple-500"
                        />
                        <div>
                          <span className="font-bold text-sm text-txt-main">Exigir Contagem no Fechamento</span>
                          <p className="text-xs text-txt-muted">Operadores precisam contar estoque ao fechar caixa</p>
                        </div>
                      </label>
                    </div>

                    {/* Botões */}
                    <div className="flex gap-3 pt-4 border-t border-bdr">
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-4 py-3 border border-bdr rounded-xl font-bold text-txt-muted hover:bg-app transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveDeposit}
                        disabled={saving || !depositForm.nome.trim()}
                        className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-colors"
                      >
                        {saving ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            Salvar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA: PRODUTOS */}
          {/* ============================================================= */}
          {activeTab === 'produtos' && (
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
              {/* Lista de Produtos */}
              <div className="bg-surface rounded-2xl border border-bdr overflow-hidden">
                <div className="p-4 border-b border-bdr bg-app/50 flex items-center justify-between">
                  <h3 className="text-sm font-black text-txt-main uppercase tracking-wide">
                    Produtos ({allProducts.length})
                  </h3>
                  {isGerente && (
                    <button
                      onClick={handleNewProduct}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo
                    </button>
                  )}
                </div>

                {/* Busca */}
                <div className="p-3 border-b border-bdr">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" />
                    <input
                      type="text"
                      placeholder="Buscar produto..."
                      value={productSearchTerm}
                      onChange={e => setProductSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-app border border-bdr rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                  </div>
                </div>

                {/* Lista */}
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-8 text-center text-txt-muted">
                      <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Nenhum produto encontrado</p>
                    </div>
                  ) : (
                    filteredProducts.map(product => (
                      <div
                        key={product.id}
                        className={`p-4 border-b border-bdr hover:bg-app/50 cursor-pointer transition-colors ${
                          productForm.id === product.id ? 'bg-purple-500/10 border-l-4 border-l-purple-500' : ''
                        } ${!product.ativo ? 'opacity-50' : ''}`}
                        onClick={() => handleEditProduct(product)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">
                              {PRODUCT_TYPES.find(t => t.value === product.tipo)?.icon || '📋'}
                            </span>
                            <div>
                              <div className="font-bold text-txt-main flex items-center gap-2">
                                {product.nome}
                                {!product.ativo && (
                                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">
                                    INATIVO
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-txt-muted flex items-center gap-2 mt-0.5">
                                <span>{product.codigo || 'Sem código'}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  {MOVEMENT_TYPES.find(m => m.value === product.movement_type)?.label || 'Simples'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-500">
                              R$ {(product.preco_venda || 0).toFixed(2)}
                            </div>
                            {product.track_stock && (
                              <div className="text-[10px] text-txt-muted">Controla estoque</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Formulário de Produto */}
              <div className="bg-surface rounded-2xl border border-bdr overflow-hidden">
                {!isEditingProduct ? (
                  <div className="p-12 text-center text-txt-muted">
                    <Box className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">Selecione um produto para editar</p>
                    <p className="text-xs mt-1">ou clique em "Novo" para criar</p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-bdr bg-app/50 flex items-center justify-between">
                      <h3 className="text-sm font-black text-txt-main uppercase tracking-wide">
                        {productForm.id ? 'Editar Produto' : 'Novo Produto'}
                      </h3>
                      <button
                        onClick={handleCancelProductEdit}
                        className="text-txt-muted hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                      {/* Nome e Código */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-txt-muted uppercase tracking-wide mb-2">
                            Nome *
                          </label>
                          <input
                            type="text"
                            value={productForm.nome}
                            onChange={e => setProductForm(prev => ({ ...prev, nome: e.target.value }))}
                            className="w-full px-4 py-3 bg-app border border-bdr rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none"
                            placeholder="Ex: Gás P13"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-txt-muted uppercase tracking-wide mb-2">
                            Código/SKU
                          </label>
                          <input
                            type="text"
                            value={productForm.codigo}
                            onChange={e => setProductForm(prev => ({ ...prev, codigo: e.target.value }))}
                            className="w-full px-4 py-3 bg-app border border-bdr rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none"
                            placeholder="Ex: GAS-P13"
                          />
                        </div>
                      </div>

                      {/* Tipo do Produto */}
                      <div>
                        <label className="block text-xs font-bold text-txt-muted uppercase tracking-wide mb-2">
                          Tipo do Produto
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {PRODUCT_TYPES.map(type => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setProductForm(prev => ({ 
                                ...prev, 
                                tipo: type.value as ProductForm['tipo'],
                                // Auto-seleciona EXCHANGE para GAS_CHEIO
                                movement_type: type.value === 'GAS_CHEIO' ? 'EXCHANGE' : prev.movement_type,
                              }))}
                              className={`p-3 rounded-xl border-2 transition-all text-center ${
                                productForm.tipo === type.value
                                  ? 'border-purple-500 bg-purple-500/10'
                                  : 'border-bdr hover:border-purple-500/50'
                              }`}
                            >
                              <span className="text-2xl block mb-1">{type.icon}</span>
                              <span className="text-xs font-bold">{type.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tipo de Movimento (movement_type) */}
                      <div>
                        <label className="block text-xs font-bold text-txt-muted uppercase tracking-wide mb-2">
                          Tipo de Movimento (Regra de Estoque)
                        </label>
                        <div className="space-y-2">
                          {MOVEMENT_TYPES.map(mt => (
                            <button
                              key={mt.value}
                              type="button"
                              onClick={() => setProductForm(prev => ({ 
                                ...prev, 
                                movement_type: mt.value as StockMovementRule,
                                // Limpa o vínculo se não for EXCHANGE
                                return_product_id: mt.value === 'EXCHANGE' ? prev.return_product_id : null,
                              }))}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                                productForm.movement_type === mt.value
                                  ? 'border-purple-500 bg-purple-500/10'
                                  : 'border-bdr hover:border-purple-500/50'
                              }`}
                            >
                              <mt.icon className={`w-6 h-6 ${
                                productForm.movement_type === mt.value ? 'text-purple-500' : 'text-txt-muted'
                              }`} />
                              <div>
                                <div className="font-bold text-sm">{mt.label}</div>
                                <div className="text-xs text-txt-muted">{mt.desc}</div>
                              </div>
                              {productForm.movement_type === mt.value && (
                                <Check className="w-5 h-5 text-purple-500 ml-auto" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Vínculo com Vasilhame Vazio (só aparece se EXCHANGE) */}
                      {productForm.movement_type === 'EXCHANGE' && (
                        <div>
                          <label className="block text-xs font-bold text-txt-muted uppercase tracking-wide mb-2">
                            <AlertTriangle className="w-3 h-3 inline mr-1 text-yellow-500" />
                            Vasilhame Vazio Vinculado *
                          </label>
                          <select
                            value={productForm.return_product_id || ''}
                            onChange={e => setProductForm(prev => ({ ...prev, return_product_id: e.target.value || null }))}
                            className="w-full px-4 py-3 bg-app border border-bdr rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none"
                          >
                            <option value="">-- Selecione o vasilhame vazio --</option>
                            {emptyProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                          </select>
                          {emptyProducts.length === 0 && (
                            <p className="text-xs text-yellow-500 mt-2">
                              ⚠️ Nenhum vasilhame vazio cadastrado. Crie primeiro um produto do tipo "Vasilhame Vazio".
                            </p>
                          )}
                        </div>
                      )}

                      {/* Preços - Layout diferente baseado no tipo de movimento */}
                      {productForm.movement_type !== 'EXCHANGE' && productForm.movement_type !== 'Troca' ? (
                        /* Produto SIMPLES - Mostra Preço de Venda normal */
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-txt-muted uppercase tracking-wide mb-2">
                              Preço de Venda (R$)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={productForm.preco_venda || ''}
                              onChange={e => {
                                const val = e.target.value.replace(',', '.');
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  setProductForm(prev => ({ ...prev, preco_venda: val === '' ? 0 : parseFloat(val) || 0 }));
                                }
                              }}
                              placeholder="0.00"
                              className="w-full px-4 py-3 bg-app border border-bdr rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-txt-muted uppercase tracking-wide mb-2">
                              Preço de Custo (R$)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={productForm.preco_custo || ''}
                              onChange={e => {
                                const val = e.target.value.replace(',', '.');
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  setProductForm(prev => ({ ...prev, preco_custo: val === '' ? 0 : parseFloat(val) || 0 }));
                                }
                              }}
                              placeholder="0.00"
                              className="w-full px-4 py-3 bg-app border border-bdr rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        /* Produto com TROCA - Layout especial com modalidades */
                        <div className="space-y-4">
                          {/* Preço de Custo sempre visível */}
                          <div>
                            <label className="block text-xs font-bold text-txt-muted uppercase tracking-wide mb-2">
                              Preço de Custo (R$)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={productForm.preco_custo || ''}
                              onChange={e => {
                                const val = e.target.value.replace(',', '.');
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  setProductForm(prev => ({ ...prev, preco_custo: val === '' ? 0 : parseFloat(val) || 0 }));
                                }
                              }}
                              placeholder="0.00"
                              className="w-full px-4 py-3 bg-app border border-bdr rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none"
                            />
                          </div>
                          
                          {/* Preços por Modalidade de Venda */}
                          <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl p-4 border border-green-500/30 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">💰</span>
                              <span className="font-bold text-txt-main">Preços por Modalidade de Venda</span>
                            </div>
                            <p className="text-xs text-txt-muted mb-3">
                              Defina os preços para cada tipo de venda deste produto:
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                                <label className="block text-xs font-bold text-green-400 uppercase tracking-wide mb-2">
                                  🔁 Preço TROCA (R$) *
                                </label>
                                <p className="text-[10px] text-txt-muted mb-2">Cliente devolve casco vazio</p>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={(productForm as any).preco_troca || ''}
                                  onChange={e => {
                                    const val = e.target.value.replace(',', '.');
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                      const numVal = val === '' ? null : parseFloat(val) || 0;
                                      setProductForm(prev => ({ 
                                        ...prev, 
                                        preco_troca: numVal,
                                        preco_venda: numVal ?? prev.preco_venda // Sincroniza com preco_venda como fallback
                                      }));
                                    }
                                  }}
                                  placeholder="Ex: 130.00"
                                  className="w-full px-3 py-2 bg-app border border-green-500/30 rounded-lg focus:ring-2 focus:ring-green-500/20 outline-none text-sm"
                                />
                              </div>
                              <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                                <label className="block text-xs font-bold text-blue-400 uppercase tracking-wide mb-2">
                                  📦 Preço COMPLETA (R$) *
                                </label>
                                <p className="text-[10px] text-txt-muted mb-2">Cliente leva casco (cliente novo)</p>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={(productForm as any).preco_completa || ''}
                                  onChange={e => {
                                    const val = e.target.value.replace(',', '.');
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                      setProductForm(prev => ({ ...prev, preco_completa: val === '' ? null : parseFloat(val) || 0 }));
                                    }
                                  }}
                                  placeholder="Ex: 220.00"
                                  className="w-full px-3 py-2 bg-app border border-blue-500/30 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-amber-400 font-semibold">
                              ⚠️ Preço COMPLETA = Preço TROCA + Valor do Casco (vasilhame vazio)
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Margem calculada - Para EXCHANGE usa preco_troca, senão preco_venda */}
                      {productForm.preco_custo > 0 && (
                        <div className="bg-app rounded-xl p-4 border border-bdr">
                          <div className="text-xs text-txt-muted uppercase tracking-wide mb-1">Margem de Lucro</div>
                          <div className="text-2xl font-black text-green-500">
                            {(() => {
                              const precoRef = (productForm.movement_type === 'EXCHANGE' || productForm.movement_type === 'Troca')
                                ? ((productForm as any).preco_troca || productForm.preco_venda || 0)
                                : (productForm.preco_venda || 0);
                              return (((precoRef - productForm.preco_custo) / productForm.preco_custo) * 100).toFixed(1);
                            })()}%
                          </div>
                          {(productForm.movement_type === 'EXCHANGE' || productForm.movement_type === 'Troca') && (
                            <p className="text-[10px] text-txt-muted mt-1">Baseado no Preço de TROCA</p>
                          )}
                        </div>
                      )}

                      {/* Opções */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={productForm.track_stock}
                            onChange={e => setProductForm(prev => ({ ...prev, track_stock: e.target.checked }))}
                            className="w-5 h-5 rounded border-bdr text-purple-500 focus:ring-purple-500"
                          />
                          <div>
                            <span className="font-medium text-txt-main">Controlar Estoque</span>
                            <p className="text-xs text-txt-muted">Movimentações afetam o saldo de estoque</p>
                          </div>
                        </label>
                        
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={productForm.ativo}
                            onChange={e => setProductForm(prev => ({ ...prev, ativo: e.target.checked }))}
                            className="w-5 h-5 rounded border-bdr text-purple-500 focus:ring-purple-500"
                          />
                          <div>
                            <span className="font-medium text-txt-main">Produto Ativo</span>
                            <p className="text-xs text-txt-muted">Disponível para vendas</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-bdr bg-app/50 flex justify-between items-center">
                      {productForm.id && isGerente ? (
                        <button
                          onClick={() => setDeleteProductModal(allProducts.find(p => p.id === productForm.id) || null)}
                          className="px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg font-bold text-sm flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                      ) : (
                        <div />
                      )}
                      <button
                        onClick={handleSaveProduct}
                        disabled={savingProduct}
                        className="px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-black rounded-lg flex items-center gap-2 transition-colors"
                      >
                        {savingProduct ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Salvar Produto
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA: ESTOQUE */}
          {/* ============================================================= */}
          {activeTab === 'estoque' && (
            <div className="space-y-6">
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {activeDeposits.map(deposit => {
                  const stock = stockMap[deposit.id] || {};
                  const totalItems = Object.values(stock).reduce((a, b) => a + b, 0);
                  const productCount = Object.keys(stock).filter(k => stock[k] > 0).length;
                  
                  return (
                    <div
                      key={deposit.id}
                      className="bg-surface p-4 rounded-xl border border-bdr"
                      style={{ borderLeftColor: deposit.cor, borderLeftWidth: 4 }}
                    >
                      <h4 className="font-bold text-txt-main text-sm">{deposit.nome}</h4>
                      <div className="mt-2 space-y-1">
                        <p className="text-2xl font-black text-txt-main">{totalItems}</p>
                        <p className="text-xs text-txt-muted">{productCount} produto(s) em estoque</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabela de estoque */}
              <div className="bg-surface rounded-2xl border border-bdr overflow-hidden">
                <div className="p-4 border-b border-bdr bg-app/50">
                  <h3 className="text-sm font-black text-txt-main uppercase tracking-wide">
                    Estoque por Produto
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-app border-b border-bdr">
                      <tr>
                        <th className="text-left px-4 py-3 font-black text-txt-muted uppercase text-xs">Produto</th>
                        {activeDeposits.map(d => (
                          <th 
                            key={d.id} 
                            className="text-center px-4 py-3 font-black text-txt-muted uppercase text-xs"
                            style={{ color: d.cor }}
                          >
                            {d.nome}
                          </th>
                        ))}
                        <th className="text-center px-4 py-3 font-black text-txt-muted uppercase text-xs bg-purple-500/10">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bdr">
                      {products.map(product => {
                        const total = activeDeposits.reduce(
                          (sum, d) => sum + (stockMap[d.id]?.[product.id] ?? 0), 
                          0
                        );
                        
                        return (
                          <tr key={product.id} className="hover:bg-app/30">
                            <td className="px-4 py-3 font-bold text-txt-main">{product.nome}</td>
                            {activeDeposits.map(d => {
                              const qty = stockMap[d.id]?.[product.id] ?? 0;
                              return (
                                <td 
                                  key={d.id} 
                                  className={`text-center px-4 py-3 font-mono ${
                                    qty === 0 ? 'text-txt-muted' : qty <= 5 ? 'text-red-500 font-bold' : 'text-txt-main'
                                  }`}
                                >
                                  {qty}
                                </td>
                              );
                            })}
                            <td className="text-center px-4 py-3 font-black text-purple-600 bg-purple-500/5">
                              {total}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA: TRANSFERÊNCIA */}
          {/* ============================================================= */}
          {activeTab === 'transferencia' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-surface rounded-2xl border border-bdr overflow-hidden">
                <div className="p-4 border-b border-bdr bg-app/50 flex items-center gap-3">
                  <ArrowLeftRight className="w-5 h-5 text-purple-500" />
                  <div>
                    <h3 className="text-sm font-black text-txt-main uppercase tracking-wide">
                      Transferência entre Depósitos
                    </h3>
                    <p className="text-xs text-txt-muted">Move estoque de um depósito para outro</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Origem → Destino */}
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
                    <div>
                      <label className="block text-xs font-black text-txt-muted uppercase mb-2">
                        Origem (Sai)
                      </label>
                      <select
                        value={transferForm.originId}
                        onChange={e => setTransferForm({ ...transferForm, originId: e.target.value })}
                        className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                      >
                        <option value="">Selecione...</option>
                        {activeDeposits.map(d => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-center pb-3">
                      <ChevronRight className="w-6 h-6 text-txt-muted" />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-black text-txt-muted uppercase mb-2">
                        Destino (Entra)
                      </label>
                      <select
                        value={transferForm.destId}
                        onChange={e => setTransferForm({ ...transferForm, destId: e.target.value })}
                        className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                      >
                        <option value="">Selecione...</option>
                        {activeDeposits.filter(d => d.id !== transferForm.originId).map(d => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Produto */}
                  <div>
                    <label className="block text-xs font-black text-txt-muted uppercase mb-2">
                      Produto
                    </label>
                    <select
                      value={transferForm.productId}
                      onChange={e => setTransferForm({ ...transferForm, productId: e.target.value })}
                      className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                    >
                      <option value="">Selecione o produto...</option>
                      {products.map(p => {
                        const available = stockMap[transferForm.originId]?.[p.id] ?? 0;
                        return (
                          <option key={p.id} value={p.id} disabled={available === 0}>
                            {p.nome} {transferForm.originId ? `(Disp: ${available})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Quantidade */}
                  <div>
                    <label className="block text-xs font-black text-txt-muted uppercase mb-2">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={stockMap[transferForm.originId]?.[transferForm.productId] ?? 999}
                      value={transferForm.quantidade}
                      onChange={e => setTransferForm({ ...transferForm, quantidade: parseInt(e.target.value) || 0 })}
                      className="w-full bg-app border border-bdr rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                    {transferForm.originId && transferForm.productId && (
                      <p className="text-xs text-txt-muted mt-1">
                        Disponível na origem: <strong>{stockMap[transferForm.originId]?.[transferForm.productId] ?? 0}</strong>
                      </p>
                    )}
                  </div>

                  {/* Botão */}
                  <button
                    onClick={handleTransfer}
                    disabled={transferring || !transferForm.originId || !transferForm.destId || !transferForm.productId || transferForm.quantidade <= 0}
                    className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-colors"
                  >
                    {transferring ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <ArrowLeftRight className="w-5 h-5" />
                        Confirmar Transferência
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA: CONTAGEM */}
          {/* ============================================================= */}
          {activeTab === 'contagem' && (
            <div className="space-y-6">
              {/* Seleção de depósito */}
              <div className="bg-surface rounded-xl border border-bdr p-4 flex items-center gap-4">
                <label className="text-sm font-black text-txt-muted uppercase">Depósito:</label>
                <select
                  value={countForm.depositId}
                  onChange={e => setCountForm({ depositId: e.target.value, counts: {} })}
                  className="flex-1 max-w-xs bg-app border border-bdr rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                >
                  <option value="">Selecione um depósito...</option>
                  {activeDeposits.map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
                
                {countForm.depositId && (
                  <button
                    onClick={() => setCountForm({ depositId: countForm.depositId, counts: {} })}
                    className="text-sm font-bold text-txt-muted hover:text-txt-main flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Limpar
                  </button>
                )}
              </div>

              {/* Aviso */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <Package className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-txt-main">
                  <p className="font-bold text-blue-600 mb-1">Contagem de Estoque</p>
                  <ul className="text-txt-muted space-y-1 text-xs">
                    <li>• <strong className="text-purple-400">Carga Inicial</strong>: Quando o sistema está zerado, você está cadastrando seu estoque pela primeira vez</li>
                    <li>• <strong className="text-emerald-400">Ajuste</strong>: Quando já existe saldo, a diferença será registrada como sobra ou falta</li>
                  </ul>
                </div>
              </div>

              {/* Tabela de contagem */}
              {countForm.depositId && (
                <div className="bg-surface rounded-2xl border border-bdr overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-app border-b border-bdr">
                      <tr>
                        <th className="text-left px-4 py-3 font-black text-txt-muted uppercase text-xs">Produto</th>
                        <th className="text-center px-4 py-3 font-black text-txt-muted uppercase text-xs w-32">Sistema</th>
                        <th className="text-center px-4 py-3 font-black text-purple-600 uppercase text-xs w-40 bg-purple-500/5">Contagem</th>
                        <th className="text-center px-4 py-3 font-black text-txt-muted uppercase text-xs w-32">Diferença</th>
                        <th className="text-center px-4 py-3 font-black text-txt-muted uppercase text-xs w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bdr">
                      {products.map(product => {
                        const systemQty = stockMap[countForm.depositId]?.[product.id] ?? 0;
                        const countedValue = countForm.counts[product.id];
                        const counted = countedValue === '' || countedValue === undefined ? null : Number(countedValue);
                        const diff = counted !== null ? counted - systemQty : null;
                        const hasInput = counted !== null;
                        
                        // Detectar se é carga inicial (sistema zerado e informando quantidade)
                        const isInitialLoad = systemQty === 0 && counted !== null && counted > 0;

                        return (
                          <tr key={product.id} className={hasInput ? (isInitialLoad ? 'bg-purple-500/10' : 'bg-purple-500/5') : 'hover:bg-app/30'}>
                            <td className="px-4 py-3 font-bold text-txt-main">{product.nome}</td>
                            <td className="px-4 py-3 text-center font-mono text-txt-muted">{systemQty}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={countForm.counts[product.id] ?? ''}
                                onChange={e => handleCountChange(product.id, e.target.value)}
                                placeholder="-"
                                className="w-24 text-center font-black text-lg bg-surface border-2 border-bdr rounded-lg py-1 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              {hasInput && diff !== null && (
                                isInitialLoad ? (
                                  <span className="font-black text-lg text-purple-500">
                                    +{counted}
                                  </span>
                                ) : (
                                  <span className={`font-black text-lg ${
                                    diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-txt-muted'
                                  }`}>
                                    {diff > 0 ? '+' : ''}{diff}
                                  </span>
                                )
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {hasInput && diff !== null && (
                                isInitialLoad ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/20 text-purple-400 text-[10px] font-black uppercase">
                                    <Package className="w-3 h-3" /> Inicial
                                  </span>
                                ) : diff === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">
                                    <Check className="w-3 h-3" /> OK
                                  </span>
                                ) : diff > 0 ? (
                                  <span className="inline-flex px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase">
                                    Sobra
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2 py-1 rounded-md bg-red-500/10 text-red-600 text-[10px] font-black uppercase">
                                    Falta
                                  </span>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Footer com botão */}
                  <div className="p-4 border-t border-bdr bg-app/50 flex justify-between items-center">
                    <div className="text-sm text-txt-muted">
                      Itens contados: <strong className="text-txt-main">
                        {Object.values(countForm.counts).filter(v => v !== '' && v !== undefined).length}
                      </strong> de {products.length}
                    </div>
                    <button
                      onClick={handleSaveCount}
                      disabled={counting || Object.values(countForm.counts).filter(v => v !== '' && v !== undefined).length === 0}
                      className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 transition-colors"
                    >
                      {counting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Registrar Contagem
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ============================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {/* ============================================================= */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl border border-bdr overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-500/10 px-6 py-4 border-b border-red-500/20 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="font-black text-lg text-red-600">Excluir Depósito</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-txt-main">
                Você está prestes a excluir o depósito <strong>{deleteModal.deposit.nome}</strong>.
              </p>

              {/* Aviso de OS pendentes (bloqueante) */}
              {deleteModal.hasPendingOS && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <ShoppingCart className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-600 text-sm">Exclusão Bloqueada</p>
                    <p className="text-xs text-txt-muted mt-1">
                      Existem O.S. pendentes ou em rota neste depósito. 
                      Finalize ou cancele todas as O.S. antes de excluir.
                    </p>
                  </div>
                </div>
              )}

              {/* Colaboradores vinculados */}
              {deleteModal.hasEmployees && !deleteModal.hasPendingOS && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-600 text-sm">
                        {deleteModal.employees.length} colaborador(es) vinculado(s)
                      </p>
                      <p className="text-xs text-txt-muted mt-1">
                        Selecione um depósito para migrar os colaboradores:
                      </p>
                    </div>
                  </div>
                  <select
                    value={migrateToDepositId}
                    onChange={e => setMigrateToDepositId(e.target.value)}
                    className="w-full bg-app border border-bdr rounded-lg p-2 text-sm font-bold"
                  >
                    <option value="">Selecione o destino...</option>
                    {activeDeposits
                      .filter(d => d.id !== deleteModal.deposit.id)
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Estoque */}
              {deleteModal.hasStock && !deleteModal.hasPendingOS && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-blue-600 text-sm">Estoque existente</p>
                      <p className="text-xs text-txt-muted mt-1">O que fazer com o estoque?</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-app">
                      <input
                        type="radio"
                        name="stockAction"
                        checked={migrateStock === 'migrate'}
                        onChange={() => setMigrateStock('migrate')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-bold text-txt-main">
                        Transferir para outro depósito
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-app">
                      <input
                        type="radio"
                        name="stockAction"
                        checked={migrateStock === 'ignore'}
                        onChange={() => setMigrateStock('ignore')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-bold text-txt-main">
                        Ignorar e zerar estoque
                      </span>
                    </label>
                  </div>
                  
                  {migrateStock === 'migrate' && (
                    <select
                      value={migrateToDepositId}
                      onChange={e => setMigrateToDepositId(e.target.value)}
                      className="w-full bg-app border border-bdr rounded-lg p-2 text-sm font-bold mt-2"
                    >
                      <option value="">Selecione o destino...</option>
                      {activeDeposits
                        .filter(d => d.id !== deleteModal.deposit.id)
                        .map(d => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-bdr bg-app flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 font-bold text-txt-muted hover:text-txt-main rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={saving || deleteModal.hasPendingOS}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-black rounded-lg flex items-center gap-2 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Manutenção */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface rounded-2xl border border-bdr shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-bdr flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-orange-500/10 p-2 rounded-xl border border-orange-500/20">
                  <Database className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-txt-main">Manutenção de Dados</h3>
                  <p className="text-xs text-txt-muted">Limpar dados órfãos e duplicados</p>
                </div>
              </div>
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full text-txt-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {maintenanceLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  <p className="text-txt-muted">Analisando dados...</p>
                </div>
              ) : orphanData ? (
                <>
                  {/* Produtos Duplicados */}
                  <div className="bg-app rounded-xl border border-bdr p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-txt-main flex items-center gap-2">
                          <Package className="w-4 h-4 text-yellow-500" />
                          Produtos Duplicados
                        </h4>
                        <p className="text-xs text-txt-muted mt-1">
                          Produtos com o mesmo nome cadastrados mais de uma vez
                        </p>
                      </div>
                      {orphanData.duplicateProducts.length > 0 && (
                        <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full">
                          {orphanData.duplicateProducts.length} encontrado(s)
                        </span>
                      )}
                    </div>
                    {orphanData.duplicateProducts.length > 0 ? (
                      <>
                        <ul className="text-sm text-txt-muted space-y-1 mb-3">
                          {orphanData.duplicateProducts.map((dup, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="text-yellow-500">•</span>
                              <span className="font-medium text-txt-main">{dup.nome}</span>
                              <span className="text-xs">({dup.count}x duplicados)</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={handleCleanDuplicates}
                          disabled={maintenanceLoading}
                          className="text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-lg font-bold transition-colors"
                        >
                          Remover Duplicados
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-green-400 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Nenhum produto duplicado encontrado
                      </p>
                    )}
                  </div>

                  {/* Estoque Órfão */}
                  <div className="bg-app rounded-xl border border-bdr p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-txt-main flex items-center gap-2">
                          <Warehouse className="w-4 h-4 text-blue-500" />
                          Estoque Órfão
                        </h4>
                        <p className="text-xs text-txt-muted mt-1">
                          Registros de estoque para depósitos ou produtos que não existem mais
                        </p>
                      </div>
                      {orphanData.orphanStock.length > 0 && (
                        <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded-full">
                          {orphanData.orphanStock.length} registro(s)
                        </span>
                      )}
                    </div>
                    {orphanData.orphanStock.length > 0 ? (
                      <button
                        onClick={handleCleanOrphanStock}
                        disabled={maintenanceLoading}
                        className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg font-bold transition-colors"
                      >
                        Limpar Estoque Órfão
                      </button>
                    ) : (
                      <p className="text-sm text-green-400 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Nenhum estoque órfão encontrado
                      </p>
                    )}
                  </div>

                  {/* Preços Órfãos */}
                  <div className="bg-app rounded-xl border border-bdr p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-txt-main flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-purple-500" />
                          Preços Órfãos
                        </h4>
                        <p className="text-xs text-txt-muted mt-1">
                          Tabelas de preço para produtos ou depósitos inexistentes
                        </p>
                      </div>
                      {orphanData.orphanPricing.length > 0 && (
                        <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-2 py-1 rounded-full">
                          {orphanData.orphanPricing.length} registro(s)
                        </span>
                      )}
                    </div>
                    {orphanData.orphanPricing.length > 0 ? (
                      <button
                        onClick={handleCleanOrphanPricing}
                        disabled={maintenanceLoading}
                        className="text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-3 py-1.5 rounded-lg font-bold transition-colors"
                      >
                        Limpar Preços Órfãos
                      </button>
                    ) : (
                      <p className="text-sm text-green-400 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Nenhum preço órfão encontrado
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-txt-muted">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Clique em "Analisar" para verificar dados órfãos</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-bdr flex justify-between items-center gap-3">
              <button
                onClick={analyzeOrphanData}
                disabled={maintenanceLoading}
                className="px-4 py-2 bg-app hover:bg-bdr text-txt-muted font-bold rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${maintenanceLoading ? 'animate-spin' : ''}`} />
                Analisar Novamente
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 bg-app hover:bg-bdr text-txt-muted font-bold rounded-lg transition-colors"
                >
                  Fechar
                </button>
                {orphanData && (
                  (orphanData.duplicateProducts.length > 0 || 
                   orphanData.orphanStock.length > 0 || 
                   orphanData.orphanPricing.length > 0) && (
                    <button
                      onClick={handleCleanAllOrphans}
                      disabled={maintenanceLoading}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Limpar Tudo
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Produto */}
      {deleteProductModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface rounded-2xl border border-bdr shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-txt-main">Excluir Produto</h3>
                  <p className="text-sm text-txt-muted">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              
              <div className="bg-app rounded-xl p-4 mb-6">
                <p className="text-sm text-txt-main">
                  Tem certeza que deseja excluir o produto <strong>"{deleteProductModal.nome}"</strong>?
                </p>
                <p className="text-xs text-txt-muted mt-2">
                  Todos os dados de estoque e preços relacionados também serão removidos.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteProductModal(null)}
                  className="px-4 py-2 bg-app hover:bg-bdr text-txt-muted font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteProduct}
                  disabled={savingProduct}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg flex items-center gap-2 transition-colors"
                >
                  {savingProduct ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepositsStockModule;
