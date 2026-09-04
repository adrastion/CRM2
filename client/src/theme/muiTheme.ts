import { createTheme, Theme } from '@mui/material/styles';
import { colors, radii, sizes, typography } from './tokens';

const fontFamily = '"Montserrat", "Helvetica", "Arial", sans-serif';

/** Единая компактная MUI-тема приложения (только светлая). */
export function createAppTheme(): Theme {
  return createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: colors.primary,
        dark: colors.primaryDark,
        light: colors.primarySoft,
        contrastText: colors.white,
      },
      secondary: {
        main: colors.danger,
      },
      error: {
        main: colors.danger,
      },
      success: {
        main: colors.success,
      },
      text: {
        primary: colors.text,
        secondary: colors.textMuted,
        disabled: colors.textHint,
      },
      background: {
        default: colors.surface,
        paper: colors.card,
      },
      divider: colors.divider,
    },
    typography: {
      fontFamily,
      fontSize: 14,
      h1: { fontFamily, fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2, color: colors.text },
      h2: { fontFamily, fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.25, color: colors.text },
      h3: { fontFamily, fontWeight: 600, fontSize: '1.35rem', lineHeight: 1.3, color: colors.text },
      h4: { fontFamily, fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.3, color: colors.text },
      h5: { fontFamily, fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.35, color: colors.text },
      h6: { fontFamily, fontWeight: 600, fontSize: '1rem', lineHeight: 1.4, color: colors.text },
      subtitle1: { fontFamily, fontWeight: 500, fontSize: '0.9375rem' },
      subtitle2: { fontFamily, fontWeight: 500, fontSize: '0.875rem' },
      body1: { fontFamily, fontWeight: 400, fontSize: '0.9375rem', lineHeight: 1.5 },
      body2: { fontFamily, fontWeight: 400, fontSize: '0.8125rem', lineHeight: 1.45 },
      button: {
        fontFamily,
        fontWeight: 600,
        fontSize: '0.875rem',
        textTransform: 'none',
        lineHeight: 1.4,
      },
      caption: { fontFamily, fontWeight: 400, fontSize: '0.75rem' },
      overline: { fontFamily, fontWeight: 500, fontSize: '0.6875rem' },
    },
    shape: {
      borderRadius: radii.panel,
    },
    spacing: 8,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily,
            fontSize: 14,
            color: colors.text,
            backgroundColor: colors.surface,
          },
          '#root': {
            minHeight: '100vh',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          size: 'medium',
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: `${radii.button}px`,
            fontFamily,
            fontSize: typography.button.md,
            minHeight: sizes.buttonHeightSm,
            paddingLeft: 16,
            paddingRight: 16,
          },
          sizeSmall: {
            minHeight: 34,
            fontSize: 13,
            paddingLeft: 12,
            paddingRight: 12,
          },
          sizeMedium: {
            minHeight: sizes.buttonHeightSm,
            fontSize: typography.button.md,
          },
          sizeLarge: {
            minHeight: sizes.buttonHeight,
            fontSize: typography.button.md,
            minWidth: sizes.buttonMinWidth,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: 8,
          },
          sizeSmall: {
            padding: 6,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontFamily,
            fontWeight: 600,
            fontSize: 14,
            minHeight: 44,
            paddingLeft: 12,
            paddingRight: 12,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 44,
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            fontFamily,
            fontSize: typography.field.md,
          },
          input: {
            paddingTop: '10px !important',
            paddingBottom: '10px !important',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: `${radii.button}px`,
            backgroundColor: colors.card,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.borderDisabled,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.border,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.primary,
              borderWidth: 1.5,
            },
          },
          input: {
            padding: '10px 14px',
            height: 'auto',
          },
          sizeSmall: {
            '& .MuiOutlinedInput-input': {
              padding: '8px 12px',
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontFamily,
            fontSize: 14,
          },
          sizeSmall: {
            fontSize: 13,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
          variant: 'outlined',
        },
      },
      MuiFormControl: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiSelect: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            fontFamily,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily,
            fontWeight: 500,
            height: 28,
            fontSize: 12,
          },
          sizeSmall: {
            height: 24,
            fontSize: 11,
          },
        },
      },
      MuiDialog: {
        defaultProps: {
          fullWidth: true,
          maxWidth: 'sm',
        },
        styleOverrides: {
          paper: {
            borderRadius: `${radii.panel}px`,
            backgroundColor: colors.card,
            color: colors.text,
            backgroundImage: 'none',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily,
            fontWeight: 600,
            fontSize: '1.1rem',
            lineHeight: 1.35,
            padding: '16px 20px 8px',
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: '8px 20px 16px',
            '&.MuiDialogContent-dividers': {
              padding: '12px 20px',
            },
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: '8px 16px 16px',
            gap: 8,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: colors.card,
            color: colors.text,
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: colors.card,
          },
          outlined: {
            borderColor: colors.divider,
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderRadius: `${radii.panel}px`,
            border: `1px solid ${colors.divider}`,
            boxShadow: 'none',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 16,
            '&:last-child': { paddingBottom: 16 },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            fontFamily,
            fontSize: 13,
            padding: '8px 12px',
            borderColor: colors.divider,
          },
          head: {
            fontWeight: 600,
            fontSize: 13,
            backgroundColor: colors.surface,
            color: colors.textMuted,
          },
          sizeSmall: {
            padding: '6px 10px',
            fontSize: 12,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child td': { borderBottom: 0 },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily,
            fontSize: 14,
            minHeight: 40,
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: {
            fontSize: 14,
          },
          secondary: {
            fontSize: 12,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: `${radii.panel}px`,
            fontSize: 14,
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: '56px !important',
          },
        },
      },
      MuiContainer: {
        styleOverrides: {
          root: {
            paddingLeft: 16,
            paddingRight: 16,
          },
        },
      },
    },
  });
}

export { typography, colors };
