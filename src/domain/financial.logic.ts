
import { 
  OrdemServico, 
  FormaPagamento, 
  MovimentoFinanceiro, 
  TituloReceber, 
  OrigemMovimento,
  TipoMovimentoFinanceiro
} from './types';

const uuid = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

export function validarTotalFinanceiro(os: OrdemServico): boolean {
  const totalItens = os.itens.reduce((acc, item) => acc + (item.quantidade * item.precoUnitario), 0);
  const totalPagamentos = os.pagamentos.reduce((acc, pag) => acc + pag.valor, 0);

  // Tolerance for rounding
  return Math.abs(totalItens - totalPagamentos) < 0.01;
}

export function calcularImpactoFinanceiro(
  os: OrdemServico,
  formasPagamento: FormaPagamento[],
  origem: OrigemMovimento,
  inverter: boolean // True for Cancellation
): { movimentos: MovimentoFinanceiro[], titulos: TituloReceber[] } {
  
  const movimentos: MovimentoFinanceiro[] = [];
  const titulos: TituloReceber[] = [];
  const now = new Date();

  for (const pag of os.pagamentos) {
    const forma = formasPagamento.find(f => f.id === pag.formaPagamentoId);
    if (!forma) continue;

    // Se for À VISTA OU (A PRAZO sem gerar Contas a Receber), gera movimentação imediata
    if (forma.tipoFluxo === 'AVISTA' || (forma.tipoFluxo === 'APRAZO' && !forma.geraContasReceber)) {
      // CASH FLOW (Movimento Financeiro)
      // Logic: OS Completion = ENTRADA of money. Cancellation = SAIDA (Reversal).
      const tipo: TipoMovimentoFinanceiro = inverter ? 'SAIDA' : 'ENTRADA';
      
      const taxa = forma.taxaPercentual || 0;
      const valorLiquido = pag.valor * (1 - (taxa / 100));

      movimentos.push({
        id: uuid(),
        dataHora: now,
        centroFinanceiroId: os.depositoId, // Matches Physical Deposit of OS. Never 'PESSOAL'.
        tipo: tipo,
        origem: origem,
        referenciaId: os.id,
        formaPagamentoId: forma.id,
        valorBruto: pag.valor,
        valorLiquido: Number(valorLiquido.toFixed(2))
      });

    } 
    
    // Se for A PRAZO e GERAR CONTAS A RECEBER, cria o Título
    if (forma.tipoFluxo === 'APRAZO' && forma.geraContasReceber) {
      // ACCOUNTS RECEIVABLE (Titulo)
      if (!inverter) {
        // Create new Title
        const vencimento = new Date();
        // Uses the configured standard term (prazo) or defaults to 30 days if not set
        const diasPrazo = forma.prazoPadraoDias !== undefined ? forma.prazoPadraoDias : 30;
        vencimento.setDate(vencimento.getDate() + diasPrazo);

        titulos.push({
          id: uuid(),
          dataLancamento: now,
          dataVencimento: vencimento,
          osId: os.id,
          clienteNome: os.clienteNome,
          valorOriginal: pag.valor,
          valorAberto: pag.valor,
          status: 'ABERTO'
        });
      } else {
        // Cancellation of Title logic is handled by ID reference in DB layer usually.
        // Pure function returns empty here, Orchestrator handles status change.
      }
    }
  }

  return { movimentos, titulos };
}