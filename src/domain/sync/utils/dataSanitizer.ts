/**
 * 🧹 DATA SANITIZER: Normalização Global de Campos
 * 
 * Problema Sistêmico:
 * O Supabase retorna múltiplas variações do mesmo campo (deposit_id, deposito_id, depositoId),
 * causando "dados sujos" no Dexie. Isso quebra o sistema multi-lojas porque o código não sabe
 * onde buscar o ID do depósito.
 * 
 * Solução:
 * Função universal que higieniza QUALQUER entidade, garantindo que o depositoId esteja no campo
 * correto (camelCase) e seja único.
 */

/**
 * Normaliza o campo depositoId de qualquer entidade
 * 
 * Busca o valor real em todas as variações possíveis e padroniza para `depositoId` (camelCase).
 * Remove campos legados para evitar confusão e economizar espaço.
 * 
 * @param entity - Qualquer objeto que possa ter um depositoId
 * @returns Cópia limpa do objeto com depositoId normalizado
 * 
 * @example
 * // Entrada suja:
 * { id: '1', deposit_id: null, deposito_id: 'DEP1', depositoId: null }
 * 
 * // Saída limpa:
 * { id: '1', depositoId: 'DEP1' }
 */
export function normalizeDepositId<T extends Record<string, any>>(entity: T): T {
  if (!entity || typeof entity !== 'object') {
    return entity;
  }

  // 1. 🔍 CAÇA AO TESOURO: Encontra o valor real
  // Prioridade: camelCase > PT snake > EN snake > outros
  const realDepositId = 
    entity.depositoId ||
    entity.deposito_id ||
    entity.deposit_id ||
    entity.depositId ||  // Variação alternativa
    null;

  // 2. 🧹 LIMPA O LIXO: Remove todas as variações
  const cleanEntity = { ...entity };
  delete cleanEntity.deposit_id;
  delete cleanEntity.deposito_id;
  delete cleanEntity.depositId; // Variação alternativa

  // 3. ✅ DEFINE O PADRÃO: depositoId (camelCase) é a única fonte da verdade
  (cleanEntity as any).depositoId = realDepositId;

  return cleanEntity as T;
}

/**
 * Normaliza campos de Depósito (Deposit)
 * 
 * Unifica múltiplas variações de campos:
 * - name/nome → nome (PT)
 * - address/endereco → endereco (PT)
 * - active/is_active/ativo → ativo (PT)
 * - color/cor → cor (PT)
 * 
 * @param deposit - Objeto Deposit potencialmente sujo
 * @returns Deposit limpo com campos padronizados
 * 
 * @example
 * // Entrada suja:
 * { id: '1', name: 'Dep A', nome: null, active: true, is_active: true, ativo: null }
 * 
 * // Saída limpa:
 * { id: '1', nome: 'Dep A', ativo: true }
 */
export function normalizeDeposit<T extends Record<string, any>>(deposit: T): T {
  if (!deposit || typeof deposit !== 'object') {
    return deposit;
  }

  const cleanDeposit = { ...deposit };

  // 🔍 NOME: name → nome (prioriza dados existentes)
  const realNome = deposit.nome || deposit.name || '';
  delete cleanDeposit.name;
  (cleanDeposit as any).nome = realNome;

  // 🔍 ENDEREÇO: address → endereco
  const realEndereco = deposit.endereco || deposit.address || '';
  delete cleanDeposit.address;
  if (realEndereco) (cleanDeposit as any).endereco = realEndereco;

  // 🔍 ATIVO: active/is_active → ativo
  const realAtivo = deposit.ativo ?? deposit.active ?? deposit.is_active ?? true;
  delete cleanDeposit.active;
  delete cleanDeposit.is_active;
  (cleanDeposit as any).ativo = Boolean(realAtivo);

  // 🔍 COR: color → cor
  const realCor = deposit.cor || deposit.color || null;
  delete cleanDeposit.color;
  (cleanDeposit as any).cor = realCor;

  return cleanDeposit as T;
}

