
import { 
  ClientePreco, 
  Produto, 
  DepositoFisicoId,
  ModalidadeItem
} from './types';

/**
 * Resolve o preço seguindo a ordem:
 * 1. Cliente + Produto + Depósito + Modalidade
 * 2. Cliente + Produto + GLOBAL (NULL Deposito) + Modalidade
 * 3. Preço padrão do produto
 */
export function resolverPrecoVenda(
  clienteId: string,
  produtoId: string,
  depositoId: DepositoFisicoId,
  modalidade: ModalidadeItem,
  precosEspeciais: ClientePreco[],
  produtoBase: Produto
): { preco: number; isEspecial: boolean } {
  
  // 1. Específico por Depósito
  const precoDeposito = precosEspeciais.find(
    p => p.clienteId === clienteId && 
         p.produtoId === produtoId && 
         p.depositoId === depositoId &&
         p.modalidade === modalidade &&
         p.precoEspecial !== null &&
         p.ativo
  );
  if (precoDeposito) return { preco: precoDeposito.precoEspecial!, isEspecial: true };

  // 2. Global do Cliente
  const precoGlobal = precosEspeciais.find(
    p => p.clienteId === clienteId && 
         p.produtoId === produtoId && 
         p.depositoId === null &&
         p.modalidade === modalidade &&
         p.precoEspecial !== null &&
         p.ativo
  );
  if (precoGlobal) return { preco: precoGlobal.precoEspecial!, isEspecial: true };

  // 3. Padrão do Sistema
  return { preco: produtoBase.preco_padrao, isEspecial: false };
}
