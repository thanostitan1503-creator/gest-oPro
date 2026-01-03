import {
  db,
  generateId,
  ClienteEntity,
  ClientPriceOverride,
  ClientOneTimeDiscount,
} from '../db';
import { Cliente, ClienteDescontoPendente, ClientePreco, DepositoFisicoId, ModalidadeItem } from '../types';
import { enqueueOutboxEvent } from '../sync/outbox';
import { normalizeDepositId } from '../../src/domain_old/utils/dataSanitizer';

// Map between wire entity and domain Cliente (adds ativo bool default)
const toDomain = (c: ClienteEntity): Cliente => {
  // 🧹 HIGIENIZAR depositoId ao converter para domínio
  const clean = normalizeDepositId(c);
  
  return {
    id: clean.id,
    nome: clean.nome,
    endereco: clean.endereco,
    referencia: clean.referencia,
    cpf: clean.cpf,
    dataNascimento: clean.aniversario,
    telefone: clean.telefone,
    deliveryZoneId: (clean as any).delivery_zone_id ?? (clean as any).deliveryZoneId ?? null,
    depositoId: clean.depositoId, // ✅ Campo higienizado
    ativo: clean.ativo ?? true,
    criado_em: clean.criado_em,
    atualizado_em: clean.atualizado_em,
  };
};

const fromDomain = (c: Cliente): ClienteEntity => {
  // 🧹 HIGIENIZAR depositoId ao converter de domínio
  const clean = normalizeDepositId(c);
  
  return {
    id: clean.id,
    nome: clean.nome,
    endereco: clean.endereco,
    referencia: clean.referencia,
    cpf: clean.cpf,
    aniversario: clean.dataNascimento,
    telefone: clean.telefone,
    ativo: clean.ativo,
    delivery_zone_id: (clean as any).deliveryZoneId ?? (clean as any).delivery_zone_id ?? null,
    depositoId: clean.depositoId, // ✅ Campo higienizado
    criado_em: clean.criado_em,
    atualizado_em: clean.atualizado_em,
  };
};

export async function listClients(): Promise<Cliente[]> {
  const rows = await db.clients.toArray();
  return rows.map(toDomain);
}

export async function upsertClient(client: Omit<Cliente, 'id'> & { id?: string }) {
  const id = client.id || generateId();
  const row: ClienteEntity = {
    id,
    nome: client.nome,
    endereco: client.endereco,
    referencia: client.referencia,
    cpf: client.cpf,
    aniversario: client.dataNascimento,
    telefone: client.telefone,
    ativo: (client as any).ativo ?? true,
    delivery_zone_id: (client as any).deliveryZoneId ?? (client as any).delivery_zone_id ?? null,
    criado_em: client.criado_em ?? Date.now(),
    atualizado_em: Date.now(),
  };

  await db.transaction('rw', db.clients, db.outbox_events, async () => {
    await db.clients.put(row);
    await enqueueOutboxEvent({
      entity: 'clients',
      action: 'UPSERT',
      entity_id: row.id,
      payload_json: toDomain(row),
    });
  });

  return toDomain(row);
}

export async function deleteClient(id: string) {
  await db.transaction('rw', db.clients, db.outbox_events, async () => {
    await db.clients.delete(id);
    await enqueueOutboxEvent({
      entity: 'clients',
      action: 'DELETE',
      entity_id: id,
    });
  });
}

// --- CLIENT PRICE OVERRIDES ---

const priceToDomain = (r: ClientPriceOverride): ClientePreco => ({
  id: r.id,
  clienteId: r.client_id,
  produtoId: r.product_id,
  depositoId: (r as any).deposit_id ?? null,
  modalidade: r.modalidade as ModalidadeItem,
  precoEspecial: r.preco_override,
  ativo: true,
  atualizado_em: r.atualizado_em,
});

const priceFromDomain = (p: ClientePreco): ClientPriceOverride & { deposit_id?: DepositoFisicoId | null } => ({
  id: p.id,
  client_id: p.clienteId,
  product_id: p.produtoId,
  modalidade: p.modalidade,
  preco_override: p.precoEspecial ?? null,
  atualizado_em: p.atualizado_em,
  deposit_id: p.depositoId ?? null,
});

