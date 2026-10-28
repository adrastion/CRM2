import React from 'react';
import { Box, Typography } from '@mui/material';
import { ChatBubbleOutline, PersonOutline, PhoneOutlined } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';
import { ClientDashboardStaffMember } from '../../types';

interface StaffCardListProps {
  staff: ClientDashboardStaffMember[];
  placeholder?: boolean;
  placeholderCount?: number;
  /** Клик по карточке тренера (роль TRAINER). */
  onTrainerClick?: (trainerId: string) => void;
  /** Вертикальный список (панель ЛК), иначе сетка 2 колонки. */
  layout?: 'grid' | 'stack';
  /** Кнопка звонка по телефону. */
  showCallButton?: boolean;
  /** Кнопка быстрого перехода в чат (ЛК клиента). */
  showChatButton?: boolean;
  onChatClick?: (member: ClientDashboardStaffMember) => void;
  /** Не показывать владельца (ЛК клиента). */
  hideOwner?: boolean;
}

function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

function isOwner(member: ClientDashboardStaffMember): boolean {
  return member.role === 'OWNER' || member.roleLabel === 'Владелец';
}

/** Одна карточка сотрудника: роль, ФИО, телефон и фото-заглушка. */
const StaffCard: React.FC<{
  member?: ClientDashboardStaffMember;
  placeholder?: boolean;
  onClick?: () => void;
  showCallButton?: boolean;
  showChatButton?: boolean;
  onChatClick?: () => void;
}> = ({ member, placeholder, onClick, showCallButton, showChatButton, onChatClick }) => {
  const clickable = Boolean(onClick) && !placeholder;
  const callHref = showCallButton && !placeholder ? telHref(member?.phone) : null;
  const chatEnabled = Boolean(showChatButton && onChatClick && !placeholder);

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
        gap: { xs: 1.25, md: 1.5 },
        p: { xs: 1.25, md: 1.5 },
        borderRadius: `${radii.cell}px`,
        bgcolor: '#EAF0FF',
        minWidth: 0,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
        ...(clickable
          ? {
              '&:hover': { bgcolor: '#DCE6FF' },
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
        {clickable && !showCallButton && !showChatButton && (
          <Typography sx={{ fontSize: typography.hint, color: colors.primary, mt: 0.5, fontWeight: 600 }}>
            Открыть карточку
          </Typography>
        )}
      </Box>

      <Box
        aria-hidden
        sx={{
          width: { xs: 40, md: 44 },
          height: { xs: 40, md: 44 },
          borderRadius: '50%',
          bgcolor: colors.card,
          color: colors.textMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 4px rgba(32,34,36,0.08)',
          '& svg': { fontSize: 22 },
        }}
      >
        <PersonOutline />
      </Box>

      {showChatButton && (
        <Box
          component="button"
          type="button"
          aria-label={member ? `Написать ${member.name}` : 'Открыть чат'}
          disabled={!chatEnabled}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            if (chatEnabled) onChatClick?.();
          }}
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            flexShrink: 0,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: chatEnabled ? colors.primary : colors.divider,
            color: chatEnabled ? colors.white : colors.textMuted,
            cursor: chatEnabled ? 'pointer' : 'default',
            boxShadow: chatEnabled ? '0 4px 10px rgba(47, 107, 255, 0.28)' : 'none',
            '&:hover': chatEnabled ? { bgcolor: colors.primaryDark } : undefined,
          }}
        >
          <ChatBubbleOutline sx={{ fontSize: 18 }} />
        </Box>
      )}

      {showCallButton && !showChatButton && (
        <Box
          component={callHref ? 'a' : 'span'}
          href={callHref || undefined}
          aria-label={callHref ? `Позвонить ${member?.name || ''}` : undefined}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: callHref ? colors.primary : colors.divider,
            color: callHref ? colors.white : colors.textMuted,
            textDecoration: 'none',
            pointerEvents: callHref ? 'auto' : 'none',
            boxShadow: callHref ? '0 4px 10px rgba(47, 107, 255, 0.28)' : 'none',
          }}
        >
          <PhoneOutlined sx={{ fontSize: 18 }} />
        </Box>
      )}
    </Box>
  );
};

/** Сетка карточек персонала школы (тренеры и администраторы). */
const StaffCardList: React.FC<StaffCardListProps> = ({
  staff,
  placeholder,
  placeholderCount = 2,
  onTrainerClick,
  layout = 'grid',
  showCallButton = false,
  showChatButton = false,
  onChatClick,
  hideOwner = false,
}) => {
  const visibleStaff = hideOwner ? staff.filter((m) => !isOwner(m)) : staff;

  const gridSx =
    layout === 'stack'
      ? {
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 1.25,
        }
      : {
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: { xs: 1.5, md: 2 },
        };

  if (placeholder) {
    return (
      <Box sx={{ ...gridSx, opacity: 0.55 }}>
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <StaffCard
            key={i}
            placeholder
            showCallButton={showCallButton}
            showChatButton={showChatButton}
          />
        ))}
      </Box>
    );
  }

  if (visibleStaff.length === 0) {
    return (
      <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
        Персонал не назначен
      </Typography>
    );
  }

  return (
    <Box sx={gridSx}>
      {visibleStaff.slice(0, layout === 'stack' ? 3 : 4).map((member) => {
        const isTrainer = member.role === 'TRAINER' || member.roleLabel === 'Тренер';
        return (
          <StaffCard
            key={`${member.roleLabel}-${member.id}`}
            member={member}
            showCallButton={showCallButton}
            showChatButton={showChatButton}
            onChatClick={onChatClick ? () => onChatClick(member) : undefined}
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
