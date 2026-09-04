import React, { useEffect, useRef, useState } from 'react';
import { Modal, Backdrop, Fade, Box } from '@mui/material';

interface CustomModalProps {
  open: boolean;
  onClose?: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => boolean | void;
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  disableEscapeKeyDown?: boolean;
  disableBackdropClick?: boolean;
  closeAfterTransition?: boolean;
  onBackdropClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const CustomModal: React.FC<CustomModalProps> = ({
  open,
  onClose,
  children,
  maxWidth = 'md',
  fullWidth = false,
  disableEscapeKeyDown = false,
  disableBackdropClick = false,
  closeAfterTransition = true,
  onBackdropClick,
}) => {
  const [internalOpen, setInternalOpen] = useState(open);
  const shouldPreventCloseRef = useRef(false);
  const onCloseRef = useRef(onClose);

  // Обновляем ref при изменении onClose
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Синхронизируем внутреннее состояние с внешним
  useEffect(() => {
    if (open) {
      setInternalOpen(true);
      shouldPreventCloseRef.current = false;
    }
  }, [open]);

  // Принудительно открываем, если внешнее состояние open=true, а внутреннее false
  useEffect(() => {
    if (open && !internalOpen) {
      setInternalOpen(true);
    }
  }, [open, internalOpen]);

  // Отслеживаем изменения internalOpen и принудительно открываем, если нужно
  useEffect(() => {
    if (!internalOpen && open) {
      // Если модальное окно закрылось, но внешнее состояние open=true, открываем его обратно
      const timer = setTimeout(() => {
        if (open && !internalOpen) {
          setInternalOpen(true);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [internalOpen, open]);

  const handleClose = (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
    // Если закрытие заблокировано, не закрываем
    if (shouldPreventCloseRef.current) {
      // Принудительно оставляем открытым
      requestAnimationFrame(() => {
        setInternalOpen(true);
      });
      return;
    }

    // Если отключено закрытие по Escape
    if (reason === 'escapeKeyDown' && disableEscapeKeyDown) {
      // Принудительно оставляем открытым
      requestAnimationFrame(() => {
        setInternalOpen(true);
      });
      return;
    }

    // Если отключено закрытие по клику на backdrop
    if (reason === 'backdropClick' && disableBackdropClick) {
      // Принудительно оставляем открытым
      requestAnimationFrame(() => {
        setInternalOpen(true);
      });
      return;
    }

    // Если есть кастомный обработчик, вызываем его
    if (onCloseRef.current) {
      const result = onCloseRef.current(event, reason);
      // Если обработчик вернул false, не закрываем
      if (result === false) {
        shouldPreventCloseRef.current = true;
        // Принудительно оставляем открытым используя несколько методов
        requestAnimationFrame(() => {
          setInternalOpen(true);
        });
        setTimeout(() => {
          setInternalOpen(true);
        }, 0);
        setTimeout(() => {
          setInternalOpen(true);
        }, 10);
        return;
      }
    }

    // Если обработчик не вернул false, разрешаем закрытие
    setInternalOpen(false);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Если есть кастомный обработчик, вызываем его
    if (onBackdropClick) {
      onBackdropClick(event);
      // Если обработчик вызвал preventDefault, не закрываем
      if (event.defaultPrevented) {
        return;
      }
    }

    // Если закрытие по backdrop отключено, не закрываем
    if (disableBackdropClick) {
      return;
    }

    // Если закрытие заблокировано, не закрываем
    if (shouldPreventCloseRef.current) {
      event.preventDefault();
      event.stopPropagation();
      // Принудительно оставляем открытым
      setInternalOpen(true);
      return;
    }

    // Вызываем handleClose
    handleClose(event, 'backdropClick');
  };

  return (
    <Modal
      open={internalOpen}
      onClose={handleClose}
      closeAfterTransition={closeAfterTransition}
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 500,
          onClick: handleBackdropClick,
        },
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Fade in={internalOpen}>
        <Box
          onClick={(e) => {
            // Предотвращаем всплытие всех событий
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
          }}
          sx={{
            outline: 'none',
            width: fullWidth ? '90%' : 'auto',
            maxWidth: maxWidth === false ? 'none' : {
              xs: '90%',
              sm: maxWidth === 'xs' ? 444 : maxWidth === 'sm' ? 600 : maxWidth === 'md' ? 900 : maxWidth === 'lg' ? 1200 : 1536,
            },
            bgcolor: 'background.paper',
            borderRadius: 1.5,
            boxShadow: '0 8px 32px rgba(32, 34, 36, 0.12)',
            p: { xs: 2, sm: 2.5 },
            maxHeight: '90vh',
            overflow: 'auto',
          }}
        >
          {children}
        </Box>
      </Fade>
    </Modal>
  );
};

export default CustomModal;

