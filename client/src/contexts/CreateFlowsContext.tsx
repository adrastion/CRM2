import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AddFinanceOperationDialog from '../components/finance/AddFinanceOperationDialog';
import CreateClientDialog from '../components/client/CreateClientDialog';
import CreateTrainingFlowDialogs from '../components/schedule/CreateTrainingFlowDialogs';

type CreateFlowsContextValue = {
  openCreateClient: () => void;
  openCreateTraining: () => void;
  openAddFinanceOperation: () => void;
};

const CreateFlowsContext = createContext<CreateFlowsContextValue | null>(null);

export const useCreateFlows = (): CreateFlowsContextValue => {
  const ctx = useContext(CreateFlowsContext);
  if (!ctx) {
    throw new Error('useCreateFlows must be used within CreateFlowsProvider');
  }
  return ctx;
};

/** Безопасный хук: на страницах вне shell возвращает no-op. */
export const useCreateFlowsOptional = (): CreateFlowsContextValue | null =>
  useContext(CreateFlowsContext);

export const CreateFlowsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clientOpen, setClientOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);

  const openCreateClient = useCallback(() => setClientOpen(true), []);
  const openCreateTraining = useCallback(() => setTrainingOpen(true), []);
  const openAddFinanceOperation = useCallback(() => setFinanceOpen(true), []);

  const value = useMemo(
    () => ({
      openCreateClient,
      openCreateTraining,
      openAddFinanceOperation,
    }),
    [openCreateClient, openCreateTraining, openAddFinanceOperation]
  );

  return (
    <CreateFlowsContext.Provider value={value}>
      {children}
      <CreateClientDialog open={clientOpen} onClose={() => setClientOpen(false)} />
      <CreateTrainingFlowDialogs open={trainingOpen} onClose={() => setTrainingOpen(false)} />
      <AddFinanceOperationDialog open={financeOpen} onClose={() => setFinanceOpen(false)} />
    </CreateFlowsContext.Provider>
  );
};