/**
 * Normaliza campos de Colaborador (Employee)
 * 
 * Unifica múltiplas variações:
 * - name/nome → nome (PT)
 * - role/cargo → cargo (PT)
 * - active/is_active/ativo → ativo (PT)
 * - permissions/permissoes → permissoes (PT)
 * 
 * @param employee - Objeto Colaborador potencialmente sujo
 * @returns Colaborador limpo
 */
export function normalizeEmployee<T extends Record<string, any>>(employee: T): T {
  if (!employee || typeof employee !== 'object') {
    return employee;
  }

  const clean = { ...employee };

  // 🔍 NOME
  const realNome = employee.nome || employee.name || employee.username || '';
  delete clean.name;
  (clean as any).nome = realNome;

  // 🔍 CARGO: role → cargo
  const realCargo = employee.cargo || employee.role || '';
  delete clean.role;
  if (realCargo) (clean as any).cargo = realCargo;

  // 🔍 ATIVO
  const realAtivo = employee.ativo ?? employee.active ?? employee.is_active ?? true;
  delete clean.active;
  delete clean.is_active;
  (clean as any).ativo = Boolean(realAtivo);

  // 🔍 PERMISSÕES: permissions → permissoes
  const realPermissoes = employee.permissoes || employee.permissions || [];
  delete clean.permissions;
  (clean as any).permissoes = Array.isArray(realPermissoes) ? realPermissoes : [];

  // 🔍 depositoId
  return normalizeDepositId(clean);
}

/**
 * Normaliza campos de Cliente (Client)
 * 
 * Unifica múltiplas variações:
 * - name/nome → nome (PT)
 * - address/endereco → endereco (PT)
 * - phone/telefone → telefone (PT)
 * - active/ativo → ativo (PT)
 * - delivery_zone_id/deliveryZoneId → deliveryZoneId (PT camelCase)
 * 
 * @param client - Objeto Cliente potencialmente sujo
 * @returns Cliente limpo
 */
export function normalizeClient<T extends Record<string, any>>(client: T): T {
  if (!client || typeof client !== 'object') {
    return client;
  }

  const clean = { ...client };

  // 🔍 NOME
  const realNome = client.nome || client.name || '';
  delete clean.name;
  (clean as any).nome = realNome;

  // 🔍 ENDEREÇO
  const realEndereco = client.endereco || client.address || '';
  delete clean.address;
  (clean as any).endereco = realEndereco;

  // 🔍 TELEFONE
  const realTelefone = client.telefone || client.phone || '';
  delete clean.phone;
  if (realTelefone) (clean as any).telefone = realTelefone;

  // 🔍 ATIVO
  const realAtivo = client.ativo ?? client.active ?? client.is_active ?? true;
  delete clean.active;
  delete clean.is_active;
  (clean as any).ativo = Boolean(realAtivo);

  // 🔍 ZONA DE ENTREGA: delivery_zone_id → deliveryZoneId
  const realZoneId = client.deliveryZoneId || client.delivery_zone_id || client.zona_entrega_id || null;
  delete clean.delivery_zone_id;
  delete clean.zona_entrega_id;
  (clean as any).deliveryZoneId = realZoneId;

  return normalizeDepositId(clean);
}

/**
 * Normaliza campos de Produto (Product)
 * 
 * Unifica múltiplas variações:
 * - name/nome → nome (PT)
 * - active/ativo → ativo (PT)
 * - price/preco_venda → preco_venda (PT snake_case - exceção histórica)
 * 
 * @param product - Objeto Produto potencialmente sujo
 * @returns Produto limpo
 */
export function normalizeProduct<T extends Record<string, any>>(product: T): T {
  if (!product || typeof product !== 'object') {
    return product;
  }

  const clean = { ...product };

  // 🔍 NOME
  const realNome = product.nome || product.name || '';
  delete clean.name;
  (clean as any).nome = realNome;

  // 🔍 ATIVO
  const realAtivo = product.ativo ?? product.active ?? product.is_active ?? true;
  delete clean.active;
  delete clean.is_active;
  (clean as any).ativo = Boolean(realAtivo);

  // 🔍 TIPO: type → tipo (exceto quando é 'SERVICE')
  if (product.tipo === undefined && product.type) {
    (clean as any).tipo = product.type;
  }

  return normalizeDepositId(clean);
}

