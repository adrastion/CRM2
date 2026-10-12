import React from 'react';
import { Alert, AlertColor, Box, Button, SxProps, Theme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  looksLikePlanLimitMessage,
  type PlanLimitPayload,
} from '../../utils/planLimit';
import { canManageSubscription } from '../../utils/roles';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  children: React.ReactNode;
  onClose?: () => void;
  sx?: SxProps<Theme>;
  severity?: AlertColor;
  /** Явный payload с API; если нет — определяем по тексту сообщения. */
  planLimit?: PlanLimitPayload | null;
};

/**
 * Alert для ошибок API. При PLAN_LIMIT добавляет ссылку на смену тарифа.
 */
export default function PlanLimitAlert({
  children,
  onClose,
  sx,
  severity = 'error',
  planLimit = null,
}: Props) {
  const { user } = useAuth();
  const text = typeof children === 'string' ? children : '';
  const showUpgrade =
    !!planLimit || looksLikePlanLimitMessage(text);
  const canUpgrade = canManageSubscription(user?.role);

  return (
    <Alert severity={severity} sx={sx} onClose={onClose}>
      {children}
      {showUpgrade && (
        <Box sx={{ mt: 1 }}>
          {canUpgrade ? (
            <Button
              component={RouterLink}
              to="/pricing"
              size="small"
              color="inherit"
              variant="outlined"
            >
              Сменить тариф
            </Button>
          ) : (
            <Box component="span" sx={{ fontSize: '0.875rem', opacity: 0.9 }}>
              Обратитесь к владельцу школы, чтобы сменить тариф.
            </Box>
          )}
        </Box>
      )}
    </Alert>
  );
}
