import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../src/domain/db';

export type SystemAlert = {
  id: string;
  type: 'critical' | 'warning';
  message: string;
  link: string;
};

const toTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const isDeliveryFeeProduct = (product: any) => {
  const flag = product?.is_delivery_fee ?? product?.isDeliveryFee;
  if (flag === true) return true;
  const group = String(product?.product_group ?? product?.codigo ?? '').toLowerCase();
  if (group === 'delivery_fee') return true;
  const name = String(product?.nome ?? product?.name ?? '').toLowerCase();
  return name === 'taxa de entrega';
};

const isServiceProduct = (product: any) => {
  if (isDeliveryFeeProduct(product)) return true;
  const track = product?.track_stock ?? product?.trackStock;
  if (track === false) return true;
  return product?.type === 'SERVICE';
};

export const useSystemAlerts = (): SystemAlert[] => {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const workShifts =
    useLiveQuery(() => db.work_shifts.where('status').equals('DISCREPANCY').toArray(), []) ?? [];
  const serviceOrders =
    useLiveQuery(() => db.service_orders.where('status').equals('PENDENTE').toArray(), []) ?? [];

  return useMemo(() => {
    const alerts: SystemAlert[] = [];
    const cutoff = Date.now() - 40 * 60 * 1000;

    for (const product of products) {
      if (isServiceProduct(product)) continue;
      // Ignora produtos que nao controlam estoque
      const shouldTrack =
        (product as any).track_stock === true || (product as any).trackStock === true;
      if (!shouldTrack) continue;

      const stock = Number((product as any).current_stock ?? (product as any).currentStock ?? 0);
      if (!Number.isFinite(stock)) continue;
      if (stock <= 5) {
        const type: SystemAlert['type'] = stock <= 0 ? 'critical' : 'warning';
        const name = String((product as any).nome ?? (product as any).name ?? (product as any).codigo ?? 'Produto');
        alerts.push({
          id: `stock-${product.id}`,
          type,
          message: `Produto ${name} esta acabando (${stock} un)`,
          link: '/stock',
        });
      }
    }

    for (const shift of workShifts) {
      const user = String(
        (shift as any).user_name ??
          (shift as any).userName ??
          (shift as any).user_id ??
          (shift as any).userId ??
          (shift as any).usuario ??
          shift.id
      );
      alerts.push({
        id: `cash-${shift.id}`,
        type: 'critical',
        message: `Diferenca de valor no caixa de ${user}`,
        link: '/finance',
      });
    }

    for (const order of serviceOrders) {
      const createdAt = toTimestamp(
        (order as any).dataHoraCriacao ??
          (order as any).created_at ??
          (order as any).createdAt
      );
      if (!createdAt || createdAt > cutoff) continue;
      const number =
        (order as any).numeroOs ??
        (order as any).number ??
        (order as any).numero ??
        order.id;
      alerts.push({
        id: `order-${order.id}`,
        type: 'critical',
        message: `O.S. #${number} esta atrasada`,
        link: '/orders',
      });
    }

    return alerts;
  }, [products, workShifts, serviceOrders]);
};
