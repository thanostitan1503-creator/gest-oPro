export interface AuditDashboardStats {
  top_driver: { name: string; count: number };
  fastest_driver: { name: string; avg_minutes: number };
  top_deposit: { name: string; total: number };
  top_cashier: { name: string; count: number };
  top_client_value: { name: string; total: number };
  top_client_orders: { name: string; count: number };
  top_product_sold: { name: string; count: number };
}