/**
 * Normaliza campos de Zona de Entrega (DeliveryZone)
 * 
 * Unifica múltiplas variações:
 * - name/nome → nome (PT)
 * - color/cor → cor (PT)
 * 
 * @param zone - Objeto DeliveryZone potencialmente sujo
 * @returns DeliveryZone limpo
 */
export function normalizeDeliveryZone<T extends Record<string, any>>(zone: T): T {
  if (!zone || typeof zone !== 'object') {
    return zone;
  }

  const clean = { ...zone };

  // 🔍 NOME
  const realNome = zone.nome || zone.name || '';
  delete clean.name;
  (clean as any).nome = realNome;

  // 🔍 COR
  const realCor = zone.cor || zone.color || '';
  delete clean.color;
  if (realCor) (clean as any).cor = realCor;

  // ⚠️ Zonas são SEMPRE globais: depositoId = null
  (clean as any).depositoId = null;
  delete clean.deposit_id;
  delete clean.deposito_id;

  return clean as T;
}

/**
 * Normaliza depositoId em um array de entidades
 * 
 * @param entities - Array de entidades para normalizar
 * @returns Array com todas as entidades normalizadas
 * 
 * @example
 * const cleanClients = normalizeBatch(dirtyClients);
 */
export function normalizeBatch<T extends Record<string, any>>(entities: T[]): T[] {
  if (!Array.isArray(entities)) {
    return entities;
  }
  return entities.map(normalizeDepositId);
}

/**
 * Verifica se uma entidade tem depositoId válido
 * 
 * @param entity - Entidade para verificar
 * @returns true se tiver depositoId preenchido (não null/undefined/vazio)
 */
export function hasValidDepositId(entity: any): boolean {
  const depositId = entity?.depositoId || entity?.deposito_id || entity?.deposit_id;
  return Boolean(depositId && String(depositId).trim());
}

/**
 * Tabelas que DEVEM ter depositoId
 * (entidades de escopo local, não global)
 */
export const DEPOSIT_SCOPED_TABLES = [
  'products',
  'stock_movements',
  'service_orders',
  'work_shifts',
  'cash_flow_entries',
  'stock_balance',
  'zone_pricing'  // ✅ Preços por zona são depot-scoped
];

/**
 * Tabelas que PODEM ter depositoId null
 * (entidades globais ou híbridas)
 */
export const GLOBAL_TABLES = [
  'clients',           // Clientes são compartilhados
  'delivery_zones',    // Zonas são globais (preço é local)
  'payment_methods'    // Formas de pagamento podem ser globais
];

/**
 * Verifica se uma tabela requer depositoId obrigatório
 * 
 * @param tableName - Nome da tabela
 * @returns true se a tabela requer depositoId
 */
export function requiresDepositId(tableName: string): boolean {
  return DEPOSIT_SCOPED_TABLES.includes(tableName);
}

