import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Colaborador, WorkShift } from '@/domain/types';
import { supabase } from '@/domain/supabaseClient';
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
    
    // ✅ v3.0: Buscar turno aberto direto do Supabase
    const { data, error } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('deposit_id', currentUser.depositoId)
      .eq('status', 'OPEN')
      .maybeSingle();
    
    if (error) console.error('Erro ao buscar turno:', error);
    setActiveShift(data as WorkShift | null);
    setLoading(false);
  }, [currentUser?.id, currentUser?.depositoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openShift = useCallback(
    async (params: { openingBalance: number; notes?: string | null }) => {
      if (!currentUser?.id || !currentUser?.depositoId) return null;
      
      // ✅ v3.0: Abrir turno direto no Supabase
      const newShift: Omit<WorkShift, 'id'> = {
        user_id: currentUser.id,
        user_name: currentUser.nome,
        deposit_id: currentUser.depositoId,
        status: 'OPEN',
        opened_at: Date.now(),
        opening_balance: params.openingBalance,
        notes: params.notes ?? null,
      };
      
      const { data, error } = await supabase
        .from('work_shifts')
        .insert(newShift)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao abrir turno:', error);
        return null;
      }
      
      const shift = data as WorkShift;
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
          closed_at: Date.now(),
          declared_cash: params.declared.cash,
          declared_card: params.declared.card,
          declared_pix: params.declared.pix,
          system_cash: params.system.cash,
          system_card: params.system.card,
          system_pix: params.system.pix,
          closing_balance: params.declared.cash + params.declared.card + params.declared.pix,
          notes: params.notes ?? activeShift.notes,
        })
        .eq('id', activeShift.id)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao fechar turno:', error);
        return null;
      }
      
      setActiveShift(null);
      return data as WorkShift;
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
