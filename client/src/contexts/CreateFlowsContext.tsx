import React, {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

const CreateClientDialog = lazy(() => import('../components/client/CreateClientDialog'));
const CreateTrainingFlowDialogs = lazy(
  () => import('../components/schedule/CreateTrainingFlowDialogs')
);
const AddFinanceOperationDialog = lazy(
  () => import('../components/finance/AddFinanceOperationDialog')
);

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
      {clientOpen ? (
        <Suspense fallback={null}>
          <CreateClientDialog open={clientOpen} onClose={() => setClientOpen(false)} />
        </Suspense>
      ) : null}
      {trainingOpen ? (
        <Suspense fallback={null}>
          <CreateTrainingFlowDialogs open={trainingOpen} onClose={() => setTrainingOpen(false)} />
        </Suspense>
      ) : null}
      {financeOpen ? (
        <Suspense fallback={null}>
          <AddFinanceOperationDialog open={financeOpen} onClose={() => setFinanceOpen(false)} />
        </Suspense>
      ) : null}
    </CreateFlowsContext.Provider>
  );
};
