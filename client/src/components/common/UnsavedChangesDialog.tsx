import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

type Props = {
  open: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
  title?: string;
  message?: string;
};

/**
 * «Сохранить введённые изменения?» при закрытии грязной формы.
 */
const UnsavedChangesDialog: React.FC<Props> = ({
  open,
  saving = false,
  onSave,
  onDiscard,
  onStay,
  title = 'Сохранить изменения?',
  message = 'Сохранить введённые изменения?',
}) => {
  return (
    <Dialog
      open={open}
      onClose={onStay}
      maxWidth="xs"
      fullWidth
      // поверх формы-родителя
      sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onStay} disabled={saving} sx={{ textTransform: 'none' }}>
          Остаться
        </Button>
        <Button onClick={onDiscard} disabled={saving} color="inherit" sx={{ textTransform: 'none' }}>
          Не сохранять
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UnsavedChangesDialog;
