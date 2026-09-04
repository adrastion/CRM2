import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogProps,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { colors } from '../../theme/tokens';

export interface AppDialogProps extends Omit<DialogProps, 'title'> {
  /** Заголовок диалога. */
  title?: React.ReactNode;
  /** Слот действий внизу (кнопки). */
  actions?: React.ReactNode;
  /** Показать крестик закрытия в заголовке. */
  showClose?: boolean;
  children?: React.ReactNode;
}

/**
 * Единый компактный диалог поверх MUI Dialog.
 * Плотность и радиусы задаются темой; обёртка унифицирует title/actions.
 */
const AppDialog: React.FC<AppDialogProps> = ({
  title,
  actions,
  showClose = true,
  children,
  onClose,
  open,
  ...dialogProps
}) => {
  const handleClose = (
    event: {},
    reason: 'backdropClick' | 'escapeKeyDown'
  ) => {
    onClose?.(event, reason);
  };

  return (
    <Dialog open={open} onClose={handleClose} {...dialogProps}>
      {(title || showClose) && (
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            pr: showClose ? 1 : undefined,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {typeof title === 'string' ? (
              <Typography component="span" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {title}
              </Typography>
            ) : (
              title
            )}
          </Box>
          {showClose && onClose && (
            <IconButton
              aria-label="Закрыть"
              size="small"
              onClick={(e) => onClose(e, 'escapeKeyDown')}
              sx={{ color: colors.textMuted }}
            >
              <Close fontSize="small" />
            </IconButton>
          )}
        </DialogTitle>
      )}
      {children && <DialogContent>{children}</DialogContent>}
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
};

export default AppDialog;
