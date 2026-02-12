// ============================================
// THEME INDEX
// ============================================
// Merkezi theme export
// ============================================

import { createTheme } from '@mui/material/styles';
import { lightPalette, darkPalette } from './palette';
import { typography } from './typography';
import { components, breakpoints, spacing, shape, shadows, transitions } from './components';

// Light theme
export const lightTheme = createTheme({
  palette: lightPalette,
  typography,
  components,
  breakpoints,
  spacing,
  shape,
  shadows,
  transitions,
});

// Dark theme
export const darkTheme = createTheme({
  palette: darkPalette,
  typography,
  components,
  breakpoints,
  spacing,
  shape,
  shadows,
  transitions,
});

// Theme creator function
export const createAppTheme = (mode = 'light') => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

export default lightTheme;
