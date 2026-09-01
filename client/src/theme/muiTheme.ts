import { createTheme, Theme } from '@mui/material/styles';
import { colors, radii, typography } from './tokens';

const fontFamily = '"Montserrat", "Helvetica", "Arial", sans-serif';

/** Единая MUI-тема приложения по дизайн-токенам (только светлая). */
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
      h1: { fontFamily, fontWeight: 700, color: colors.text },
      h2: { fontFamily, fontWeight: 700, color: colors.text },
      h3: { fontFamily, fontWeight: 600, color: colors.text },
      h4: { fontFamily, fontWeight: 600, color: colors.text },
      h5: { fontFamily, fontWeight: 600, color: colors.text },
      h6: { fontFamily, fontWeight: 600, color: colors.text },
      subtitle1: { fontFamily, fontWeight: 500 },
      subtitle2: { fontFamily, fontWeight: 500 },
      body1: { fontFamily, fontWeight: 400 },
      body2: { fontFamily, fontWeight: 400 },
      button: { fontFamily, fontWeight: 600, textTransform: 'none' },
      caption: { fontFamily, fontWeight: 400 },
      overline: { fontFamily, fontWeight: 500 },
    },
    shape: {
      borderRadius: radii.panel,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily,
            color: colors.text,
            backgroundColor: colors.surface,
          },
          '#root': {
            minHeight: '100vh',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: `${radii.button}px`,
            fontFamily,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontFamily,
            fontWeight: 600,
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            fontFamily,
          },
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
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: radii.panel,
            backgroundColor: colors.card,
            color: colors.text,
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
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });
}

export { typography, colors };
