import React from 'react';
import { Box, ClickAwayListener, Typography } from '@mui/material';
import { KeyboardArrowDown } from '@mui/icons-material';
import { colors, radii, sizes, typography } from '../../theme/tokens';

export interface OrgOption {
  /** Уникальный ключ варианта. */
  value: string;
  /** Название организации. */
  label: string;
  /** Вторая строка: роль или ФИО ребёнка. */
  secondary?: string;
}

interface OrgSelectProps {
  options: OrgOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Выпадающий список организаций по макету: поле-пилюля с шевроном,
 * под ним белая карточка со строками, выделенная строка — #D9D9D9.
 */
const OrgSelect: React.FC<OrgSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Выберите организацию',
  disabled,
}) => {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value) || null;

  const close = () => setOpen(false);

  return (
    <ClickAwayListener onClickAway={close}>
      <Box sx={{ position: 'relative', width: '100%' }}>
        <Box
          component="button"
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            height: { xs: sizes.fieldHeight * 0.82, md: sizes.fieldHeight },
            px: { xs: 2.5, md: 4 },
            borderRadius: `${radii.pill}px`,
            bgcolor: colors.surface,
            border: `2px solid ${colors.border}`,
            cursor: disabled ? 'default' : 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
            transition: 'border-color 160ms ease',
            '&:focus-visible': { outline: `3px solid ${colors.primarySoft}`, outlineOffset: 2 },
            '&:hover': disabled ? undefined : { borderColor: colors.primary },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="span"
              sx={{
                display: 'block',
                fontSize: typography.field,
                color: selected ? colors.textMuted : colors.textHint,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selected ? selected.label : placeholder}
            </Typography>
            {selected?.secondary && (
              <Typography
                component="span"
                sx={{ display: 'block', fontSize: typography.hint, color: colors.textFaint }}
              >
                {selected.secondary}
              </Typography>
            )}
          </Box>
          <KeyboardArrowDown
            sx={{
              color: colors.textMuted,
              fontSize: { xs: 26, md: 34 },
              flexShrink: 0,
              transition: 'transform 180ms ease',
              transform: open ? 'rotate(180deg)' : 'none',
            }}
          />
        </Box>

        {open && (
          <Box
            role="listbox"
            sx={{
              position: 'absolute',
              zIndex: 20,
              top: 'calc(100% + 12px)',
              left: 0,
              right: 0,
              bgcolor: colors.card,
              borderRadius: `${radii.dropdown}px`,
              boxShadow: '0 18px 44px rgba(32, 34, 36, 0.16)',
              overflow: 'hidden',
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Box
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  sx={{
                    px: { xs: 2.5, md: 4 },
                    py: { xs: 1.5, md: 2 },
                    cursor: 'pointer',
                    bgcolor: isSelected ? colors.divider : 'transparent',
                    '&:hover': { bgcolor: isSelected ? colors.divider : colors.surface },
                  }}
                >
                  <Typography sx={{ fontSize: typography.field, color: colors.textMuted }}>
                    {option.label}
                  </Typography>
                  {option.secondary && (
                    <Typography sx={{ fontSize: typography.hint, color: colors.textFaint }}>
                      {option.secondary}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </ClickAwayListener>
  );
};

export default OrgSelect;
