import React from 'react';
import {
  CampaignOutlined,
  ChevronRight,
  Close,
  InfoOutlined,
  ManageAccountsOutlined,
  PersonOutline,
} from '@mui/icons-material';
import { Box, Button, Dialog, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material';
import { colors } from '../../theme/tokens';

export type AddEmployeeChoice = 'self-trainer' | 'TRAINER' | 'ADMIN' | 'PROMOTER';

interface AddEmployeeTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (choice: AddEmployeeChoice) => void;
  showSelfTrainer?: boolean;
  showAdmin?: boolean;
  showPromoter?: boolean;
}

const AddEmployeeTypeDialog: React.FC<AddEmployeeTypeDialogProps> = ({
  open,
  onClose,
  onSelect,
  showSelfTrainer = true,
  showAdmin = true,
  showPromoter = true,
}) => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isNarrow}
      BackdropProps={{
        sx: {
          bgcolor: 'rgba(27, 36, 56, 0.48)',
          backdropFilter: 'blur(3px)',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: '22px' },
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(27, 36, 56, 0.24)',
          maxWidth: 560,
          p: { xs: 2.25, sm: 3 },
          position: 'relative',
        },
      }}
    >
      <IconButton
        aria-label="Закрыть"
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          bgcolor: '#F1F3F7',
          color: colors.textMuted,
          '&:hover': { bgcolor: '#E6E8EF' },
        }}
      >
        <Close sx={{ fontSize: 18 }} />
      </IconButton>

      <Box sx={{ pr: 5, mb: 2.25 }}>
        <Typography
          sx={{
            fontSize: { xs: 22, sm: 26 },
            fontWeight: 800,
            color: '#1B2438',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Кого вы хотите добавить?
        </Typography>
        <Typography sx={{ mt: 0.75, fontSize: 14, color: colors.textMuted, lineHeight: 1.4 }}>
          Выберите тип сотрудника и формат добавления
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {showSelfTrainer && (
          <ChoiceRow
            featured
            title="Создать себя как тренера"
            description="Без отдельного входа — квалификация и схема ЗП на вашем аккаунте"
            badge="Рекомендуем"
            iconBg="rgba(255,255,255,0.92)"
            iconColor={colors.primary}
            Icon={PersonOutline}
            onClick={() => onSelect('self-trainer')}
          />
        )}

        <ChoiceRow
          title="Тренер"
          description="Создать отдельный аккаунт тренера"
          iconBg="#F1E9FF"
          iconColor="#7E57C2"
          Icon={PersonOutline}
          onClick={() => onSelect('TRAINER')}
        />

        {showAdmin && (
          <ChoiceRow
            title="Администратор"
            description="Создать аккаунт администратора"
            iconBg="#E8F0FF"
            iconColor={colors.primary}
            Icon={ManageAccountsOutlined}
            onClick={() => onSelect('ADMIN')}
          />
        )}

        {showPromoter && (
          <ChoiceRow
            title="Промоутер"
            description="Добавить сотрудника для привлечения клиентов"
            iconBg="#E8F8F1"
            iconColor="#00B69B"
            Icon={CampaignOutlined}
            onClick={() => onSelect('PROMOTER')}
          />
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mt: 2.5,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: colors.textHint }}>
          <InfoOutlined sx={{ fontSize: 16, color: colors.primary }} />
          <Typography sx={{ fontSize: 12.5, color: colors.textMuted }}>
            Права и доступ можно настроить позже
          </Typography>
        </Box>
        <Button
          onClick={onClose}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 14,
            color: colors.primary,
            px: 1,
            minWidth: 0,
            '&:hover': { bgcolor: 'rgba(47,107,255,0.06)' },
          }}
        >
          Отмена
        </Button>
      </Box>
    </Dialog>
  );
};

const ChoiceRow: React.FC<{
  featured?: boolean;
  title: string;
  description: string;
  badge?: string;
  iconBg: string;
  iconColor: string;
  Icon: React.ElementType;
  onClick: () => void;
}> = ({ featured, title, description, badge, iconBg, iconColor, Icon, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      width: '100%',
      border: featured ? 'none' : '1px solid #E6E8EF',
      cursor: 'pointer',
      fontFamily: 'inherit',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 1.75,
      py: 1.5,
      borderRadius: '16px',
      bgcolor: featured ? undefined : colors.card,
      background: featured
        ? 'linear-gradient(90deg, #2F6BFF 0%, #5B8CFF 55%, #7BA4FF 100%)'
        : colors.card,
      boxShadow: featured ? '0 10px 24px rgba(47, 107, 255, 0.28)' : 'none',
      transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
      '&:hover': featured
        ? {
            transform: 'translateY(-1px)',
            boxShadow: '0 14px 28px rgba(47, 107, 255, 0.34)',
          }
        : {
            borderColor: '#D5D8E0',
            boxShadow: '0 4px 14px rgba(32, 34, 36, 0.06)',
          },
    }}
  >
    <Box
      sx={{
        width: 46,
        height: 46,
        borderRadius: featured ? '50%' : '14px',
        bgcolor: iconBg,
        color: iconColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: 24 }} />
    </Box>

    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography
          sx={{
            fontSize: 15,
            fontWeight: 800,
            color: featured ? '#fff' : colors.text,
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
        {badge && (
          <Box
            sx={{
              px: 1,
              py: 0.2,
              borderRadius: '999px',
              bgcolor: 'rgba(255,255,255,0.22)',
              border: '1px solid rgba(255,255,255,0.45)',
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{badge}</Typography>
          </Box>
        )}
      </Box>
      <Typography
        sx={{
          mt: 0.35,
          fontSize: 12.5,
          color: featured ? 'rgba(255,255,255,0.9)' : colors.textMuted,
          lineHeight: 1.35,
        }}
      >
        {description}
      </Typography>
    </Box>

    <ChevronRight
      sx={{
        fontSize: 22,
        color: featured ? '#fff' : colors.primary,
        flexShrink: 0,
      }}
    />
  </Box>
);

export default AddEmployeeTypeDialog;
