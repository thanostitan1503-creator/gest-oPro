import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Colaborador, WorkShift, WorkShiftStatus } from '@/domain/types';
import { supabase } from '@/domain/supabaseClient';
import type { Database } from '@/types/supabase';
// ⚠️ REMOVIDO v3.0: import { closeShift as closeShiftRepo, getOpenShiftForUser, openShift as openShiftRepo } from '@/domain/repositories/shift.repo';

type ShiftContextValue = {
  activeShift: WorkShift | null;
  loading: boolean;
  refresh: () => Promise<void>;
  openShift: (params: { openingBalance: number; notes?: string | null }) => Promise<WorkShift | null>;
  closeShift: (params: {
    declared: { cash: number; card: number; pix: number };
    system: { cash: number; card: number; pix: number };
    status: WorkShift['status'];
    notes?: string | null;
  }) => Promise<WorkShift | null>;
};

const ShiftContext = createContext<ShiftContextValue | undefined>(undefined);

export const ShiftProvider: React.FC<{ currentUser: Colaborador | null; children: React.ReactNode }> = ({
  currentUser,
  children,
}) => {
  const [activeShift, setActiveShift] = useState<WorkShift | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentUser?.id || !currentUser?.depositoId) {
      setActiveShift(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    
    const { data, error } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('deposit_id', currentUser.depositoId)
      .eq('status', 'OPEN')
      .maybeSingle();
    
    if (error) console.error('Erro ao buscar turno:', error);

    const row = data as Database['public']['Tables']['work_shifts']['Row'] | null;
    const mapped = row
      ? {
          id: row.id,
          depositoId: row.deposit_id,
          user_id: row.user_id,
          status: row.status as WorkShiftStatus,
          opened_at: Date.parse(row.opened_at),
          closed_at: row.closed_at ? Date.parse(row.closed_at) : null,
          opening_balance: row.opening_balance,
          closing_balance: row.closing_balance,
          declared_cash: row.declared_cash,
          declared_card: row.declared_card,
          declared_pix: row.declared_pix,
          system_cash: row.system_cash,
          system_card: row.system_card,
          system_pix: row.system_pix,
          notes: null,
          user_name: undefined,
        }
      : null;

    setActiveShift(mapped);
    setLoading(false);
  }, [currentUser?.id, currentUser?.depositoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openShift = useCallback(
    async (params: { openingBalance: number; notes?: string | null }) => {
      if (!currentUser?.id || !currentUser?.depositoId) return null;
      
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('work_shifts')
        .insert({
          user_id: currentUser.id,
          deposit_id: currentUser.depositoId,
          status: 'OPEN',
          opened_at: nowIso,
          opening_balance: params.openingBalance,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao abrir turno:', error);
        return null;
      }
      
      const row = data as Database['public']['Tables']['work_shifts']['Row'];
      const shift: WorkShift = {
        id: row.id,
        depositoId: row.deposit_id,
        user_id: row.user_id,
        status: row.status as WorkShiftStatus,
        opened_at: Date.parse(row.opened_at),
        opening_balance: row.opening_balance,
        closing_balance: row.closing_balance,
        declared_cash: row.declared_cash,
        declared_card: row.declared_card,
        declared_pix: row.declared_pix,
        system_cash: row.system_cash,
        system_card: row.system_card,
        system_pix: row.system_pix,
        closed_at: row.closed_at ? Date.parse(row.closed_at) : null,
        notes: null,
        user_name: undefined,
      };
      setActiveShift(shift);
      return shift;
    },
    [currentUser?.id, currentUser?.depositoId, currentUser?.nome]
  );

  const closeShift = useCallback(
    async (params: {
      declared: { cash: number; card: number; pix: number };
      system: { cash: number; card: number; pix: number };
      status: WorkShift['status'];
      notes?: string | null;
    }) => {
      if (!activeShift) return null;
      
      // ✅ v3.0: Fechar turno direto no Supabase
      const { data, error } = await supabase
        .from('work_shifts')
        .update({
          status: params.status,
          closed_at: new Date().toISOString(),
          declared_cash: params.declared.cash,
          declared_card: params.declared.card,
          declared_pix: params.declared.pix,
          system_cash: params.system.cash,
          system_card: params.system.card,
          system_pix: params.system.pix,
          closing_balance: params.declared.cash + params.declared.card + params.declared.pix,
        })
        .eq('id', activeShift.id)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao fechar turno:', error);
        return null;
      }
      
      setActiveShift(null);
      const row = data as Database['public']['Tables']['work_shifts']['Row'];
      const shift: WorkShift = {
        id: row.id,
        depositoId: row.deposit_id,
        user_id: row.user_id,
        status: row.status as WorkShiftStatus,
        opened_at: Date.parse(row.opened_at),
        opening_balance: row.opening_balance,
        closing_balance: row.closing_balance,
        declared_cash: row.declared_cash,
        declared_card: row.declared_card,
        declared_pix: row.declared_pix,
        system_cash: row.system_cash,
        system_card: row.system_card,
        system_pix: row.system_pix,
        closed_at: row.closed_at ? Date.parse(row.closed_at) : null,
        notes: null,
        user_name: undefined,
      };
      return shift;
    },
    [activeShift]
  );

  const value = useMemo(
    () => ({
      activeShift,
      loading,
      refresh,
      openShift,
      closeShift,
    }),
    [activeShift, loading, refresh, openShift, closeShift]
  );

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
};

export const useShift = () => {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift must be used within ShiftProvider');
  return ctx;
};
