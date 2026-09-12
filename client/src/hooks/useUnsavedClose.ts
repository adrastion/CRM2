import { useCallback, useState } from 'react';

export type UnsavedCloseReason = 'backdropClick' | 'escapeKeyDown' | 'closeButton' | 'other';

type Options = {
  /** Есть несохранённые изменения */
  isDirty: boolean;
  /** Закрыть форму без сохранения (как «Отмена») */
  onDiscard: () => void;
  /** Сохранить и закрыть; вернуть true при успехе */
  onSave: () => void | boolean | Promise<void | boolean>;
};

/**
 * Подтверждение при закрытии грязной формы не через «Отмена».
 */
export function useUnsavedClose({ isDirty, onDiscard, onSave }: Options) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const requestClose = useCallback(
    (_reason?: UnsavedCloseReason) => {
      if (!isDirty) {
        onDiscard();
        return;
      }
      setConfirmOpen(true);
    },
    [isDirty, onDiscard]
  );

  const stay = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const discard = useCallback(() => {
    setConfirmOpen(false);
    onDiscard();
  }, [onDiscard]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const result = await onSave();
      if (result === false) {
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  return {
    confirmOpen,
    saving,
    requestClose,
    stay,
    discard,
    save,
  };
}

/** Грязность формы: сравнение текущего состояния с исходным снимком. */
export function isDirtyValue(current: unknown, initial: unknown): boolean {
  try {
    return JSON.stringify(current) !== JSON.stringify(initial);
  } catch {
    return current !== initial;
  }
}
