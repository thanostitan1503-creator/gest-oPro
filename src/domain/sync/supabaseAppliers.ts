import { supabase } from '../supabaseClient';
import {
  Cliente,
  Colaborador,
  Deposit,
  PaymentMethod,
  Produto,
  ClientePreco,
  ClienteDescontoPendente,
  OrdemServico,
  ItemOrdemServico,
  MovimentoEstoque,
  Expense,
  WorkShift,
  CashFlowEntry,
  ShiftStockAudit,
  DeliveryZone,
  DeliverySector,
  ZonePricing,
} from '../types';
import { AccountsReceivable, ReceivablePayment } from '../db';
import { toSupabaseFormat } from '@/domain/utils/dataSanitizer';

type AnyRow = Record<string, any>;

/**
 * Detecta erros de "coluna não existe" / "schema cache" do Supabase/PostgREST.
 * Importante: PGRST204 vem com mensagem tipo:
 * "Could not find the 'x' column of 'y' in the schema cache"
 */
function looksLikeColumnError(errOrMessage?: unknown): boolean {
  if (!errOrMessage) return false;

  const err: any =
    typeof errOrMessage === 'string' ? { message: errOrMessage } : (errOrMessage as any);

  const code = String(err?.code ?? '').toUpperCase();
  const message = String(err?.message ?? '').toLowerCase();
  const details = String(err?.details ?? '').toLowerCase();
  const hint = String(err?.hint ?? '').toLowerCase();

  const hay = `${message} ${details} ${hint}`;

  // PostgREST / Supabase típico
  if (code === 'PGRST204') return true;

  // Postgres "undefined_column"
  if (code === '42703') return true;

  // Mensagens comuns do PostgREST/Supabase
  if (hay.includes('schema cache') && hay.includes('could not find')) return true;

  // Mensagens comuns do Postgres
  if (hay.includes('column') && hay.includes('does not exist')) return true;

  // Variações comuns
  if (hay.includes('column') && (hay.includes('not found') || hay.includes('could not find'))) return true;
  if (hay.includes('unknown column')) return true;

  return false;
}

/**
 * Erros de NOT NULL (23502) costumam acontecer quando estamos tentando
 * diferentes mapeamentos de campos (ex.: schema exige `code` e enviamos só `nome`).
 * Nesse caso, vale tentar o próximo payload variante.
 */
function looksLikeNotNullViolation(errOrMessage?: unknown): boolean {
  if (!errOrMessage) return false;

  const err: any =
    typeof errOrMessage === 'string' ? { message: errOrMessage } : (errOrMessage as any);

  const code = String(err?.code ?? '').toUpperCase();
  if (code !== '23502') return false;

  const message = String(err?.message ?? '').toLowerCase();
  // Postgres típico: "null value in column \"x\" of relation \"y\" violates not-null constraint"
  return message.includes('null value in column') && message.includes('violates not-null constraint');
}

/**
 * Erros de FK (23503) acontecem quando uma entidade referencia outra
 * que ainda não existe no Supabase.
 */
function looksLikeForeignKeyViolation(errOrMessage?: unknown): boolean {
  if (!errOrMessage) return false;

  const err: any =
    typeof errOrMessage === 'string' ? { message: errOrMessage } : (errOrMessage as any);

  const code = String(err?.code ?? '').toUpperCase();
  if (code === '23503') return true;

  const message = String(err?.message ?? '').toLowerCase();
  const details = String(err?.details ?? '').toLowerCase();
  const hint = String(err?.hint ?? '').toLowerCase();
  const hay = `${message} ${details} ${hint}`;

  return hay.includes('violates foreign key constraint') || hay.includes('is not present in table');
}

function looksLikeProductsReturnProductFK(errOrMessage?: unknown): boolean {
  if (!looksLikeForeignKeyViolation(errOrMessage)) return false;

  const err: any =
    typeof errOrMessage === 'string' ? { message: errOrMessage } : (errOrMessage as any);

  const message = String(err?.message ?? '').toLowerCase();
  const details = String(err?.details ?? '').toLowerCase();
  const hay = `${message} ${details}`;

  return hay.includes('return_product_id') || hay.includes('products_return_product_id_fkey');
}

async function tryUpsert(table: string, variants: AnyRow[], onConflict = 'id') {
  let lastError: any = null;

  for (const payload of variants) {
    // 🧹 HIGIENIZAÇÃO: Aplica serialização reversa (Frontend → Supabase)
    const cleanPayload = toSupabaseFormat(payload, table);
    
    const debugEnabled = (import.meta as any).env?.DEV || typeof window === 'undefined';
    if (debugEnabled) {
      // log temporário de chaves para depuração de schema
      console.log('[UPSERT]', table, Object.keys(cleanPayload).sort());
    }
    const res = await supabase
      .from(table)
      .upsert(cleanPayload as any, { onConflict })
      .select('*')
      .single();

    if (!res.error) return res.data;

    lastError = res.error;

    // Se for erro de coluna, tenta a próxima variação de payload
    if (looksLikeColumnError(res.error) || looksLikeNotNullViolation(res.error)) {
      if (debugEnabled) {
        console.log('[UPSERT_FAIL_RETRY]', table, { code: (res.error as any)?.code, message: (res.error as any)?.message });
      }
      continue;
    }

    // Se for FK do return_product_id em products, tenta a próxima variante
    // (ex.: variante com return_product_id removido/nulo)
    if (table === 'products' && looksLikeProductsReturnProductFK(res.error)) {
      if (debugEnabled) {
        console.log('[UPSERT_FK_RETRY]', table, { code: (res.error as any)?.code, message: (res.error as any)?.message });
      }
      continue;
    }

    // Qualquer outro erro: para tudo
    throw res.error;
  }

  throw lastError;
}

