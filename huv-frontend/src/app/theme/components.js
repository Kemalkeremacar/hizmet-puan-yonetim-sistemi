// ============================================
// COMPONENT OVERRIDES
// ============================================
// Material-UI component customization
// ============================================

export const components = {
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        textTransform: 'none',
        fontWeight: 500,
        padding: '6px 16px',
        fontSize: '0.875rem',
      },
      contained: {
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        },
      },
      outlined: {
        borderWidth: 1,
      },
    },
    defaultProps: {
      disableElevation: true,
    },
  },
  
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
    },
  },
  
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
      elevation1: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
      elevation2: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
      },
    },
  },
  
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 500,
      },
      sizeSmall: {
        height: 24,
        fontSize: '0.75rem',
      },
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 6,
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
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        padding: '10px 16px',
        fontSize: '0.8125rem',
      },
      head: {
        fontWeight: 600,
        fontSize: '0.8125rem',
        backgroundColor: '#f8f9fa',
        color: 'rgba(0, 0, 0, 0.7)',
        whiteSpace: 'nowrap',
        position: 'sticky',
        top: 0,
        zIndex: 2,
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
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
          backgroundColor: 'rgba(0, 0, 0, 0.015)',
        },
      },
    },
  },
  
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 10,
      },
    },
  },
  
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontSize: '1.125rem',
        fontWeight: 600,
      },
    },
  },
  
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        borderRadius: 4,
        fontSize: '0.8125rem',
      },
    },
  },
  
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontSize: '0.8125rem',
      },
      standardSuccess: {
        backgroundColor: 'rgba(46, 125, 50, 0.06)',
        border: '1px solid rgba(46, 125, 50, 0.15)',
      },
      standardError: {
        backgroundColor: 'rgba(211, 47, 47, 0.06)',
        border: '1px solid rgba(211, 47, 47, 0.15)',
      },
      standardWarning: {
        backgroundColor: 'rgba(237, 108, 2, 0.06)',
        border: '1px solid rgba(237, 108, 2, 0.15)',
      },
      standardInfo: {
        backgroundColor: 'rgba(2, 136, 209, 0.06)',
        border: '1px solid rgba(2, 136, 209, 0.15)',
      },
    },
  },
  
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 3,
        height: 4,
      },
    },
  },
  
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.875rem',
        minHeight: 44,
      },
    },
  },
  
  MuiTabs: {
    styleOverrides: {
      indicator: {
        height: 2,
        borderRadius: '2px 2px 0 0',
      },
    },
  },

  MuiAccordion: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        '&:before': {
          display: 'none',
        },
        boxShadow: 'none',
        border: '1px solid rgba(0, 0, 0, 0.08)',
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
  '0 1px 2px rgba(0,0,0,0.04)',
  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  '0 2px 6px rgba(0,0,0,0.08)',
  '0 4px 8px rgba(0,0,0,0.08)',
  '0 4px 12px rgba(0,0,0,0.1)',
  '0 6px 16px rgba(0,0,0,0.1)',
  '0 8px 20px rgba(0,0,0,0.1)',
  '0 8px 24px rgba(0,0,0,0.12)',
  '0 10px 28px rgba(0,0,0,0.12)',
  '0 12px 32px rgba(0,0,0,0.14)',
  '0 14px 36px rgba(0,0,0,0.14)',
  '0 16px 40px rgba(0,0,0,0.16)',
  '0 18px 44px rgba(0,0,0,0.16)',
  '0 20px 48px rgba(0,0,0,0.18)',
  '0 22px 52px rgba(0,0,0,0.18)',
  '0 24px 56px rgba(0,0,0,0.2)',
  '0 26px 60px rgba(0,0,0,0.2)',
  '0 28px 64px rgba(0,0,0,0.22)',
  '0 30px 68px rgba(0,0,0,0.22)',
  '0 32px 72px rgba(0,0,0,0.24)',
  '0 34px 76px rgba(0,0,0,0.24)',
  '0 36px 80px rgba(0,0,0,0.26)',
  '0 38px 84px rgba(0,0,0,0.26)',
  '0 40px 88px rgba(0,0,0,0.28)',
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
