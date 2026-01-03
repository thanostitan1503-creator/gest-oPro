import { readFileSync, writeFileSync } from 'fs';

const dbFile = 'c:\\Users\\Mynd\\Downloads\\gestão-pro\\domain\\db.ts';
let content = readFileSync(dbFile, 'utf8');

const v16Code = `
    // v16: MULTI-DEPOT FIX - Add depositoId index to products table
    this.version(16)
      .stores({
        deposits: 'id, nome, ativo',
        products: 'id, codigo, nome, ativo, tipo, product_group, depositoId',
        price_table: 'id, product_id, modalidade',
        employees: 'id, username, deposit_id, cargo, ativo',
        clients: 'id, nome, ativo',
        client_price_overrides: 'id, client_id, product_id, modalidade',
        client_one_time_discount: 'id, client_id, status',
        service_orders: 'id, numeroOs, status, depositoId, clienteId, dataHoraCriacao, entregadorId',
        service_order_items: 'id, osId, produtoId',
        payment_methods: 'id, name, receipt_type, is_active',
        machines: 'id, nome, ativo',
        accounts_receivable: 'id, os_id, status, deposit_id',
        receivable_payments: 'id, receivable_id, data_hora',
        financial_settings: 'id, monthly_goal',
        stock_balance: 'id, [deposit_id+product_id]',
        stock_movements: 'id, depositoId, produtoId, origem, referenciaId, usuarioId',
        stock_transfers: 'id, origem_deposit_id, destino_deposit_id',
        stock_transfer_items: 'id, transfer_id, product_id',
        cash_sessions: 'id, deposit_id, operador_id',
        cash_movements: 'id, cash_session_id, tipo, os_id',
        stock_counts: 'id, deposit_id, usuario_id, tipo',
        stock_count_items: 'id, count_id, product_id',
        audit_logs: 'id, entidade, entidade_id, acao, criado_em',
        financial_movements: 'id, referenciaId, formaPagamentoId',
        receivable_titles: 'id, osId, status',
        delivery_jobs: 'id, status, depositoId, assignedDriverId, osId',
        driver_presence: 'driverId, status, lastSeenAt',
        delivery_zones: 'id, deposit_id, name',
        delivery_zones: 'id, zone_id, name',
        zone_pricing: 'id, [zone_id+deposit_id], zone_id, deposit_id',
        expenses: 'id, status, due_date, category',
        work_shifts: 'id, deposit_id, user_id, status, opened_at',
        cash_flow_entries: 'id, shift_id, deposit_id, user_id, category, status, created_at, reference_id',
        shift_stock_audits: 'id, shift_id, deposit_id, product_id, created_at',
        outbox_events: 'id, status, entity, action, entity_id, created_at'
      })
      .upgrade(async (tx) => {
        console.log('[v16] Normalizing depositoId in products...');
        const productsTable = tx.table('products');
        const allProducts = await productsTable.toArray();
        let normalized = 0;
        for (const p of allProducts) {
          const depositId = p.depositoId ?? p.deposito_id ?? p.deposit_id ?? null;
          const isService = p.type === 'SERVICE' || p.track_stock === false || p.is_delivery_fee === true;
          const finalDepositId = isService ? null : depositId;
          if (p.depositoId !== finalDepositId) {
            await productsTable.update(p.id, { depositoId: finalDepositId });
            normalized++;
          }
        }
        console.log(\`[v16] Normalized \${normalized} products with depositoId\`);
      });
`;

// Find insertion point after v15
const marker = `      });

    // Alias`;

if (content.includes(marker)) {
  content = content.replace(marker, v16Code + '\n\n    // Alias');
  writeFileSync(dbFile, content, 'utf8');
  console.log('✅ v16 migration added successfully!');
} else {
  console.error('❌ Could not find insertion point');
  process.exit(1);
}