/**
 * 🔄 SERIALIZAÇÃO REVERSA: Frontend → Supabase
 * 
 * Converte entidade do formato do frontend (PT camelCase) para o formato do Supabase (EN snake_case).
 * Garante que TODOS os campos sejam traduzidos corretamente antes do envio.
 * 
 * ⚠️ CRÍTICO: Use esta função ANTES de enviar dados para o Supabase!
 * 
 * MAPEAMENTO COMPLETO (10 entidades da Lei Magna):
 * 
 * 1. DEPOSIT: nome→name, endereco→address, ativo→is_active, cor→color
 * 2. COLABORADOR: nome→name, cargo→role, ativo→is_active, permissoes→permissions
 * 3. CLIENTE: nome→name, endereco→address, telefone→phone, ativo→is_active, deliveryZoneId→delivery_zone_id
 * 4. PRODUTO: nome→name, ativo→is_active, depositoId→deposit_id
 * 5. ORDEM_SERVICO: depositoId→deposit_id, clienteId→client_id, entregadorId→driver_id
 * 6. MOVIMENTO_ESTOQUE: depositoId→deposit_id, produtoId→product_id, usuarioId→user_id
 * 7. WORK_SHIFT: depositoId→deposit_id
 * 8. DELIVERY_ZONE: nome→name, cor→color (depositoId SEMPRE null)
 * 9. ZONE_PRICING: depositoId→deposit_id
 * 10. EXPENSE: depositoId→deposit_id
 * 
 * @param localEntity - Entidade no formato do frontend
 * @param tableName - Nome da tabela (para aplicar regras específicas)
 * @returns Payload limpo no formato esperado pelo Supabase
 * 
 * @example
 * const frontendProduct = { id: '1', nome: 'Produto', depositoId: 'DEP1', ativo: true };
 * const supabasePayload = toSupabaseFormat(frontendProduct, 'products');
 * // { id: '1', name: 'Produto', deposit_id: 'DEP1', is_active: true }
 */
