import React, { useEffect, useRef, useState } from 'react';
import { Box, Fade } from '@mui/material';

interface CustomModalFullProps {
  open: boolean;
  onClose?: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => boolean | void;
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  disableEscapeKeyDown?: boolean;
  disableBackdropClick?: boolean;
  closeAfterTransition?: boolean;
  onBackdropClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  shouldPreventCloseRef?: React.MutableRefObject<boolean>;
  isValidatingRef?: React.MutableRefObject<boolean>;
  isCancellingRef?: React.MutableRefObject<boolean>;
}

const CustomModalFull: React.FC<CustomModalFullProps> = ({
  open,
  onClose,
  children,
  maxWidth = 'md',
  fullWidth = false,
  disableEscapeKeyDown = false,
  disableBackdropClick = false,
  closeAfterTransition = true,
  onBackdropClick,
  shouldPreventCloseRef: externalShouldPreventCloseRef,
  isValidatingRef: externalIsValidatingRef,
  isCancellingRef: externalIsCancellingRef,
}) => {
  const [internalOpen, setInternalOpen] = useState(open);
  const internalShouldPreventCloseRef = useRef(false);
  const shouldPreventCloseRef = externalShouldPreventCloseRef || internalShouldPreventCloseRef;
  const onCloseRef = useRef(onClose);
  const backdropRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(open);

  // Обновляем ref при изменении onClose
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Синхронизируем внутреннее состояние с внешним
  useEffect(() => {
    if (open) {
      setInternalOpen(true);
      shouldPreventCloseRef.current = false;
      wasOpenRef.current = true;
    } else if (!open && wasOpenRef.current) {
      // Если идет отмена, всегда закрываем
      if (externalIsCancellingRef?.current) {
        setInternalOpen(false);
        wasOpenRef.current = false;
        return;
      }
      // Если внешнее состояние изменилось с true на false, но мы должны остаться открытыми
      // Проверяем через onClose, нужно ли переоткрыть
      if (onCloseRef.current) {
        const result = onCloseRef.current({}, 'backdropClick');
        if (result === false) {
          // Если onClose вернул false, переоткрываем
          setInternalOpen(true);
          wasOpenRef.current = true;
        } else {
          // Если onClose вернул true или undefined, закрываем
          setInternalOpen(false);
          wasOpenRef.current = false;
        }
      } else {
        // Если нет onClose, просто закрываем
        setInternalOpen(false);
        wasOpenRef.current = false;
      }
    }
  }, [open, externalIsCancellingRef]);

  // Принудительно открываем, если внешнее состояние open=true, а внутреннее false
  useEffect(() => {
    // Если идет отмена, не блокируем закрытие
    if (externalIsCancellingRef?.current) {
      return;
    }
    
    if (open && !internalOpen) {
      setInternalOpen(true);
      wasOpenRef.current = true;
    }
  }, [open, internalOpen, externalIsCancellingRef]);

  // Отслеживаем изменения internalOpen и принудительно открываем, если нужно
  useEffect(() => {
    // Если идет отмена, не блокируем закрытие
    if (externalIsCancellingRef?.current) {
      return;
    }
    
    if (!internalOpen && open) {
      // Если модальное окно закрылось, но внешнее состояние open=true, открываем его обратно
      // Используем множественные таймеры для гарантии открытия
      const timers: NodeJS.Timeout[] = [];
      for (let i = 0; i < 1000; i++) {
        const timer = setTimeout(() => {
          if (open && !internalOpen && !externalIsCancellingRef?.current) {
            setInternalOpen(true);
            wasOpenRef.current = true;
          }
        }, i * 2);
        timers.push(timer);
      }
      requestAnimationFrame(() => {
        if (open && !internalOpen && !externalIsCancellingRef?.current) {
          setInternalOpen(true);
          wasOpenRef.current = true;
        }
      });
      // Также используем setInterval для постоянного мониторинга
      const interval = setInterval(() => {
        if (open && !internalOpen && !externalIsCancellingRef?.current) {
          setInternalOpen(true);
          wasOpenRef.current = true;
        }
      }, 5);
      return () => {
        timers.forEach(timer => clearTimeout(timer));
        clearInterval(interval);
      };
    }
  }, [internalOpen, open, externalIsCancellingRef]);
  
  // Постоянный мониторинг состояния open и принудительное открытие
  useEffect(() => {
    if (open && !internalOpen) {
      // Если внешнее состояние open=true, а внутреннее false, принудительно открываем
      const interval = setInterval(() => {
        if (open && !internalOpen) {
          setInternalOpen(true);
          wasOpenRef.current = true;
        } else if (!open) {
          clearInterval(interval);
        }
      }, 2);
      return () => clearInterval(interval);
    }
  }, [open, internalOpen]);

  // Обработка Escape
  useEffect(() => {
    if (!internalOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscapeKeyDown) {
        // Если идет отмена, всегда разрешаем закрытие
        if (externalIsCancellingRef?.current) {
          setInternalOpen(false);
          return;
        }

        if (shouldPreventCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (onCloseRef.current) {
          const result = onCloseRef.current({}, 'escapeKeyDown');
          if (result === false) {
            shouldPreventCloseRef.current = true;
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

        setInternalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [internalOpen, disableEscapeKeyDown]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Проверяем, что клик был именно на backdrop, а не на содержимое
    if (event.target !== backdropRef.current) {
      return;
    }

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

    // Если идет отмена, всегда разрешаем закрытие
    if (externalIsCancellingRef?.current) {
      setInternalOpen(false);
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

    // Если есть кастомный обработчик, вызываем его
    if (onCloseRef.current) {
      const result = onCloseRef.current(event, 'backdropClick');
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

  if (!internalOpen) {
    return null;
  }

  return (
    <Box
      ref={backdropRef}
      onClick={handleBackdropClick}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          }}
        >
          {children}
        </Box>
      </Fade>
    </Box>
  );
};

export default CustomModalFull;

