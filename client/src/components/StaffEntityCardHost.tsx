import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Deep-link карточки сотрудников/клиентов.
 * Клиент → /clients?clientId=&from=
 * Тренер → /trainers?trainerId=&from=
 * (не модалки — подстраницы, как в макетах)
 */
export function useStaffEntityCards(opts?: {
  /** @deprecated не используется — карточка открывается на /trainers */
  branches?: unknown[];
  /** @deprecated не используется — карточка открывается на /trainers */
  trainers?: unknown[];
  sourceLabel?: string;
}) {
  const navigate = useNavigate();

  const openClient = useCallback(
    (id: string, from?: string) => {
      const label = from || opts?.sourceLabel || 'Клиенты';
      const qs = new URLSearchParams({ clientId: id, from: label });
      navigate(`/clients?${qs.toString()}`);
    },
    [navigate, opts?.sourceLabel]
  );

  const openTrainer = useCallback(
    (id: string, from?: string) => {
      const label = from || opts?.sourceLabel || 'Сотрудники';
      const qs = new URLSearchParams({ trainerId: id, from: label });
      navigate(`/trainers?${qs.toString()}`);
    },
    [navigate, opts?.sourceLabel]
  );

  const closeClient = useCallback(() => {
    navigate('/clients');
  }, [navigate]);

  const closeTrainer = useCallback(() => {
    navigate('/trainers');
  }, [navigate]);

  return {
    openClient,
    openTrainer,
    closeClient,
    closeTrainer,
    /** @deprecated карточки больше не в Dialog — оставлено пустым для совместимости вызовов */
    dialogs: null as React.ReactNode,
  };
}
