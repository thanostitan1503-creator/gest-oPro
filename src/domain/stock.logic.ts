
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
    const movementType = normalizeMovementType(produto);
    if (movementType === 'EXCHANGE') {
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
  }

  return movimentos;
}
