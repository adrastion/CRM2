import React, { useCallback, useState } from 'react';
import { Dialog, DialogContent, useMediaQuery, useTheme } from '@mui/material';
import AthleteCard from './athlete/AthleteCard';
import TrainerCard from './trainers/TrainerCard';
import { apiService } from '../services/api';
import { Branch, Trainer } from '../types';
import { useAuth } from '../contexts/AuthContext';

type TrainerLike = Trainer | { id: string; user?: { id?: string }; [key: string]: unknown };

export function useStaffEntityCards(opts?: {
  branches?: Branch[];
  trainers?: TrainerLike[];
}) {
  const { user } = useAuth();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const isOwner = user?.role === 'OWNER';

  const [clientId, setClientId] = useState<string | null>(null);
  const [trainer, setTrainer] = useState<TrainerLike | null>(null);

  const openClient = useCallback((id: string) => {
    setClientId(id);
  }, []);

  const openTrainer = useCallback(
    async (trainerId: string) => {
      const fromList = opts?.trainers?.find(
        (t) => t.id === trainerId || (t as any).user?.id === trainerId
      );
      if (fromList) {
        setTrainer(fromList);
        return;
      }
      try {
        const loaded = await apiService.getTrainer(trainerId);
        setTrainer(loaded);
      } catch {
        /* ignore */
      }
    },
    [opts?.trainers]
  );

  const closeClient = useCallback(() => setClientId(null), []);
  const closeTrainer = useCallback(() => setTrainer(null), []);

  const dialogs = (
    <>
      <Dialog
        open={Boolean(clientId)}
        onClose={closeClient}
        maxWidth="lg"
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogContent>
          {clientId && (
            <AthleteCard mode="staff" clientId={clientId} onClose={closeClient} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(trainer)}
        onClose={closeTrainer}
        maxWidth="md"
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogContent>
          {trainer && (
            <TrainerCard
              employee={trainer as any}
              branches={opts?.branches || []}
              isOwner={isOwner}
              onClose={closeTrainer}
              onSaved={async () => {
                try {
                  const refreshed = await apiService.getTrainer((trainer as any).id);
                  setTrainer(refreshed);
                } catch {
                  /* keep current */
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  return { openClient, openTrainer, closeClient, closeTrainer, dialogs };
}
