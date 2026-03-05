import { createTheme, alpha } from '@mui/material/styles';

// IntuRank brand colors (align with Tailwind / existing app)
const primary = '#00f3ff';   // cyan
const secondary = '#ff1e6d'; // pink/rose
const success = '#00ff9d';
const backgroundDefault = '#020308';
const backgroundPaper = '#0f172a'; // slate-900
const textPrimary = '#f1f5f9';
const textSecondary = '#94a3b8';

export const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: primary,
      light: alpha(primary, 0.8),
      dark: alpha(primary, 0.9),
      contrastText: '#000',
    },
    secondary: {
      main: secondary,
      light: alpha(secondary, 0.8),
      dark: alpha(secondary, 0.9),
      contrastText: '#fff',
    },
    success: {
      main: success,
    },
    background: {
      default: backgroundDefault,
      paper: backgroundPaper,
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
    },
    divider: alpha('#e2e8f0', 0.08),
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
            filter: 'brightness(1.08)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          backgroundImage: 'none',
          border: `1px solid ${alpha('#fff', 0.08)}`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha('#fff', 0.06)}`,
          borderRadius: 16,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: alpha(primary, 0.08),
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(primary, 0.4),
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: primary,
              borderWidth: 1,
            },
          },
        },
      },
    },
  },
});
