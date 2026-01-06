
import { 
  OrdemServico, 
  Produto, 
  MovimentoEstoque, 
  SaldoEstoque, 
  OrigemMovimento,
  TipoMovimentoEstoque
} from './types';

// Helper to generate UUIDs (mock implementation for pure logic)
const uuid = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const isDeliveryFeeProduct = (produto: any) => {
  const flag = produto?.is_delivery_fee ?? produto?.isDeliveryFee;
  if (flag === true) return true;
  const group = String(produto?.product_group ?? produto?.codigo ?? '').toLowerCase();
  if (group === 'delivery_fee') return true;
  const name = String(produto?.nome ?? '').toLowerCase();
  return name === 'taxa de entrega';
};

const isServiceProduct = (produto: any) => {
  if (isDeliveryFeeProduct(produto)) return true;
  const track = produto?.track_stock ?? produto?.trackStock;
  if (track === false) return true;
  return produto?.type === 'SERVICE';
};

const normalizeMovementType = (produto: any) => {
  // ✅ PRIORIDADE 1: Usar o campo movement_type se existir
  const raw = String(
    produto?.movement_type ?? produto?.movementType ?? ''
  ).toUpperCase();
  if (raw === 'EXCHANGE' || raw === 'FULL' || raw === 'SIMPLE') return raw;
  
  // Fallback legado: inferir pelo tipo de produto
  if (produto?.tracks_empties && produto?.product_group) return 'EXCHANGE';
  return 'SIMPLE';
};

const resolveReturnProduct = (produto: any, produtos: Produto[]) => {
  // ✅ PRIORIDADE 1: Usar o campo return_product_id se existir
  const returnId =
    produto?.return_product_id ?? produto?.returnProductId ?? null;
  if (returnId) {
    const found = produtos.find((p) => p.id === returnId);
    if (found) return found;
  }
  
  // Fallback legado: buscar por product_group
  const group = produto?.product_group ?? null;
  if (!group) return null;
  return produtos.find(
    (p) => p.tipo === 'VASILHAME_VAZIO' && p.product_group === group
  ) ?? null;
};

/**
 * Validates if the physical deposit has enough items for the OS.
 */
export function validarSaldoEstoque(
  os: OrdemServico,
  saldos: SaldoEstoque[],
  produtos?: Produto[]
): string[] {
  const erros: string[] = [];
  const demanda = new Map<string, number>();
  const isServiceItem = (produtoId: string) => {
    if (!produtos || produtos.length === 0) return false;
    const produto = produtos.find((p) => p.id === produtoId) as any;
    if (!produto) return false;
    return isServiceProduct(produto);
  };

  // Calculate demand per product
  for (const item of os.itens) {
    if (isServiceItem(item.produtoId)) continue;
    if (item.modalidade === 'VENDA' || item.modalidade === 'TROCA' || item.modalidade === 'OUTROS') {
      const atual = demanda.get(item.produtoId) || 0;
      demanda.set(item.produtoId, atual + item.quantidade);
    }
  }

  // Check against balance
  demanda.forEach((qtdNecessaria, produtoId) => {
    const saldoItem = saldos.find(s => s.depositoId === os.depositoId && s.produtoId === produtoId);
    const qtdDisponivel = saldoItem ? saldoItem.quantidade : 0;

    if (qtdDisponivel < qtdNecessaria) {
      erros.push(`Saldo insuficiente no ${os.depositoId} para produto ${produtoId}. Necessário: ${qtdNecessaria}, Atual: ${qtdDisponivel}`);
    }
  });

  return erros;
}

/**
 * Generates stock movements based on OS items.
 * Handles the logic of Shells (Cascos) for 'TROCA'.
 * 
 * ⚠️ IMPORTANTE: O modo de venda é determinado por:
 * 1. PRIORIDADE 1: sale_movement_type do ITEM (escolhido no momento da venda)
 * 2. PRIORIDADE 2: movement_type do PRODUTO (cadastro)
 * 
 * Modos:
 * - EXCHANGE (TROCA): -1 cheio, +1 vazio (cliente devolve casco)
 * - FULL (COMPLETA): -1 cheio apenas (cliente leva o casco)
 * - SIMPLE: movimento simples, sem troca de vasilhame
 */
export function calcularMovimentosEstoque(
  os: OrdemServico,
  produtos: Produto[],
  origem: OrigemMovimento,
  inverter: boolean // True for Cancellation
): MovimentoEstoque[] {
  const movimentos: MovimentoEstoque[] = [];
  const now = new Date().toISOString();

  for (const item of os.itens) {
    const produto = produtos.find(p => p.id === item.produtoId);
    if (!produto) continue;
    if (isServiceProduct(produto)) continue;

    // 1. Movement of the Main Product (e.g. Full Gas)
    if (['VENDA', 'TROCA', 'OUTROS'].includes(item.modalidade)) {
      const tipo: TipoMovimentoEstoque = inverter ? 'ENTRADA' : 'SAIDA';
      
      movimentos.push({
        id: uuid(),
        dataHora: now,
        depositoId: os.depositoId, // Strictly Physical Deposit
        produtoId: item.produtoId,
        produtoNome: produto.nome,
        tipo: tipo,
        quantidade: item.quantidade,
        origem: origem,
        referenciaId: os.id,
        usuarioId: 'SYSTEM',
        usuarioNome: 'Sistema'
      });
    }

    // 2. Movement of the Return Item (Exchange)
    // ✅ PRIORIDADE: sale_movement_type do ITEM > movement_type do PRODUTO
    const itemSaleMode = String(
      (item as any)?.sale_movement_type ?? ''
    ).toUpperCase();
    
    // Se o item tem sale_movement_type definido, usa ele
    // Caso contrário, usa o movement_type do produto
    let effectiveMovementType: string;
    if (itemSaleMode === 'EXCHANGE' || itemSaleMode === 'FULL' || itemSaleMode === 'SIMPLE') {
      effectiveMovementType = itemSaleMode;
    } else {
      effectiveMovementType = normalizeMovementType(produto);
    }

    // Só gera entrada de vazio se for EXCHANGE (TROCA)
    // Se for FULL (COMPLETA), não entra vazio porque cliente leva o casco
    if (effectiveMovementType === 'EXCHANGE') {
      const tipoCasco: TipoMovimentoEstoque = inverter ? 'SAIDA' : 'ENTRADA';
      const casco = resolveReturnProduct(produto, produtos);

      if (casco) {
        movimentos.push({
          id: uuid(),
          dataHora: now,
          depositoId: os.depositoId, // Strictly Physical Deposit
          produtoId: casco.id,
          produtoNome: casco.nome,
          tipo: tipoCasco,
          quantidade: item.quantidade,
          origem: origem,
          referenciaId: os.id,
          usuarioId: 'SYSTEM',
          usuarioNome: 'Sistema'
        });
      }
    }
    // Se effectiveMovementType === 'FULL': NÃO entra vazio (cliente leva o casco)
    // Se effectiveMovementType === 'SIMPLE': movimento simples, sem vasilhame
  }

  return movimentos;
}