export function toSupabaseFormat(localEntity: any, tableName?: string): any {
  if (!localEntity || typeof localEntity !== 'object') {
    return localEntity;
  }

  // Cria uma cópia para não alterar o estado local
  const payload = { ...localEntity };

  // 🔄 TRADUÇÃO UNIVERSAL: depositoId → deposit_id
  if (payload.depositoId !== undefined) {
    payload.deposit_id = payload.depositoId; // ✅ Formato Supabase
    delete payload.depositoId; // ❌ Remove formato frontend
    delete payload.deposito_id; // ❌ Remove variação legacy PT
  }

  // 🔄 TRADUÇÕES POR ENTIDADE

  // ═══════════════════════════════════════════════════════════════
  // 1️⃣ DEPOSITS (Depósito/Loja)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'deposits') {
    if (payload.nome !== undefined) {
      payload.name = payload.nome;
      delete payload.nome;
    }
    if (payload.endereco !== undefined) {
      payload.address = payload.endereco;
      delete payload.endereco;
    }
    if (payload.ativo !== undefined) {
      payload.is_active = payload.ativo;
      payload.active = payload.ativo; // Supabase aceita ambos
      delete payload.ativo;
    }
    if (payload.cor !== undefined) {
      payload.color = payload.cor;
      delete payload.cor;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2️⃣ EMPLOYEES (Colaborador)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'employees') {
    if (payload.nome !== undefined) {
      payload.name = payload.nome;
      delete payload.nome;
    }
    if (payload.cargo !== undefined) {
      payload.role = payload.cargo;
      delete payload.cargo;
    }
    if (payload.ativo !== undefined) {
      payload.is_active = payload.ativo;
      payload.active = payload.ativo;
      delete payload.ativo;
    }
    if (payload.permissoes !== undefined) {
      payload.permissions = payload.permissoes;
      delete payload.permissoes;
    }
    if (payload.telefone !== undefined) {
      payload.phone = payload.telefone;
      delete payload.telefone;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3️⃣ CLIENTS (Cliente)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'clients') {
    if (payload.nome !== undefined) {
      payload.name = payload.nome;
      delete payload.nome;
    }
    if (payload.endereco !== undefined) {
      payload.address = payload.endereco;
      delete payload.endereco;
    }
    if (payload.telefone !== undefined) {
      payload.phone = payload.telefone;
      delete payload.telefone;
    }
    if (payload.ativo !== undefined) {
      payload.is_active = payload.ativo;
      payload.active = payload.ativo;
      delete payload.ativo;
    }
    if (payload.deliveryZoneId !== undefined) {
      payload.delivery_zone_id = payload.deliveryZoneId;
      delete payload.deliveryZoneId;
    }
    if (payload.dataNascimento !== undefined) {
      payload.birth_date = payload.dataNascimento;
      delete payload.dataNascimento;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4️⃣ PRODUCTS (Produto)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'products') {
    // Aliases/campos legados (PT/camelCase) -> snake_case (Supabase)
    if (payload.returnProductId !== undefined && payload.return_product_id === undefined) {
      payload.return_product_id = payload.returnProductId;
      delete payload.returnProductId;
    }
    if (payload.produtoCascoId !== undefined && payload.return_product_id === undefined) {
      payload.return_product_id = payload.produtoCascoId;
      delete payload.produtoCascoId;
    }
    if (payload.produto_casco_id !== undefined && payload.return_product_id === undefined) {
      payload.return_product_id = payload.produto_casco_id;
      delete payload.produto_casco_id;
    }
    if (payload.movimento_tipo !== undefined && payload.movement_type === undefined) {
      payload.movement_type = payload.movimento_tipo;
      delete payload.movimento_tipo;
    }
    if (payload.movimentoTipo !== undefined && payload.movement_type === undefined) {
      payload.movement_type = payload.movimentoTipo;
      delete payload.movimentoTipo;
    }
    if (payload.trackStock !== undefined && payload.track_stock === undefined) {
      payload.track_stock = payload.trackStock;
      delete payload.trackStock;
    }
    if (payload.isDeliveryFee !== undefined && payload.is_delivery_fee === undefined) {
      payload.is_delivery_fee = payload.isDeliveryFee;
      delete payload.isDeliveryFee;
    }
    if (payload.productGroup !== undefined && payload.product_group === undefined) {
      payload.product_group = payload.productGroup;
      delete payload.productGroup;
    }
    if (payload.tracksEmpties !== undefined && payload.tracks_empties === undefined) {
      payload.tracks_empties = payload.tracksEmpties;
      delete payload.tracksEmpties;
    }
    if (payload.imagemUrl !== undefined && payload.imagem_url === undefined) {
      payload.imagem_url = payload.imagemUrl;
      delete payload.imagemUrl;
    }
    if (payload.precoVenda !== undefined && payload.preco_venda === undefined) {
      payload.preco_venda = payload.precoVenda;
      delete payload.precoVenda;
    }
    if (payload.precoCusto !== undefined && payload.preco_custo === undefined) {
      payload.preco_custo = payload.precoCusto;
      delete payload.precoCusto;
    }
    if (payload.precoTroca !== undefined && payload.preco_troca === undefined) {
      payload.preco_troca = payload.precoTroca;
      delete payload.precoTroca;
    }
    if (payload.precoCompleta !== undefined && payload.preco_completa === undefined) {
      payload.preco_completa = payload.precoCompleta;
      delete payload.precoCompleta;
    }

    // Nome e código
    if (payload.nome !== undefined) {
      payload.name = payload.nome;
      delete payload.nome;
    }
    if (payload.codigo !== undefined) {
      payload.code = payload.codigo;
      delete payload.codigo;
    }
    
    // Status ativo
    if (payload.ativo !== undefined) {
      payload.is_active = payload.ativo;
      payload.active = payload.ativo;
      delete payload.ativo;
    }
    
    // Descrição
    if (payload.descricao !== undefined) {
      payload.description = payload.descricao;
      delete payload.descricao;
    }
    
    // Tipo - SEMPRE converter e remover o campo em português
    if (payload.tipo !== undefined) {
      payload.type = payload.type ?? payload.tipo;
      delete payload.tipo;
    }
    
    // Unidade
    if (payload.unidade !== undefined) {
      payload.unit = payload.unidade;
      delete payload.unidade;
    }
    
    // Imagem
    if (payload.imagem_url !== undefined) {
      payload.image_url = payload.imagem_url;
      delete payload.imagem_url;
    }
    
    // Preços
    if (payload.preco_custo !== undefined) {
      payload.cost_price = payload.preco_custo;
      delete payload.preco_custo;
    }
    if (payload.preco_venda !== undefined) {
      payload.sale_price = payload.preco_venda;
      delete payload.preco_venda;
    }
    if (payload.preco_padrao !== undefined) {
      payload.sale_price = payload.sale_price ?? payload.preco_padrao;
      delete payload.preco_padrao;
    }
    if (payload.preco_troca !== undefined) {
      payload.exchange_price = payload.preco_troca;
      delete payload.preco_troca;
    }
    if (payload.preco_completa !== undefined) {
      payload.full_price = payload.preco_completa;
      delete payload.preco_completa;
    }
    
    // Markup/Marcação
    if (payload.marcacao !== undefined) {
      payload.markup = payload.marcacao;
      delete payload.marcacao;
    }
    
    // Grupo de produto
    if (payload.product_group !== undefined) {
      // Já está em inglês, manter
    }
    
    // Rastreia estoque
    if (payload.tracks_empties !== undefined) {
      // Já está em inglês, manter
    }
    
    // ⚠️ Campos que NÃO devem ir para o Supabase (são calculados ou locais)
    delete payload.current_stock;      // Saldo é calculado via stock_movements
    delete payload.quantidade_atual;   // Alias de current_stock
    delete payload.estoque_atual;      // Alias de current_stock
    
    // ⚠️ Garantir que campos em português foram removidos
    delete payload.tipo;               // Deve ser 'type'
    delete payload.nome;               // Deve ser 'name'
    delete payload.ativo;              // Deve ser 'is_active'
    delete payload.descricao;          // Deve ser 'description'
    delete payload.unidade;            // Deve ser 'unit'
    delete payload.marcacao;           // Deve ser 'markup'
    delete payload.preco_venda;        // Deve ser 'sale_price'
    delete payload.preco_custo;        // Deve ser 'cost_price'
    delete payload.preco_padrao;       // Deve ser 'sale_price'
    delete payload.preco_troca;        // Deve ser 'exchange_price'
    delete payload.preco_completa;     // Deve ser 'full_price'
  }

  // ═══════════════════════════════════════════════════════════════
  // 5️⃣ SERVICE_ORDERS (Ordem de Serviço)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'service_orders') {
    if (payload.clienteId !== undefined) {
      payload.client_id = payload.clienteId;
      delete payload.clienteId;
    }
    if (payload.clienteNome !== undefined) {
      payload.client_name = payload.clienteNome;
      delete payload.clienteNome;
    }
    if (payload.clienteTelefone !== undefined) {
      payload.client_phone = payload.clienteTelefone;
      delete payload.clienteTelefone;
    }
    if (payload.entregadorId !== undefined) {
      payload.driver_id = payload.entregadorId;
      delete payload.entregadorId;
    }
    if (payload.entregadorNome !== undefined) {
      payload.driver_name = payload.entregadorNome;
      delete payload.entregadorNome;
    }
    if (payload.enderecoEntrega !== undefined) {
      payload.delivery_address = payload.enderecoEntrega;
      delete payload.enderecoEntrega;
    }
    if (payload.numeroOs !== undefined) {
      payload.order_number = payload.numeroOs;
      delete payload.numeroOs;
    }
    if (payload.valorTotal !== undefined) {
      payload.total_value = payload.valorTotal;
      delete payload.valorTotal;
    }
    if (payload.descontoValor !== undefined) {
      payload.discount_value = payload.descontoValor;
      delete payload.descontoValor;
    }
    // Tipo de Atendimento
    if (payload.tipoAtendimento !== undefined) {
      payload.service_type = payload.tipoAtendimento;
      delete payload.tipoAtendimento;
    }
    // Status da entrega
    if (payload.statusEntrega !== undefined) {
      payload.delivery_status = payload.statusEntrega;
      delete payload.statusEntrega;
    }
    // Taxa de entrega
    if (payload.taxaEntrega !== undefined) {
      payload.delivery_fee = payload.taxaEntrega;
      delete payload.taxaEntrega;
    }
    // Zona de entrega
    if (payload.zonaId !== undefined) {
      payload.zone_id = payload.zonaId;
      delete payload.zonaId;
    }
    // Setor de entrega
    if (payload.setorId !== undefined) {
      payload.sector_id = payload.setorId;
      delete payload.setorId;
    }
    // Timestamps
    if (payload.dataHoraCriacao !== undefined) {
      payload.created_at = payload.dataHoraCriacao;
      delete payload.dataHoraCriacao;
    }
    if (payload.dataHoraConclusao !== undefined) {
      payload.completed_at = payload.dataHoraConclusao;
      delete payload.dataHoraConclusao;
    }
    // Operador
    if (payload.operadorId !== undefined) {
      payload.operator_id = payload.operadorId;
      delete payload.operadorId;
    }
    if (payload.operadorNome !== undefined) {
      payload.operator_name = payload.operadorNome;
      delete payload.operadorNome;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 6️⃣ STOCK_MOVEMENTS (Movimento de Estoque)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'stock_movements') {
    if (payload.produtoId !== undefined) {
      payload.product_id = payload.produtoId;
      delete payload.produtoId;
    }
    if (payload.produtoNome !== undefined) {
      payload.product_name = payload.produtoNome;
      delete payload.produtoNome;
    }
    if (payload.usuarioId !== undefined) {
      payload.user_id = payload.usuarioId;
      delete payload.usuarioId;
    }
    if (payload.usuarioNome !== undefined) {
      payload.user_name = payload.usuarioNome;
      delete payload.usuarioNome;
    }
    if (payload.dataHora !== undefined) {
      payload.created_at = payload.dataHora;
      delete payload.dataHora;
      delete payload.timestamp; // Remove se existir
    }
    if (payload.referenciaId !== undefined) {
      payload.reference_id = payload.referenciaId;
      delete payload.referenciaId;
    }
    // Mapeamentos adicionais para stock_movements
    if (payload.quantidade !== undefined) {
      payload.quantity = payload.quantidade;
      delete payload.quantidade;
    }
    if (payload.motivo !== undefined && payload.reason === undefined) {
      payload.reason = payload.motivo;
      delete payload.motivo;
    }
    if (payload.tipo !== undefined && payload.origin === undefined) {
      payload.origin = payload.tipo; // Guarda o tipo original
      delete payload.tipo;
    }
    // Remove campos que não existem na tabela Supabase
    delete payload.meta;
    delete payload.origem;
  }

  // ═══════════════════════════════════════════════════════════════
  // 6.1 SERVICE_ORDER_ITEMS (Itens da Ordem de Serviço)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'service_order_items') {
    if (payload.ordemServicoId !== undefined) {
      payload.service_order_id = payload.ordemServicoId;
      delete payload.ordemServicoId;
    }
    if (payload.produtoId !== undefined) {
      payload.product_id = payload.produtoId;
      delete payload.produtoId;
    }
    if (payload.produtoNome !== undefined) {
      payload.product_name = payload.produtoNome;
      delete payload.produtoNome;
    }
    if (payload.quantidade !== undefined) {
      payload.quantity = payload.quantidade;
      delete payload.quantidade;
    }
    if (payload.precoUnitario !== undefined) {
      payload.unit_price = payload.precoUnitario;
      delete payload.precoUnitario;
    }
    if (payload.subtotal !== undefined) {
      // já está em inglês
    }
    // ⚠️ CRÍTICO: sale_movement_type (escolhido na venda)
    // Já está em inglês, não precisa traduzir
  }

  // ═══════════════════════════════════════════════════════════════
  // 6.2 SERVICE_ORDER_PAYMENTS (Pagamentos da OS)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'service_order_payments') {
    if (payload.ordemServicoId !== undefined) {
      payload.service_order_id = payload.ordemServicoId;
      delete payload.ordemServicoId;
    }
    if (payload.formaPagamento !== undefined) {
      payload.payment_method = payload.formaPagamento;
      delete payload.formaPagamento;
    }
    if (payload.valor !== undefined) {
      payload.amount = payload.valor;
      delete payload.valor;
    }
    if (payload.bandeira !== undefined) {
      payload.card_brand = payload.bandeira;
      delete payload.bandeira;
    }
    if (payload.nsu !== undefined) {
      // já está em inglês
    }
    if (payload.maquinaId !== undefined) {
      payload.machine_id = payload.maquinaId;
      delete payload.maquinaId;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7️⃣ WORK_SHIFTS (Turno de Trabalho)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'work_shifts') {
    if (payload.usuarioId !== undefined) {
      payload.user_id = payload.usuarioId;
      delete payload.usuarioId;
    }
    if (payload.usuarioNome !== undefined) {
      payload.user_name = payload.usuarioNome;
      delete payload.usuarioNome;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 8️⃣ DELIVERY_ZONES (Zona de Entrega)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'delivery_zones') {
    if (payload.nome !== undefined) {
      payload.name = payload.nome;
      delete payload.nome;
    }
    if (payload.cor !== undefined) {
      payload.color = payload.cor;
      delete payload.cor;
    }
    // ⚠️ CRÍTICO: Zonas são SEMPRE globais
    payload.deposit_id = null;
    delete payload.depositoId;
    delete payload.deposito_id;
  }

  // ═══════════════════════════════════════════════════════════════
  // 9️⃣ ZONE_PRICING (Precificação de Zona)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'zone_pricing') {
    if (payload.zonaId !== undefined) {
      payload.zone_id = payload.zonaId;
      delete payload.zonaId;
    }
    if (payload.preco !== undefined) {
      payload.price = payload.preco;
      delete payload.preco;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 🔟 EXPENSES (Despesa)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'expenses') {
    if (payload.descricao !== undefined) {
      payload.description = payload.descricao;
      delete payload.descricao;
    }
    if (payload.valor !== undefined) {
      payload.amount = payload.valor;
      delete payload.valor;
    }
    if (payload.categoria !== undefined) {
      payload.category = payload.categoria;
      delete payload.categoria;
    }
    if (payload.dataPagamento !== undefined) {
      payload.paid_date = payload.dataPagamento;
      delete payload.dataPagamento;
    }
    if (payload.dataVencimento !== undefined) {
      payload.due_date = payload.dataVencimento;
      delete payload.dataVencimento;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 1️⃣1️⃣ zone_pricing (Precificação de Produtos por Depósito)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'zone_pricing') {
    if (payload.productId !== undefined) {
      payload.product_id = payload.productId;
      delete payload.productId;
    }
    if (payload.preco !== undefined) {
      payload.price = payload.preco;
      delete payload.preco;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 1️⃣2️⃣ PRODUCT_EXCHANGE_RULES (Vinculação Cheio ↔️ Vazio por Depósito)
  // ═══════════════════════════════════════════════════════════════
  if (tableName === 'product_exchange_rules') {
    if (payload.productId !== undefined) {
      payload.product_id = payload.productId;
      delete payload.productId;
    }
    if (payload.depositoId !== undefined) {
      payload.deposit_id = payload.depositoId;
      delete payload.depositoId;
    }
    if (payload.returnProductId !== undefined) {
      payload.return_product_id = payload.returnProductId;
      delete payload.returnProductId;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 🔄 TRADUÇÕES UNIVERSAIS (aplicam-se a múltiplas tabelas)
  // ═══════════════════════════════════════════════════════════════
  
  // Ativo (quase todas as tabelas)
  if (payload.ativo !== undefined && payload.is_active === undefined && !tableName?.includes('deposits')) {
    payload.is_active = payload.ativo;
    payload.active = payload.ativo;
    delete payload.ativo;
  }

  return payload;
}

/**
 * Converte batch de entidades para formato Supabase
 * 
 * @param entities - Array de entidades frontend
 * @param tableName - Nome da tabela
 * @returns Array formatado para Supabase
 */
export function toSupabaseBatch(entities: any[], tableName?: string): any[] {
  if (!Array.isArray(entities)) {
    return entities;
  }
  return entities.map(entity => toSupabaseFormat(entity, tableName));
}
