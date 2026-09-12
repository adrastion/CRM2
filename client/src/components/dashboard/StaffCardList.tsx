import React from 'react';
import { Box, Typography } from '@mui/material';
import { PersonOutline } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';
import { ClientDashboardStaffMember } from '../../types';

interface StaffCardListProps {
  staff: ClientDashboardStaffMember[];
  placeholder?: boolean;
  placeholderCount?: number;
  /** Клик по карточке тренера (роль TRAINER). */
  onTrainerClick?: (trainerId: string) => void;
}

/** Одна карточка сотрудника: роль, ФИО, телефон и фото-заглушка. */
const StaffCard: React.FC<{
  member?: ClientDashboardStaffMember;
  placeholder?: boolean;
  onClick?: () => void;
}> = ({ member, placeholder, onClick }) => {
  const clickable = Boolean(onClick) && !placeholder;
  return (
    <Box
      aria-hidden={placeholder || undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, md: 2 },
        p: { xs: 1.5, md: 2 },
        borderRadius: `${radii.cell}px`,
        bgcolor: colors.primarySoft,
        minWidth: 0,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
        ...(clickable
          ? {
              '&:hover': { bgcolor: 'action.hover' },
            }
          : {}),
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontSize: typography.hint, color: colors.textMuted, fontWeight: 600, mb: 0.25 }}
        >
          {placeholder ? '\u00A0' : member?.roleLabel}
        </Typography>
        <Typography
          sx={{
            fontSize: typography.label,
            color: colors.text,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {placeholder ? '\u00A0' : member?.name || '—'}
        </Typography>
        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
          {placeholder ? '\u00A0' : member?.phone || member?.email || '—'}
        </Typography>
        {clickable && (
          <Typography sx={{ fontSize: typography.hint, color: colors.primary, mt: 0.5, fontWeight: 600 }}>
            Открыть карточку
          </Typography>
        )}
      </Box>

      <Box
        aria-hidden
        sx={{
          width: { xs: 46, md: 58 },
          height: { xs: 58, md: 72 },
          borderRadius: `${radii.cell}px`,
          bgcolor: colors.divider,
          color: colors.textMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          '& svg': { fontSize: { xs: 26, md: 32 } },
        }}
      >
        <PersonOutline />
      </Box>
    </Box>
  );
};

/** Сетка карточек персонала школы (тренеры и администраторы). */
const StaffCardList: React.FC<StaffCardListProps> = ({
  staff,
  placeholder,
  placeholderCount = 2,
  onTrainerClick,
}) => {
  if (placeholder) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: { xs: 1.5, md: 2 },
          opacity: 0.55,
        }}
      >
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <StaffCard key={i} placeholder />
        ))}
      </Box>
    );
  }

  if (staff.length === 0) {
    return (
      <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
        Персонал не назначен
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: { xs: 1.5, md: 2 },
      }}
    >
      {staff.slice(0, 4).map((member) => {
        const isTrainer = member.role === 'TRAINER' || member.roleLabel === 'Тренер';
        return (
          <StaffCard
            key={`${member.roleLabel}-${member.id}`}
            member={member}
            onClick={
              isTrainer && onTrainerClick ? () => onTrainerClick(member.id) : undefined
            }
          />
        );
      })}
    </Box>
  );
};

export default StaffCardList;
