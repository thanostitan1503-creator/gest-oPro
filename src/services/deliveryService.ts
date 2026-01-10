/**
 * 🚚 DELIVERY SERVICE
 * 
 * Serviço para operações de entrega: zonas, setores, jobs, entregadores.
 */

import { supabase } from '@/utils/supabaseClient';
import { Database } from '../types/supabase';

export type DeliveryZone = Database['public']['Tables']['delivery_zones']['Row'];
export type DeliverySector = Database['public']['Tables']['delivery_sectors']['Row'];
export type ZonePricing = Database['public']['Tables']['zone_pricing']['Row'];
export type DeliveryJob = Database['public']['Tables']['delivery_jobs']['Row'];
export type DriverPresence = Database['public']['Tables']['driver_presence']['Row'];

export const deliveryService = {
    /**
     * Listar todas as zonas + precificação
     */
    async listDeliveryZones(): Promise<{ zones: Database['public']['Tables']['delivery_zones']['Row'][]; pricing: Database['public']['Tables']['zone_pricing']['Row'][] }> {
      const { data: zones, error: zoneError } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('name');
      if (zoneError) throw new Error(`Erro ao listar zonas: ${zoneError.message}`);

      const { data: pricing, error: pricingError } = await supabase
        .from('zone_pricing')
        .select('*');
      if (pricingError) throw new Error(`Erro ao listar precificação de zonas: ${pricingError.message}`);

      return { zones: zones || [], pricing: pricing || [] };
    },

    /**
     * Upsert de zona de entrega
     */
    async upsertDeliveryZone(payload: Database['public']['Tables']['delivery_zones']['Insert']): Promise<Database['public']['Tables']['delivery_zones']['Row']> {
      const { data, error } = await supabase
        .from('delivery_zones')
        .upsert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao salvar zona: ${error.message}`);
      return data;
    },

    /**
     * Upsert de precificação por zona
     */
    async upsertZonePricing(payload: Database['public']['Tables']['zone_pricing']['Insert']): Promise<Database['public']['Tables']['zone_pricing']['Row']> {
      const { data, error } = await supabase
        .from('zone_pricing')
        .upsert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao salvar precificação da zona: ${error.message}`);
      return data;
    },

    /**
     * Deletar zona de entrega
     */
    async deleteDeliveryZone(id: string): Promise<void> {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', id);
      if (error) throw new Error(`Erro ao deletar zona: ${error.message}`);
    },
  // ==================== ZONAS E SETORES ====================

  /**
   * 1. Listar zonas ativas
   */
  async getZones(): Promise<DeliveryZone[]> {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao listar zonas: ${error.message}`);
    return data || [];
  },

  /**
   * 2b. Listar todos os setores ativos
   */
  async getSectors(): Promise<DeliverySector[]> {
    const { data, error } = await supabase
      .from('delivery_sectors')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`Erro ao listar setores: ${error.message}`);
    return data || [];
  },

  /**
   * 2. Listar setores de uma zona
   */
  async getSectorsByZone(zoneId: string): Promise<DeliverySector[]> {
    const { data, error } = await supabase
      .from('delivery_sectors')
      .select('*')
      .eq('zone_id', zoneId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Erro ao listar setores: ${error.message}`);
    return data || [];
  },

  /**
   * 3. Obter taxa de entrega
   */
  async getDeliveryFee(zoneId: string, depositId: string): Promise<number> {
    const { data, error } = await supabase
      .from('zone_pricing')
      .select('delivery_fee')
      .eq('zone_id', zoneId)
      .eq('deposit_id', depositId)
      .eq('is_active', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return 0; // Sem taxa configurada
      throw new Error(`Erro ao buscar taxa: ${error.message}`);
    }
    
    return data.delivery_fee;
  },

  /**
   * 4. Definir taxa de entrega
   */
  async setDeliveryFee(
    zoneId: string,
    depositId: string,
    fee: number
  ): Promise<ZonePricing> {
    const { data, error } = await supabase
      .from('zone_pricing')
      .upsert({
        zone_id: zoneId,
        deposit_id: depositId,
        delivery_fee: fee,
        is_active: true
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao definir taxa: ${error.message}`);
    return data;
  },

  // ==================== DELIVERY JOBS ====================

  /**
   * 5. Listar entregas pendentes de um depósito
   */
  async getPendingJobs(depositId: string): Promise<DeliveryJob[]> {
    const { data, error } = await supabase
      .from('delivery_jobs')
      .select(`
        *,
        service_orders!inner(
          deposit_id,
          order_number,
          client_name,
          delivery_address,
          total
        )
      `)
      .eq('service_orders.deposit_id', depositId)
      .in('status', ['CRIADA', 'PENDENTE_ENTREGA'])
      .order('created_at');
    
    if (error) throw new Error(`Erro ao listar entregas: ${error.message}`);
    return data || [];
  },

  /**
   * 6. Atribuir entregador a um job
   */
  async assignDriver(jobId: string, driverId: string): Promise<DeliveryJob> {
    const { data, error } = await supabase
      .from('delivery_jobs')
      .update({
        driver_id: driverId,
        status: 'PENDENTE_ENTREGA',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atribuir entregador: ${error.message}`);
    return data;
  },

  /**
   * 7. Iniciar entrega (entregador saiu)
   */
  async startDelivery(jobId: string): Promise<DeliveryJob> {
    const { data, error } = await supabase
      .from('delivery_jobs')
      .update({
        status: 'EM_ROTA',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw new Error(`Erro ao iniciar entrega: ${error.message}`);
    return data;
  },

  /**
   * 8. Concluir entrega
   */
  async completeDelivery(jobId: string): Promise<DeliveryJob> {
    const { data, error } = await supabase
      .from('delivery_jobs')
      .update({
        status: 'CONCLUIDA',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw new Error(`Erro ao concluir entrega: ${error.message}`);
    return data;
  },

  /**
   * 9. Marcar como devolvida (entrega falhou)
   */
  async markAsReturned(jobId: string, reason?: string): Promise<DeliveryJob> {
    const { data, error } = await supabase
      .from('delivery_jobs')
      .update({
        status: 'DEVOLVIDA',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw new Error(`Erro ao marcar como devolvida: ${error.message}`);
    return data;
  },

  // ==================== ENTREGADORES ====================

  /**
   * 10. Listar entregadores disponíveis
   */
  async getAvailableDrivers(depositId: string): Promise<DriverPresence[]> {
    const { data, error } = await supabase
      .from('driver_presence')
      .select(`
        *,
        employees!inner(name, active)
      `)
      .eq('deposit_id', depositId)
      .eq('status', 'DISPONIVEL')
      .eq('employees.active', true);
    
    if (error) throw new Error(`Erro ao listar entregadores: ${error.message}`);
    return data || [];
  },

  /**
   * 11. Atualizar status do entregador
   */
  async updateDriverStatus(
    driverId: string,
    depositId: string,
    status: DriverPresence['status']
  ): Promise<DriverPresence> {
    const { data, error } = await supabase
      .from('driver_presence')
      .upsert({
        driver_id: driverId,
        deposit_id: depositId,
        status,
        last_seen: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);
    return data;
  },

  /**
   * 12. Atualizar localização do entregador
   */
  async updateDriverLocation(
    driverId: string,
    depositId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    const { error } = await supabase
      .from('driver_presence')
      .update({
        latitude,
        longitude,
        last_seen: new Date().toISOString()
      })
      .eq('driver_id', driverId)
      .eq('deposit_id', depositId);

    if (error) throw new Error(`Erro ao atualizar localização: ${error.message}`);
  },

  /**
   * 13. Entregas em rota de um entregador
   */
  async getDriverActiveJobs(driverId: string): Promise<DeliveryJob[]> {
    const { data, error } = await supabase
      .from('delivery_jobs')
      .select(`
        *,
        service_orders(
          order_number,
          client_name,
          delivery_address,
          total
        )
      `)
      .eq('driver_id', driverId)
      .in('status', ['PENDENTE_ENTREGA', 'EM_ROTA'])
      .order('created_at');
    
    if (error) throw new Error(`Erro ao listar entregas: ${error.message}`);
    return data || [];
  },

  // ==================== RELATÓRIOS ====================

  /**
   * 14. Entregas concluídas do dia
   */
  async getTodayCompletedDeliveries(depositId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('delivery_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'CONCLUIDA')
      .gte('completed_at', today)
      .like('service_orders.deposit_id', depositId);
    
    if (error) throw new Error(`Erro ao contar entregas: ${error.message}`);
    return data || 0;
  },

  /**
   * 15. Taxa de sucesso de entregas
   */
  async getDeliverySuccessRate(
    depositId: string,
    startDate: string,
    endDate: string
  ): Promise<{ total: number; success: number; rate: number }> {
    const { data, error } = await supabase
      .from('delivery_jobs')
      .select(`
        id,
        status,
        service_orders!inner(deposit_id)
      `)
      .eq('service_orders.deposit_id', depositId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .in('status', ['CONCLUIDA', 'DEVOLVIDA']);
    
    if (error) throw new Error(`Erro ao calcular taxa: ${error.message}`);
    
    const total = data?.length || 0;
    const success = data?.filter(j => j.status === 'CONCLUIDA').length || 0;
    const rate = total > 0 ? (success / total) * 100 : 0;
    
    return { total, success, rate };
  }
};
