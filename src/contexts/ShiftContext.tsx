import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Colaborador, WorkShift } from '../../src/domain/types';
import { closeShift as closeShiftRepo, getOpenShiftForUser, openShift as openShiftRepo } from '../../src/domain/repositories/shift.repo';

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
    const open = await getOpenShiftForUser(currentUser.id, currentUser.depositoId);
    setActiveShift(open);
    setLoading(false);
  }, [currentUser?.id, currentUser?.depositoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openShift = useCallback(
    async (params: { openingBalance: number; notes?: string | null }) => {
      if (!currentUser?.id || !currentUser?.depositoId) return null;
      const shift = await openShiftRepo({
        userId: currentUser.id,
        userName: currentUser.nome,
        depositId: currentUser.depositoId,
        openingBalance: params.openingBalance,
        notes: params.notes ?? null,
      });
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
      const updated = await closeShiftRepo({
        shift: activeShift,
        status: params.status,
        declared: params.declared,
        system: params.system,
        notes: params.notes ?? null,
      });
      setActiveShift(null);
      return updated;
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
