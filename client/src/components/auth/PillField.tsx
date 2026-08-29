import React from 'react';
import { Box, IconButton, InputBase, Typography } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { colors, radii, sizes, typography } from '../../theme/tokens';

interface PillFieldProps {
  /** Иконка слева внутри поля. */
  icon?: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'tel' | 'email' | 'password';
  name?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /**
   * Поле только для чтения: выглядит как обычное (по макету), но не редактируется.
   * Используется для контакта, с которым пользователь уже прошёл шаг 1.
   */
  readOnly?: boolean;
  /** Текст ошибки — рамка становится красной, текст выводится под полем. */
  error?: string;
  /** Пояснение под полем (например, «Минимум 6 символов»). */
  hint?: string;
  /** Подпись над полем (используется на экране регистрации). */
  label?: string;
  /** Показывать кнопку «показать пароль». */
  revealable?: boolean;
  onEnter?: () => void;
  /** Компактный размер — для многополевых форм регистрации. */
  dense?: boolean;
}

/**
 * Поле ввода в виде пилюли по макету: внешняя обводка #838385,
 * внутренняя заливка #F5F6FA, высота 87px при ширине 1920.
 */
const PillField: React.FC<PillFieldProps> = ({
  icon,
  placeholder,
  value,
  onChange,
  type = 'text',
  name,
  autoComplete,
  autoFocus,
  disabled,
  readOnly,
  error,
  hint,
  label,
  revealable,
  onEnter,
  dense,
}) => {
  const [revealed, setRevealed] = React.useState(false);
  const effectiveType = revealable && revealed ? 'text' : type;
  const height = dense ? sizes.fieldHeightSm : sizes.fieldHeight;

  return (
    <Box sx={{ width: '100%' }}>
      {label && (
        <Typography
          component="label"
          htmlFor={name}
          sx={{
            display: 'block',
            mb: 1,
            ml: 2,
            color: colors.textMuted,
            fontSize: typography.label,
            fontWeight: 500,
          }}
        >
          {label}
        </Typography>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          height: { xs: height * 0.82, md: height },
          px: { xs: 2, md: 3 },
          borderRadius: `${radii.pill}px`,
          bgcolor: disabled ? colors.borderDisabled : colors.surface,
          border: `2px solid ${error ? colors.danger : disabled ? colors.borderDisabled : colors.border}`,
          transition: 'border-color 160ms ease, box-shadow 160ms ease',
          '&:focus-within': {
            borderColor: error ? colors.danger : colors.primary,
            boxShadow: `0 0 0 4px ${colors.primarySoft}66`,
          },
        }}
      >
        {icon && (
          <Box
            aria-hidden
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: error ? colors.danger : colors.textMuted,
              '& svg': { fontSize: { xs: 22, md: 30 } },
            }}
          >
            {icon}
          </Box>
        )}

        <InputBase
          id={name}
          name={name}
          type={effectiveType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          readOnly={readOnly}
          inputProps={{ 'aria-label': label || placeholder, 'aria-invalid': Boolean(error) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          sx={{
            flex: 1,
            color: colors.textMuted,
            fontSize: dense
              ? { xs: 15, sm: 18, md: 21 }
              : typography.field,
            '& input::placeholder': { color: colors.textMuted, opacity: 1 },
            '& input:disabled': { color: colors.textHint, WebkitTextFillColor: colors.textHint },
          }}
        />

        {revealable && (
          <IconButton
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Скрыть пароль' : 'Показать пароль'}
            sx={{ color: colors.textHint }}
          >
            {revealed ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        )}
      </Box>

      {(error || hint) && (
        <Typography
          sx={{
            mt: 0.75,
            ml: 2.5,
            fontSize: typography.hint,
            color: error ? colors.danger : colors.textFaint,
          }}
        >
          {error || hint}
        </Typography>
      )}
    </Box>
  );
};

export default PillField;
