
import { 
  OrdemServico, 
  Produto, 
  FormaPagamento, 
  SaldoEstoque, 
  ResultadoProcessamento 
} from './types';
import { validarSaldoEstoque, calcularMovimentosEstoque } from './stock.logic';
import { validarTotalFinanceiro, calcularImpactoFinanceiro } from './financial.logic';

export function concluirOrdemServico(
  os: OrdemServico,
  saldosAtuais: SaldoEstoque[],
  produtos: Produto[],
  formasPagamento: FormaPagamento[]
): ResultadoProcessamento {
  
  // 1. Validation
  if (os.status !== 'PENDENTE' && os.status !== 'EM_ANDAMENTO') {
    return fail(os, ['Status inválido para conclusão.']);
  }
  
  if (!validarTotalFinanceiro(os)) {
    return fail(os, ['Total dos pagamentos difere do total dos itens.']);
  }

  const errosEstoque = validarSaldoEstoque(os, saldosAtuais, produtos);
  if (errosEstoque.length > 0) {
    return fail(os, errosEstoque);
  }

  // 2. Stock Processing
  // OS generates SAIDA of Full Product, ENTRADA of Empty (if TROCA)
  const movEstoque = calcularMovimentosEstoque(os, produtos, 'OS', false);

  // 3. Financial Processing
  // OS generates ENTRADA of Money (Avista) or Title (Aprazo)
  const { movimentos: movFin, titulos } = calcularImpactoFinanceiro(os, formasPagamento, 'OS', false);

  // 4. Update OS State
  const osConcluida: OrdemServico = {
    ...os,
    status: 'CONCLUIDA',
    dataHoraConclusao: new Date()
  };

  return {
    sucesso: true,
    erros: [],
    movimentosEstoque: movEstoque,
    movimentosFinanceiros: movFin,
    titulosReceber: titulos,
    osAtualizada: osConcluida
  };
}

export function cancelarOrdemServico(
  os: OrdemServico,
  produtos: Produto[],
  formasPagamento: FormaPagamento[]
): ResultadoProcessamento {

  if (os.status !== 'CONCLUIDA') {
    return fail(os, ['Apenas O.S. Concluída pode ser cancelada com reversão.']);
  }

  // 1. Stock Reversal
  // Invert operations: ENTRADA of Full, SAIDA of Empty
  const movEstoque = calcularMovimentosEstoque(os, produtos, 'OS_CANCELAMENTO', true);

  // 2. Financial Reversal
  // Invert operations: SAIDA of Money
  const { movimentos: movFin } = calcularImpactoFinanceiro(os, formasPagamento, 'OS_CANCELAMENTO', true);

  // 3. Update OS State
  const osCancelada: OrdemServico = {
    ...os,
    status: 'CANCELADA'
  };

  // Note: Titles to be cancelled should be handled by ID in the persistence layer based on osId
  return {
    sucesso: true,
    erros: [],
    movimentosEstoque: movEstoque,
    movimentosFinanceiros: movFin,
    titulosReceber: [], 
    osAtualizada: osCancelada
  };
}

// Helper
function fail(os: OrdemServico, erros: string[]): ResultadoProcessamento {
  return {
    sucesso: false,
    erros,
    movimentosEstoque: [],
    movimentosFinanceiros: [],
    titulosReceber: [],
    osAtualizada: os
  };
}
