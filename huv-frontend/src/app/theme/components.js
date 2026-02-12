// ============================================
// COMPONENT OVERRIDES
// ============================================
// Material-UI component customization
// ============================================

export const components = {
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: 'none',
        fontWeight: 500,
        padding: '8px 16px',
      },
      contained: {
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        },
      },
      outlined: {
        borderWidth: 1.5,
      },
    },
    defaultProps: {
      disableElevation: true,
    },
  },
  
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
    },
  },
  
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
      elevation1: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
      elevation2: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      },
    },
  },
  
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 500,
      },
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
        },
      },
    },
    defaultProps: {
      variant: 'outlined',
      size: 'small',
    },
  },
  
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: '1px solid rgba(224, 224, 224, 0.4)',
        padding: '12px 16px',
      },
      head: {
        fontWeight: 600,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        whiteSpace: 'nowrap',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      },
    },
  },
  
  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:last-child td': {
          borderBottom: 0,
        },
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
        },
      },
    },
  },
  
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 12,
      },
    },
  },
  
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontSize: '1.25rem',
        fontWeight: 600,
      },
    },
  },
  
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        borderRadius: 6,
        fontSize: '0.875rem',
      },
    },
  },
  
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
      standardSuccess: {
        backgroundColor: 'rgba(46, 125, 50, 0.1)',
      },
      standardError: {
        backgroundColor: 'rgba(211, 47, 47, 0.1)',
      },
      standardWarning: {
        backgroundColor: 'rgba(237, 108, 2, 0.1)',
      },
      standardInfo: {
        backgroundColor: 'rgba(2, 136, 209, 0.1)',
      },
    },
  },
  
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 4,
        height: 6,
      },
    },
  },
  
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.9375rem',
        minHeight: 48,
      },
    },
  },
  
  MuiTabs: {
    styleOverrides: {
      indicator: {
        height: 3,
        borderRadius: '3px 3px 0 0',
      },
    },
  },
};

// Breakpoints
export const breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1920,
  },
};

// Spacing
export const spacing = 8;

// Shape
export const shape = {
  borderRadius: 8,
};

// Shadows
export const shadows = [
  'none',
  '0 2px 4px rgba(0,0,0,0.05)',
  '0 2px 8px rgba(0,0,0,0.08)',
  '0 4px 12px rgba(0,0,0,0.12)',
  '0 6px 16px rgba(0,0,0,0.15)',
  '0 8px 20px rgba(0,0,0,0.18)',
  '0 10px 24px rgba(0,0,0,0.20)',
  '0 12px 28px rgba(0,0,0,0.22)',
  '0 14px 32px rgba(0,0,0,0.24)',
  '0 16px 36px rgba(0,0,0,0.26)',
  '0 18px 40px rgba(0,0,0,0.28)',
  '0 20px 44px rgba(0,0,0,0.30)',
  '0 22px 48px rgba(0,0,0,0.32)',
  '0 24px 52px rgba(0,0,0,0.34)',
  '0 26px 56px rgba(0,0,0,0.36)',
  '0 28px 60px rgba(0,0,0,0.38)',
  '0 30px 64px rgba(0,0,0,0.40)',
  '0 32px 68px rgba(0,0,0,0.42)',
  '0 34px 72px rgba(0,0,0,0.44)',
  '0 36px 76px rgba(0,0,0,0.46)',
  '0 38px 80px rgba(0,0,0,0.48)',
  '0 40px 84px rgba(0,0,0,0.50)',
  '0 42px 88px rgba(0,0,0,0.52)',
  '0 44px 92px rgba(0,0,0,0.54)',
  '0 46px 96px rgba(0,0,0,0.56)',
];

// Transitions
export const transitions = {
  duration: {
    shortest: 150,
    shorter: 200,
    short: 250,
    standard: 300,
    complex: 375,
    enteringScreen: 225,
    leavingScreen: 195,
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
};
