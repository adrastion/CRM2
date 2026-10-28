import React from 'react';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import { Check, ExpandMore } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';

export interface AthleteOption {
  id: string;
  firstName: string;
  lastName: string;
  birthYear?: number | null;
  groupName?: string | null;
}

interface AthleteSwitcherProps {
  athletes: AthleteOption[];
  activeId: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}

function fullName(a: AthleteOption): string {
  return [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || 'Ученик';
}

function metaLine(a: AthleteOption, withGroupPrefix: boolean): string {
  const parts: string[] = [];
  if (a.birthYear) parts.push(String(a.birthYear));
  if (a.groupName) {
    parts.push(withGroupPrefix ? `Группа: ${a.groupName}` : a.groupName);
  }
  return parts.join(' · ');
}

function AvatarCircle({ name }: { name: string }) {
  const letter = name.slice(0, 1).toUpperCase() || '—';
  return (
    <Box
      aria-hidden
      sx={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        bgcolor: colors.primary,
        color: colors.white,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {letter}
    </Box>
  );
}

/**
 * Свитчер учеников в шапке ЛК (несколько аккаунтов на одном номере).
 * Без пункта «Добавить ребёнка».
 */
const AthleteSwitcher: React.FC<AthleteSwitcherProps> = ({
  athletes,
  activeId,
  disabled,
  onChange,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchor);

  if (athletes.length <= 1) return null;

  const active = athletes.find((a) => a.id === activeId) || athletes[0];
  const activeName = fullName(active);
  const activeMeta = metaLine(active, true);

  return (
    <>
      <Box
        component="button"
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Сменить ученика"
        onClick={(e) => {
          if (disabled) return;
          setAnchor(e.currentTarget);
        }}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.25,
          maxWidth: { xs: 200, sm: 280, md: 320 },
          px: 1.25,
          py: 0.75,
          border: 'none',
          borderRadius: 999,
          bgcolor: '#EEF3FF',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit',
          opacity: disabled ? 0.55 : 1,
          textAlign: 'left',
          '&:hover': disabled ? undefined : { bgcolor: '#E4ECFF' },
        }}
      >
        <AvatarCircle name={activeName} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: typography.label,
              fontWeight: 800,
              color: '#1B2438',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {activeName}
          </Typography>
          {activeMeta ? (
            <Typography
              sx={{
                fontSize: typography.hint,
                color: colors.textHint,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeMeta}
            </Typography>
          ) : null}
        </Box>
        <ExpandMore
          sx={{
            fontSize: 20,
            color: colors.textMuted,
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 160ms ease',
          }}
        />
      </Box>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 280,
            maxWidth: 360,
            borderRadius: `${radii.panel}px`,
            border: '1px solid #EEF1F6',
            boxShadow: '0 12px 32px rgba(27, 36, 56, 0.12)',
            p: 0.75,
          },
        }}
      >
        {athletes.map((athlete) => {
          const selected = athlete.id === activeId;
          const name = fullName(athlete);
          const meta = metaLine(athlete, false);
          return (
            <MenuItem
              key={athlete.id}
              selected={selected}
              onClick={() => {
                setAnchor(null);
                if (!selected) onChange(athlete.id);
              }}
              sx={{
                borderRadius: `${radii.button}px`,
                py: 1.1,
                px: 1.25,
                gap: 1.25,
                alignItems: 'center',
                '&.Mui-selected': { bgcolor: '#F5F8FF' },
                '&.Mui-selected:hover': { bgcolor: '#EEF3FF' },
              }}
            >
              <AvatarCircle name={name} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: typography.label,
                    fontWeight: 800,
                    color: '#1B2438',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}
                </Typography>
                {meta ? (
                  <Typography
                    sx={{
                      fontSize: typography.hint,
                      color: colors.textHint,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {meta}
                  </Typography>
                ) : null}
              </Box>
              {selected ? (
                <Box
                  aria-hidden
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '6px',
                    bgcolor: colors.success,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check sx={{ fontSize: 16 }} />
                </Box>
              ) : (
                <Box sx={{ width: 22, flexShrink: 0 }} />
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

export default AthleteSwitcher;