export async function listClientPrices(): Promise<ClientePreco[]> {
  const rows = await db.client_price_overrides.toArray();
  return rows.map(priceToDomain);
}

export async function upsertClientPrice(price: ClientePreco) {
  const now = Date.now();
  const entity: ClientePreco = {
    ...price,
    id: price.id || generateId(),
    ativo: price.ativo ?? true,
    atualizado_em: price.atualizado_em ?? now,
  };

  const row = priceFromDomain(entity);

  await db.transaction('rw', db.client_price_overrides, db.outbox_events, async () => {
    // Garante unicidade lógica pelo combo (client, product, deposit, modalidade)
    const existing = await db.client_price_overrides
      .where('client_id')
      .equals(row.client_id)
      .filter((p) =>
        p.product_id === row.product_id &&
        p.modalidade === row.modalidade &&
        ((p as any).deposit_id ?? null) === ((row as any).deposit_id ?? null) &&
        p.id !== row.id
      )
      .toArray();

    for (const ex of existing) {
      await db.client_price_overrides.delete(ex.id);
      await enqueueOutboxEvent({
        entity: 'client_price_overrides',
        action: 'DELETE',
        entity_id: ex.id,
      });
    }

    await db.client_price_overrides.put(row as any);
    await enqueueOutboxEvent({
      entity: 'client_price_overrides',
      action: 'UPSERT',
      entity_id: row.id,
      payload_json: entity,
    });
  });

  return entity;
}

export async function deleteClientPrice(id: string) {
  await db.transaction('rw', db.client_price_overrides, db.outbox_events, async () => {
    await db.client_price_overrides.delete(id);
    await enqueueOutboxEvent({
      entity: 'client_price_overrides',
      action: 'DELETE',
      entity_id: id,
    });
  });
}

// --- CLIENT ONE-TIME DISCOUNTS ---

const discountToDomain = (r: ClientOneTimeDiscount): ClienteDescontoPendente => ({
  id: r.id,
  clienteId: r.client_id,
  depositoId: null,
  tipoDesconto: r.tipo as any,
  valorDesconto: r.valor,
  modalidadeAlvo: null,
  produtoIdAlvo: null,
  usado: r.status === 'USADO',
  usadoEmOsId: null,
  criado_em: r.criado_em,
  usado_em: r.usado_em ?? null,
});

const discountFromDomain = (d: ClienteDescontoPendente): ClientOneTimeDiscount => ({
  id: d.id,
  client_id: d.clienteId,
  tipo: d.tipoDesconto as any,
  valor: d.valorDesconto,
  status: d.usado ? 'USADO' : 'PENDENTE',
  criado_em: d.criado_em,
  usado_em: d.usado_em ?? null,
});

export async function listClientDiscounts(): Promise<ClienteDescontoPendente[]> {
  const rows = await db.client_one_time_discount.toArray();
  return rows.map(discountToDomain);
}

export async function upsertClientDiscount(discount: ClienteDescontoPendente) {
  const now = Date.now();
  const entity: ClienteDescontoPendente = {
    ...discount,
    id: discount.id || generateId(),
    criado_em: discount.criado_em ?? now,
    usado: discount.usado ?? false,
  };
  const row = discountFromDomain(entity);

  await db.transaction('rw', db.client_one_time_discount, db.outbox_events, async () => {
    // Remove desconto pendente anterior do mesmo cliente (regra de uso único)
    const existing = await db.client_one_time_discount
      .where('client_id')
      .equals(row.client_id)
      .filter((x) => x.status === 'PENDENTE')
      .toArray();

    for (const ex of existing) {
      await db.client_one_time_discount.delete(ex.id);
      await enqueueOutboxEvent({
        entity: 'client_one_time_discount',
        action: 'DELETE',
        entity_id: ex.id,
      });
    }

    await db.client_one_time_discount.put(row);
    await enqueueOutboxEvent({
      entity: 'client_one_time_discount',
      action: 'UPSERT',
      entity_id: row.id,
      payload_json: entity,
    });
  });

  return entity;
}

export async function deleteClientDiscount(id: string) {
  await db.transaction('rw', db.client_one_time_discount, db.outbox_events, async () => {
    await db.client_one_time_discount.delete(id);
    await enqueueOutboxEvent({
      entity: 'client_one_time_discount',
      action: 'DELETE',
      entity_id: id,
    });
  });
}
