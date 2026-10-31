/** Ключи onboarding.missing → понятные подписи для UI. */
export const MARKETER_MISSING_LABELS: Record<string, string> = {
  name: 'ФИО',
  phone: 'телефон',
  inn: 'ИНН',
  taxStatus: 'подтверждение статуса НПД',
  bank: 'банковские реквизиты',
  offer: 'оферта маркетолога',
  pep: 'согласие на ПЭП',
  pdn: 'согласие на обработку персональных данных',
  programRules: 'правила партнёрской программы',
};

export function formatMarketerMissing(keys: string[]): string {
  return keys
    .map((k) => MARKETER_MISSING_LABELS[k] || k)
    .filter(Boolean)
    .join(', ');
}

/** Общие стили кабинета маркетолога (STAGE1 / PNG). */
export const marketerRadii = {
  card: '12px',
  control: '8px',
  dialog: '12px',
  chip: '6px',
  nav: '10px',
} as const;

export const marketerCardSx = {
  bgcolor: '#fff',
  borderRadius: marketerRadii.card,
  border: '1px solid #e6edf5',
  boxShadow: '0 5px 20px rgba(29,59,105,.025)',
} as const;

/**
 * Подпись над полем, без «парящего» текста на рамке OutlinedInput.
 * Иначе label визуально оказывается вне поля.
 */
export const marketerFieldSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  '& .MuiInputLabel-root': {
    position: 'static',
    transform: 'none !important',
    fontSize: 11,
    fontWeight: 700,
    color: '#53657f',
    mb: 0.85,
    maxWidth: '100%',
    whiteSpace: 'normal',
    overflow: 'visible',
    lineHeight: 1.35,
    pointerEvents: 'auto',
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: marketerRadii.control,
    backgroundColor: '#fff',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    top: 0,
  },
  '& .MuiOutlinedInput-notchedOutline legend': {
    display: 'none',
  },
  '& .MuiFormHelperText-root': {
    mx: 0,
    mt: 0.75,
  },
} as const;