async function tryDelete(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

async function tryDeleteBy(table: string, columnCandidates: string[], value: string) {
  let lastError: any = null;

  for (const col of columnCandidates) {
    const { error } = await supabase.from(table).delete().eq(col, value);
    if (!error) return;

    lastError = error;

    // Se falhou por coluna (col não existe), tenta o próximo candidato
    if (looksLikeColumnError(error)) continue;

    throw error;
  }

  throw lastError;
}

async function tryInsertMany(table: string, variants: AnyRow[][]) {
  let lastError: any = null;

  for (const payloadArr of variants) {
    if (!payloadArr.length) return;

    // 🧹 HIGIENIZAÇÃO: Aplica serialização reversa em cada item do batch
    const cleanPayloadArr = payloadArr.map(item => toSupabaseFormat(item, table));

    const { error } = await supabase.from(table).insert(cleanPayloadArr as any);
    if (!error) return;

    lastError = error;

    // Se falhou por coluna inexistente, tenta próxima variante
    if (looksLikeColumnError(error)) continue;

    throw error;
  }

  throw lastError;
}

// ----------------------- PRODUCTS -----------------------

export async function applyProductUpsert(p: Produto) {
  const trackStockRaw =
    (p as any).track_stock ??
    (p as any).trackStock ??
    undefined;
  const trackStock = typeof trackStockRaw === 'boolean' ? trackStockRaw : true;
  const productType = (p as any).type ?? null;
  const isDeliveryFee =
    (p as any).is_delivery_fee === true ||
    (p as any).isDeliveryFee === true ||
    String(p.product_group ?? p.codigo ?? '').toLowerCase() === 'delivery_fee' ||
    String(p.nome ?? '').toLowerCase() === 'taxa de entrega';
  const movementTypeRaw = String(
    (p as any).movement_type ?? (p as any).movementType ?? ''
  ).toUpperCase();
  const movementType =
    movementTypeRaw === 'SIMPLE' || movementTypeRaw === 'EXCHANGE' || movementTypeRaw === 'FULL'
      ? movementTypeRaw
      : (p as any).movement_type ?? null;
  const returnProductRaw =
    (p as any).return_product_id ?? (p as any).returnProductId ?? null;
  const returnProductId = movementType === 'EXCHANGE' ? returnProductRaw : null;

  // ✅ Usa formato frontend - depositoId será auto-convertido para deposit_id
  const frontendFormat = {
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    descricao: p.descricao ?? null,
    tipo: p.tipo ?? null,
    unidade: p.unidade ?? null,
    product_group: p.product_group ?? null,
    imagem_url: p.imagem_url ?? null,
    depositoId: (p as any).depositoId ?? (p as any).deposit_id ?? (p as any).deposito_id ?? null, // ✅ Auto-convertido
    preco_custo: p.preco_custo ?? 0,
    preco_venda: p.preco_venda ?? 0,
    preco_padrao: p.preco_padrao ?? 0,
    marcacao: p.marcacao ?? 0,
    tracks_empties: !!p.tracks_empties,
    track_stock: trackStock,
    type: productType,
    is_delivery_fee: isDeliveryFee,
    movement_type: movementType ?? null,
    return_product_id: returnProductId ?? null,
    ativo: !!p.ativo,
    created_at: p.created_at ?? null,
    updated_at: p.updated_at ?? null,
  };

  // 🔄 Variante: remove somente o vínculo (evita FK quando o vazio ainda não sincronizou)
  const payloadNoReturn = returnProductId
    ? ({ ...frontendFormat, return_product_id: null } as any)
    : null;

  // 🔄 Versão compatível sem campos novos
  const payloadCompat = { ...frontendFormat } as any;
  delete payloadCompat.track_stock;
  delete payloadCompat.type;
  delete payloadCompat.is_delivery_fee;
  delete payloadCompat.movement_type;
  delete payloadCompat.return_product_id;

  const currentStock =
    (p as any).current_stock ??
    (p as any).quantidade_atual ??
    null;

  const bases: AnyRow[] = payloadNoReturn ? [frontendFormat, payloadNoReturn, payloadCompat] : [frontendFormat, payloadCompat];

  const variants = currentStock !== null
    ? bases.flatMap((base) => [
        { ...base, current_stock: currentStock },
        { ...base, quantidade_atual: currentStock },
        base,
      ])
    : bases;

  return tryUpsert('products', variants);
}

export async function applyProductDelete(id: string) {
  return tryDelete('products', id);
}

// ----------------------- DEPOSITS (CORRIGIDO) -----------------------

export async function applyDepositUpsert(d: Deposit) {
  // 🔧 Aceita tanto português (nome, endereco, ativo, cor) quanto inglês (name, address, active, color)
  const name = (d as any).nome || (d as any).name || null;
  const address = (d as any).endereco || (d as any).address || null;
  const active = (d as any).ativo ?? (d as any).active ?? true;
  const color = (d as any).cor || (d as any).color || null;

  const payloadBase = {
    id: d.id,
    name: name,
    address: address,
    active: !!active,
    color: color,
    require_stock_audit: (d as any).require_stock_audit ?? (d as any).requireStockAudit ?? false,

    // Convertendo datas para string ISO (segurança contra erro 22008)
    // aceitar variantes de nomes de campo (compatibilidade)
    created_at: (d as any).created_at ?? (d as any).createdAt ?? null,
    updated_at: new Date().toISOString(),
  };

  const freeShippingRaw =
    (d as any).free_shipping_min_value ??
    (d as any).freeShippingMinValue ??
    (d as any).freeShippingMin ??
    null;
  const freeShipping = freeShippingRaw !== null && freeShippingRaw !== undefined
    ? Number(freeShippingRaw)
    : null;

  const variants =
    freeShipping !== null
      ? [
          { ...payloadBase, free_shipping_min_value: freeShipping },
          { ...payloadBase, freeShippingMinValue: freeShipping },
          payloadBase,
        ]
      : [payloadBase];

  return tryUpsert('deposits', variants);
}

export async function applyDepositDelete(id: string) {
  const { error } = await supabase.from('deposits').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------- EMPLOYEES -----------------------

export async function applyEmployeeUpsert(e: Colaborador) {
  // 🧹 Agora usamos apenas o formato frontend
  // O toSupabaseFormat() dentro do tryUpsert() fará a conversão automática
  const frontendFormat = {
    id: e.id,
    nome: e.nome,
    cargo: e.cargo,
    depositoId: e.depositoId, // ✅ Será convertido para deposit_id automaticamente
    ativo: e.ativo,
    telefone: e.telefone ?? null,
    username: e.username ?? null,
    password: e.password ?? null,
    permissoes: e.permissoes ?? [],
  };

  // Mantemos variações para casos onde o Supabase tem colunas diferentes
  const englishVariant = {
    id: e.id,
    name: e.nome,
    role: e.cargo,
    depositoId: e.depositoId, // ✅ Será convertido para deposit_id automaticamente
    active: e.ativo,
    phone: e.telefone ?? null,
    username: e.username ?? null,
    password: e.password ?? null,
    permissions: e.permissoes ?? [],
  };

  return tryUpsert('employees', [frontendFormat, englishVariant]);
}

export async function applyEmployeeDelete(id: string) {
  return tryDelete('employees', id);
}

// ----------------------- CLIENTS (CORRIGIDO E BLINDADO) -----------------------

export async function applyClientUpsert(c: any) {
  console.log('Sync Client Payload Recebido:', c);

  const rawName =
    c?.name ??
    c?.nome ??
    c?.clienteNome ??
    c?.customer_name ??
    c?.full_name ??
    '';
  const fallbackName =
    c?.phone ??
    c?.telefone ??
    c?.celular ??
    c?.address ??
    c?.endereco ??
    '';
  const name = String(rawName || fallbackName).trim();

  const deliveryZoneId =
    (c as any).deliveryZoneId ??
    (c as any).delivery_zone_id ??
    (c as any).zona_id ??
    (c as any).zone_id ??
    null;

  const payload: Record<string, any> = {
    id: c.id,
    name,
    phone: c.phone || c.telefone || c.celular,
    document: c.cpf || c.cnpj || c.document || c.documento,
    address: c.address || c.endereco || c.logradouro,
    depositoId: c.depositoId || c.deposito_id || c.deposit_id || null, // ✅ Será convertido por toSupabaseFormat
    created_at: c.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (deliveryZoneId) {
    payload.delivery_zone_id = deliveryZoneId;
  }

  if (!payload.name) {
    // Se não houver nome, tenta gerar um fallback razoável ao invés de abortar
    // Preferimos usar telefone (se disponível) para ajudar identificação humana
    const phoneFallback = payload.phone ? String(payload.phone).trim() : '';
    const idFallback = payload.id ? String(payload.id).slice(0, 8) : 'no-id';
    const fallbackName = phoneFallback ? `Cliente ${phoneFallback}` : `Unnamed Client ${idFallback}`;

    console.warn('AVISO: cliente sem nome. Usando fallback:', fallbackName, c);
    payload.name = fallbackName;
  }

  // 🧹 HIGIENIZAÇÃO: Aplica serialização reversa antes de enviar
  const cleanPayload = toSupabaseFormat(payload, 'clients');

  const res = await supabase.from('clients').upsert(cleanPayload).select().single();

  if (res.error) {
    console.error('Erro Supabase Client:', res.error);
    throw res.error;
  }
  return res.data;
}
export async function applyClientDelete(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------- CLIENT PRICE OVERRIDES -----------------------

export async function applyClientPriceOverrideUpsert(p: ClientePreco) {
  // ✅ Usa formato frontend - toSupabaseFormat converte automaticamente
  const frontendFormat = {
    id: p.id,
    clienteId: p.clienteId,
    produtoId: p.produtoId,
    depositoId: p.depositoId ?? null, // ✅ Auto-convertido para deposit_id
    modalidade: p.modalidade,
    precoEspecial: p.precoEspecial ?? null,
    ativo: p.ativo,
    atualizado_em: p.atualizado_em,
  };

  // 🔄 Versão em inglês como fallback para schemas antigos
  const englishSnake = {
    id: p.id,
    client_id: p.clienteId,
    product_id: p.produtoId,
    deposit_id: p.depositoId ?? null,
    modality: p.modalidade,
    override_price: p.precoEspecial ?? null,
    active: p.ativo,
    updated_at: p.atualizado_em,
  };

  return tryUpsert('client_price_overrides', [frontendFormat, englishSnake]);
}

export async function applyClientPriceOverrideDelete(id: string) {
  return tryDelete('client_price_overrides', id);
}

// ----------------------- CLIENT ONE TIME BENEFITS (CORRIGIDO) -----------------------

export async function applyClientOneTimeDiscountUpsert(d: ClienteDescontoPendente) {
  // Conversor seguro de data
  const toISO = (val: string | number | undefined | null) => {
    if (!val) return null;
    try { return new Date(val).toISOString(); } catch { return null; }
  };

  const payload = {
    id: d.id,
    client_id: d.clienteId,
    discount_type: d.tipoDesconto, // Ex: 'FIXED' ou 'PERCENTAGE'
    amount: d.valorDesconto ?? 0,
    status: d.usado ? 'USADO' : 'PENDENTE',
    
    created_at: toISO(d.criado_em),
    used_at: toISO(d.usado_em)
  };

  // MUDANÇA IMPORTANTE: Nome da tabela ajustado para 'client_one_time_benefits'
  const res = await supabase.from('client_one_time_benefits').upsert(payload).select().single();
  
  if (res.error) throw res.error;
  return res.data;
}

export async function applyClientOneTimeDiscountDelete(id: string) {
  // MUDANÇA IMPORTANTE: Nome da tabela ajustado aqui também
  const { error } = await supabase.from('client_one_time_benefits').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------- SERVICE ORDERS -----------------------

export async function applyServiceOrderUpsert(os: OrdemServico) {
  const deliveryFeeRaw =
    (os as any).delivery_fee ??
    (os as any).deliveryFee ??
    (os as any).deliveryFeeValue ??
    null;
  const deliveryFee =
    deliveryFeeRaw === null || deliveryFeeRaw === undefined
      ? null
      : Number(deliveryFeeRaw);

  // ✅ Usa formato frontend - depositoId será auto-convertido
  const frontendFormat = {
    id: os.id,
    numeroOs: os.numeroOs,
    depositoId: os.depositoId, // ✅ Auto-convertido para deposit_id
    clienteId: os.clienteId,
    clienteNome: os.clienteNome,
    clienteTelefone: os.clienteTelefone ?? null,
    enderecoEntrega: os.enderecoEntrega ?? null,
    latitude: os.latitude ?? null,
    longitude: os.longitude ?? null,
    status: os.status,
    statusEntrega: os.statusEntrega ?? null,
    tipoAtendimento: os.tipoAtendimento,
    entregadorId: os.entregadorId ?? null,
    observacoes: os.observacoes ?? null,
    total: os.total,
    dataHoraCriacao: os.dataHoraCriacao,
    updated_at: os.updated_at,
    dataHoraConclusao: os.dataHoraConclusao
      ? new Date(os.dataHoraConclusao).toISOString()
      : null,
    historico: os.historico ?? [],
    pagamentos: os.pagamentos ?? [],
  };

  // 🔄 Versão em inglês como fallback
  const englishSnake = {
    id: os.id,
    order_number: os.numeroOs,
    deposit_id: os.depositoId,
    client_id: os.clienteId,
    client_name: os.clienteNome,
    client_phone: os.clienteTelefone ?? null,
    delivery_address: os.enderecoEntrega ?? null,
    lat: os.latitude ?? null,
    lng: os.longitude ?? null,
    status: os.status,
    delivery_status: os.statusEntrega ?? null,
    service_type: os.tipoAtendimento,
    driver_id: os.entregadorId ?? null,
    notes: os.observacoes ?? null,
    total_amount: os.total,
    created_at_ms: os.dataHoraCriacao,
    updated_at_ms: os.updated_at,
    completed_at: os.dataHoraConclusao ? new Date(os.dataHoraConclusao).toISOString() : null,
    history: os.historico ?? [],
    payments: os.pagamentos ?? [],
  };

  const variants =
    deliveryFee !== null
      ? [
          { ...frontendFormat, deliveryFee },
          { ...englishSnake, delivery_fee: deliveryFee },
          frontendFormat,
          englishSnake,
        ]
      : [frontendFormat, englishSnake];

  // 1) Upsert OS
  await tryUpsert('service_orders', variants);

  // 2) Sync items (best-effort)
  const items: ItemOrdemServico[] = os.itens ?? [];

  // Deleta itens existentes
  await tryDeleteBy('service_order_items', ['os_id', 'osId', 'order_id', 'service_order_id'], os.id);

  // Insere itens
  const itemsSnakePt = items.map((it) => ({
    id: it.id,
    os_id: os.id,
    produto_id: it.produtoId,
    quantidade: it.quantidade,
    preco_unitario: it.precoUnitario,
    modalidade: it.modalidade,
    is_preco_especial: it.isPrecoEspecial ?? null,
  }));

  const itemsCamelPt = items.map((it) => ({
    id: it.id,
    osId: os.id,
    produtoId: it.produtoId,
    quantidade: it.quantidade,
    precoUnitario: it.precoUnitario,
    modalidade: it.modalidade,
    isPrecoEspecial: it.isPrecoEspecial ?? null,
  }));

  const itemsEnglish = items.map((it) => ({
    id: it.id,
    order_id: os.id,
    product_id: it.produtoId,
    qty: it.quantidade,
    unit_price: it.precoUnitario,
    modality: it.modalidade,
    is_special_price: it.isPrecoEspecial ?? null,
  }));

  await tryInsertMany('service_order_items', [itemsSnakePt, itemsCamelPt, itemsEnglish]);
}

export async function applyServiceOrderDelete(id: string) {
  await tryDeleteBy('service_order_items', ['os_id', 'osId', 'order_id', 'service_order_id'], id);
  return tryDelete('service_orders', id);
}

// ----------------------- STOCK MOVEMENTS (BLINDADO) -----------------------

export async function applyStockMovementUpsert(m: any) {
  const toISO = (val: string | number | undefined | null) => {
    if (!val) return new Date().toISOString();
    try { return new Date(val).toISOString(); } catch { return new Date().toISOString(); }
  };

  // Mapeia tipo PT para tipo EN (IN/OUT)
  const mapTipoToType = (tipo: string): string => {
    switch (tipo) {
      case 'ENTRADA':
      case 'SUPRIMENTO_ENTRADA':
      case 'CARGA_INICIAL':
      case 'AJUSTE_CONTAGEM': // Ajuste pode ser + ou -, mas registramos como IN
        return 'IN';
      case 'SAIDA':
      case 'SANGRIA_SAIDA':
        return 'OUT';
      default:
        return tipo === 'OUT' ? 'OUT' : 'IN';
    }
  };

  const tipoOriginal = m.tipo || m.type || 'IN';
  const typeEN = mapTipoToType(tipoOriginal);

  // ✅ Usa formato frontend - depositoId será auto-convertido
  const payload = {
    id: m.id,
    produtoId: m.produtoId || m.product_id || m.produto_id,
    depositoId: m.depositoId || m.deposit_id || m.deposito_id, // ✅ Auto-convertido
    
    // Tipo mapeado para EN (IN/OUT)
    type: typeEN,
    
    // Origem original (para rastreabilidade)
    origin: tipoOriginal,
    
    quantity: Number(m.quantity || m.quantidade || 0),
    reason: m.reason || m.motivo || 'Ajuste Manual',
    
    created_at: toISO(m.dataHora || m.data_hora || m.movement_date || m.created_at),
  };

  const cleanPayload = toSupabaseFormat(payload, 'stock_movements');
  const res = await supabase.from('stock_movements').upsert(cleanPayload).select().single();
  
  if (res.error) {
     console.error("Erro Sync Estoque:", res.error);
     throw res.error;
  }
  return res.data;
}

export async function applyStockMovementDelete(id: string) {
  const { error } = await supabase.from('stock_movements').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------- PAYMENT METHODS -----------------------

export async function applyPaymentMethodUpsert(p: PaymentMethod) {
  const payload = {
    id: p.id,
    name: p.name,
    receipt_type: p.receipt_type,
    default_due_days: p.default_due_days || 0,
    enters_receivables: !!p.enters_receivables,
    machine_label: p.machine_label,
    is_active: !!p.is_active,
    created_at: p.created_at,
    updated_at: new Date().toISOString(),
  };

  const res = await supabase.from('payment_methods').upsert(payload).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function applyPaymentMethodDelete(id: string) {
  return tryDelete('payment_methods', id);
}

// ----------------------- ACCOUNTS RECEIVABLE -----------------------

export async function applyAccountsReceivableUpsert(r: any) {
  // ✅ Usa formato frontend - depositoId será auto-convertido
  const frontendFormat = {
    id: r.id,
    sale_payment_id: r.os_id || r.sale_payment_id || null,
    payment_method_id: r.payment_method_id ?? null,
    client_id: r.client_id || r.cliente_id || null,
    depositoId: r.depositoId || r.deposit_id || r.deposito_id || null, // ✅ Auto-convertido
    description: r.description ?? null,
    due_date: r.vencimento_em
      ? new Date(r.vencimento_em).toISOString().split('T')[0]
      : r.due_date,
    amount: r.valor_total ?? r.amount ?? 0,
    paid_amount: r.valor_pago ?? r.paid_amount ?? 0,
    status: r.status,
    installment_no: r.installment_no ?? 1,
    installments_total: r.installments_total ?? 1,
    created_at: r.criado_em ?? r.created_at ?? null,
    updated_at: new Date().toISOString(),
    requires_boleto: (r as any).requires_boleto ?? (r as any).requiresBoleto ?? false,
    debtor_name: r.devedor_nome ?? r.debtor_name ?? null,
    is_personal: !!r.is_personal,
    alert_days_before: r.alert_days_before ?? null,
  };

  // 🔄 Versão simplificada
  const englishVariant = {
    ...frontendFormat,
    deposit_id: frontendFormat.depositoId, // Explícito para fallback
  };

  return tryUpsert('receivables', [frontendFormat, englishVariant]);
}

export async function applyAccountsReceivableDelete(id: string) {
  const { error } = await supabase.from('receivables').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------- RECEIVABLE PAYMENTS -----------------------

export async function applyReceivablePaymentUpsert(p: ReceivablePayment) {
  const snakePt = {
    id: p.id,
    receivable_id: p.receivable_id,
    valor: p.valor,
    data_hora: p.data_hora,
    usuario_id: p.usuario_id,
    payment_method_id: (p as any).payment_method_id ?? null,
    obs: (p as any).obs ?? null,
  };

  const camelPt = {
    id: p.id,
    receivableId: p.receivable_id,
    valor: p.valor,
    dataHora: p.data_hora,
    usuarioId: p.usuario_id,
  };

  const englishSnake = {
    id: p.id,
    receivable_id: p.receivable_id,
    amount: p.valor,
    occurred_at_ms: p.data_hora,
    user_id: p.usuario_id,
    payment_method_id: (p as any).payment_method_id ?? null,
    notes: (p as any).obs ?? null,
  };

  return tryUpsert('receivable_payments', [snakePt, camelPt, englishSnake]);
}

export async function applyReceivablePaymentDelete(id: string) {
  return tryDelete('receivable_payments', id);
}

// ----------------------- FINANCIAL SETTINGS -----------------------

type FinancialSettingsRow = {
  id: string;
  monthly_goal?: number;
  updated_at?: string | null;
};

export async function applyFinancialSettingsUpsert(row: FinancialSettingsRow) {
  const payload = {
    id: row.id,
    monthly_goal: Number(row.monthly_goal ?? 0),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };

  const res = await supabase.from('financial_settings').upsert(payload).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function applyFinancialSettingsDelete(id: string) {
  return tryDelete('financial_settings', id);
}

// ============================================================
// Despesas (expenses)
// ============================================================

// Função para converter data YYYY-MM-DD para ISO Date (para evitar erros de fuso)
const toDateOnly = (val: string | undefined | null) => {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val.includes('T')) return val.split('T')[0];
  return val;
};

// Função auxiliar para converter data/hora em ISO string seguro
const toISO = (val: string | number | undefined | null) => {
  if (!val) return null;
  try {
    return new Date(val).toISOString();
  } catch {
    return null;
  }
};

export async function applyExpenseUpsert(e: Expense) {
  const payload = {
    id: e.id,
    description: e.description,
    amount: e.amount || 0,
    due_date: toDateOnly(e.due_date), // Garante formato YYYY-MM-DD
    paid_date: toISO(e.paid_date),
    status: e.status,
    category: e.category,
    is_fixed: !!e.is_fixed,
    deposit_id: (e as any).deposit_id ?? (e as any).depositId ?? (e as any).depositoId ?? null,
    alert_days_before: e.alert_days_before || 0,
    created_at: toISO(e.created_at),
    updated_at: new Date().toISOString(),
  };

  const res = await supabase.from('expenses').upsert(payload).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function applyExpenseDelete(id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------- WORK SHIFTS -----------------------

export async function applyWorkShiftUpsert(row: WorkShift) {
  // ✅ Usa formato frontend - depositoId será auto-convertido
  const frontendFormat = {
    id: row.id,
    depositoId: row.depositoId ?? (row as any).deposit_id ?? (row as any).deposito_id ?? null, // ✅ Auto-convertido
    user_id: row.user_id ?? (row as any).userId ?? (row as any).usuario_id ?? null,
    user_name: row.user_name ?? (row as any).userName ?? (row as any).usuario_nome ?? null,
    status: row.status,
    opened_at: row.opened_at ?? (row as any).openedAt ?? (row as any).aberto_em ?? null,
    closed_at: row.closed_at ?? (row as any).closedAt ?? (row as any).fechado_em ?? null,
    opening_balance: row.opening_balance ?? (row as any).openingBalance ?? (row as any).fundo_troco ?? 0,
    closing_balance: row.closing_balance ?? (row as any).closingBalance ?? null,
    declared_cash: row.declared_cash ?? (row as any).declaredCash ?? null,
    declared_card: row.declared_card ?? (row as any).declaredCard ?? null,
    declared_pix: row.declared_pix ?? (row as any).declaredPix ?? null,
    system_cash: row.system_cash ?? (row as any).systemCash ?? null,
    system_card: row.system_card ?? (row as any).systemCard ?? null,
    system_pix: row.system_pix ?? (row as any).systemPix ?? null,
    notes: row.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  // 🔄 Fallback com variante em inglês
  const englishVariant = {
    ...frontendFormat,
    deposit_id: frontendFormat.depositoId,
  };

  return tryUpsert('work_shifts', [frontendFormat, englishVariant]);
}

export async function applyWorkShiftDelete(id: string) {
  return tryDelete('work_shifts', id);
}

// ----------------------- CASH FLOW ENTRIES -----------------------

export async function applyCashFlowEntryUpsert(row: CashFlowEntry) {
  // ✅ Usa formato frontend - depositoId será auto-convertido
  const frontendFormat = {
    id: row.id,
    shift_id: row.shift_id ?? (row as any).shiftId ?? null,
    depositoId: row.depositoId ?? (row as any).deposit_id ?? (row as any).deposito_id ?? null, // ✅ Auto-convertido
    user_id: row.user_id ?? (row as any).userId ?? null,
    user_name: row.user_name ?? (row as any).userName ?? null,
    category: row.category,
    direction: row.direction,
    amount: row.amount,
    status: row.status,
    created_at: row.created_at ?? (row as any).createdAt ?? null,
    reference_id: row.reference_id ?? (row as any).referenceId ?? null,
    reference_type: row.reference_type ?? (row as any).referenceType ?? null,
    payment_method_id: row.payment_method_id ?? (row as any).paymentMethodId ?? null,
    payment_type: row.payment_type ?? (row as any).paymentType ?? null,
    notes: row.notes ?? null,
    meta: row.meta ?? null,
  };

  // 🔄 Fallback com variante em inglês
  const englishVariant = {
    ...frontendFormat,
    deposit_id: frontendFormat.depositoId,
  };

  return tryUpsert('cash_flow_entries', [frontendFormat, englishVariant]);
}

export async function applyCashFlowEntryDelete(id: string) {
  return tryDelete('cash_flow_entries', id);
}

// ----------------------- SHIFT STOCK AUDITS -----------------------

export async function applyShiftStockAuditUpsert(row: ShiftStockAudit) {
  const payloadBase = {
    id: row.id,
    shift_id: row.shift_id ?? (row as any).shiftId ?? null,
    deposit_id: row.deposit_id ?? (row as any).depositId ?? null,
    product_id: row.product_id ?? (row as any).productId ?? null,
    counted_qty: row.counted_qty ?? (row as any).countedQty ?? 0,
    system_qty: row.system_qty ?? (row as any).systemQty ?? 0,
    diff_qty: row.diff_qty ?? (row as any).diffQty ?? 0,
    created_at: row.created_at ?? (row as any).createdAt ?? null,
    user_id: row.user_id ?? (row as any).userId ?? null,
  };

  const variants = [
    payloadBase,
    {
      ...payloadBase,
      shiftId: payloadBase.shift_id,
      depositId: payloadBase.deposit_id,
      productId: payloadBase.product_id,
      countedQty: payloadBase.counted_qty,
      systemQty: payloadBase.system_qty,
      diffQty: payloadBase.diff_qty,
      createdAt: payloadBase.created_at,
      userId: payloadBase.user_id,
    },
  ];

  return tryUpsert('shift_stock_audits', variants);
}

export async function applyShiftStockAuditDelete(id: string) {
  return tryDelete('shift_stock_audits', id);
}

// ----------------------- DELIVERY ZONES -----------------------

export async function applyDeliveryZoneUpsert(row: DeliveryZone) {
  const name = row.name ?? (row as any).nome ?? '';
  const feeRaw = row.fee ?? (row as any).price ?? (row as any).valor ?? 0;
  const depositId =
    (row as any).deposit_id ?? (row as any).depositId ?? (row as any).depositoId ?? null;
  const feeValue = Number(feeRaw) || 0;
  const colorValue = row.color ?? (row as any).cor ?? null;
  const mapPolygonValue =
    (row as any).map_polygon ?? (row as any).mapPolygon ?? null;
  const createdAt = (row as any).created_at ?? (row as any).createdAt ?? null;
  const updatedAt = new Date().toISOString();

  const variants = [
    {
      id: row.id,
      name,
      fee: feeValue,
      color: colorValue,
      deposit_id: depositId,
      map_polygon: mapPolygonValue,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      name,
      price: feeValue,
      color: colorValue,
      deposit_id: depositId,
      map_polygon: mapPolygonValue,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      name,
      fee: feeValue,
      color: colorValue,
      depositId: depositId,
      mapPolygon: mapPolygonValue,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      nome: name,
      valor: feeValue,
      cor: colorValue,
      deposito_id: depositId,
      map_polygon: mapPolygonValue,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      nome: name,
      taxa: feeValue,
      cor: colorValue,
      deposito_id: depositId,
      map_polygon: mapPolygonValue,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      name,
      deposit_id: depositId,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      nome: name,
      deposito_id: depositId,
      created_at: createdAt,
      updated_at: updatedAt,
    },
  ];

  return tryUpsert('delivery_zones', variants);
}

export async function applyDeliveryZoneDelete(id: string) {
  return tryDelete('delivery_zones', id);
}

// ----------------------- DELIVERY SECTORS -----------------------

export async function applyDeliverySectorUpsert(row: DeliverySector) {
  const name = row.name ?? (row as any).bairro ?? (row as any).nome ?? '';
  const zoneId = row.zone_id ?? (row as any).zoneId ?? (row as any).zona_id ?? null;
  const createdAt = (row as any).created_at ?? (row as any).createdAt ?? null;
  const updatedAt = new Date().toISOString();

  const variants = [
    {
      id: row.id,
      zone_id: zoneId,
      name,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      zoneId: zoneId,
      name,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      zona_id: zoneId,
      bairro: name,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    {
      id: row.id,
      zona_id: zoneId,
      nome: name,
      created_at: createdAt,
      updated_at: updatedAt,
    },
  ];

  return tryUpsert('delivery_zones', variants);
}

export async function applyDeliverySectorDelete(id: string) {
  return tryDelete('delivery_sectors', id);
}

// ----------------------- ZONE PRICING -----------------------

export async function applyZonePricingUpsert(row: ZonePricing) {
  const zoneId = row.zone_id ?? (row as any).zoneId ?? null;
  const depositId = row.depositoId ?? (row as any).deposit_id ?? (row as any).deposito_id ?? null; // ✅ Normalizar
  const priceValue =
    Number(row.price ?? (row as any).valor ?? (row as any).fee ?? 0) || 0;
  const createdAt = (row as any).created_at ?? (row as any).createdAt ?? null;
  const updatedAt = new Date().toISOString();
  const id = row.id ?? (zoneId && depositId ? `${depositId}:${zoneId}` : undefined);

  // ✅ Usa formato frontend - depositoId será auto-convertido
  const frontendFormat = {
    id,
    zone_id: zoneId,
    depositoId: depositId, // ✅ Auto-convertido para deposit_id por toSupabaseFormat
    price: priceValue,
    created_at: createdAt,
    updated_at: updatedAt,
  };

  // 🔄 Fallback sem ID para inserção
  const variantWithoutId = { ...frontendFormat };
  delete variantWithoutId.id;

  // Tenta por ID quando existir, e fallback para conflito composto
  const variants = [frontendFormat, variantWithoutId];
  try {
    return await tryUpsert('zone_pricing', variants, 'id');
  } catch (err) {
    return tryUpsert('zone_pricing', variants, 'zone_id,deposit_id');
  }
}

export async function applyZonePricingDelete(id: string) {
  return tryDelete('zone_pricing', id);
}

// ----------------------- PRODUCT PRICING -----------------------

export async function applyProductPricingUpsert(row: any) {
  const productId = row.productId ?? row.product_id ?? null;
  const depositId = row.depositoId ?? row.deposit_id ?? row.deposito_id ?? null;
  const priceValue = Number(row.price ?? row.valor ?? 0) || 0;
  const createdAt = row.created_at ?? row.createdAt ?? null;
  const updatedAt = new Date().toISOString();
  const id = row.id ?? (productId && depositId ? `${productId}:${depositId}` : undefined);

  // ✅ Formato frontend - será convertido automaticamente por toSupabaseFormat
  const frontendFormat = {
    id,
    productId,      // ✅ Auto-convertido para product_id
    depositoId: depositId,     // ✅ Auto-convertido para deposit_id
    price: priceValue,
    created_at: createdAt,
    updated_at: updatedAt,
  };

  // Fallback sem ID para inserção
  const variantWithoutId = { ...frontendFormat };
  delete variantWithoutId.id;

  try {
    return await tryUpsert('product_pricing', [frontendFormat, variantWithoutId], 'id');
  } catch (err) {
    // Fallback: unique constraint por product_id + deposit_id
    const supabaseFormat = {
      product_id: productId,
      deposit_id: depositId,
      price: priceValue,
      created_at: createdAt,
      updated_at: updatedAt,
    };
    return tryUpsert('product_pricing', [supabaseFormat], 'product_id,deposit_id');
  }
}

export async function applyProductPricingDelete(id: string) {
  return tryDelete('product_pricing', id);
}

// ----------------------- PRODUCT EXCHANGE RULES -----------------------

export async function applyProductExchangeRuleUpsert(row: any) {
  const productId = row.productId ?? row.product_id ?? null;
  const depositId = row.depositoId ?? row.deposit_id ?? row.deposito_id ?? null;
  const returnProductId = row.returnProductId ?? row.return_product_id ?? null;
  const createdAt = row.created_at ?? row.createdAt ?? null;
  const updatedAt = new Date().toISOString();
  const id = row.id ?? (productId && depositId ? `${productId}:${depositId}` : undefined);

  const frontendFormat = {
    id,
    productId,
    depositoId: depositId,
    returnProductId,
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const variantWithoutId = { ...frontendFormat };
  delete variantWithoutId.id;

  try {
    return await tryUpsert('product_exchange_rules', [frontendFormat, variantWithoutId], 'id');
  } catch (err) {
    const supabaseFormat = {
      product_id: productId,
      deposit_id: depositId,
      return_product_id: returnProductId,
      created_at: createdAt,
      updated_at: updatedAt,
    };
    return tryUpsert('product_exchange_rules', [supabaseFormat], 'product_id, deposit_id');
  }
}

export async function applyProductExchangeRuleDelete(id: string) {
  return tryDelete('product_exchange_rules', id);
}
