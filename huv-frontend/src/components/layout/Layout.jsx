// ============================================
// LAYOUT COMPONENT
// ============================================
// Ana layout yapısı - Header, Sidebar, Content
// Modern Architecture with Dark Mode
// ============================================

import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Avatar,
  Stack
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Assignment as AssignmentIcon,
  Category as CategoryIcon,
  Folder as FolderIcon,
  History as HistoryIcon,
  Assessment as AssessmentIcon,
  AdminPanelSettings as AdminIcon,
  FilterList as FilterListIcon,
  LibraryBooks as LibraryBooksIcon,
  AccountTree as TreeIcon,
  TrendingUp as TrendingUpIcon,
  CloudUpload as CloudUploadIcon,
  ListAlt as ListAltIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../app/context/ThemeContext';
import { APP_CONFIG, NAVIGATION_ITEMS } from '../../app/config/constants';

const drawerWidth = 260;

// ============================================
// Menü öğeleri - Icon mapping
// ============================================
const iconMap = {
  AssignmentIcon: <AssignmentIcon />,
  FilterListIcon: <FilterListIcon />,
  AccountTreeIcon: <TreeIcon />,
  CategoryIcon: <CategoryIcon />,
  FolderIcon: <FolderIcon />,
  TrendingUpIcon: <TrendingUpIcon />,
  HistoryIcon: <HistoryIcon />,
  AssessmentIcon: <AssessmentIcon />,
  CloudUploadIcon: <CloudUploadIcon />,
  SettingsIcon: <AdminIcon />,
  ListAltIcon: <ListAltIcon />,
  UploadFileIcon: <CloudUploadIcon />,
};

// ============================================
// Layout Component
// ============================================
function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme, isDark } = useTheme();

  // ============================================
  // Drawer toggle
  // ============================================
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // ============================================
  // Menü tıklama
  // ============================================
  const handleMenuClick = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  // ============================================
  // Drawer içeriği
  // ============================================
  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo & Title */}
      <Toolbar sx={{ px: 3, py: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 40,
              height: 40,
              fontSize: '1.5rem',
            }}
          >
            🏥
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
              HUV
            </Typography>
            <Typography variant="caption" color="text.secondary" lineHeight={1}>
              v{APP_CONFIG.version}
            </Typography>
          </Box>
        </Stack>
      </Toolbar>
      
      <Divider />
      
      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, px: 1.5, py: 2 }}>
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <Tooltip
              key={item.id}
              title={item.description}
              placement="right"
              arrow
            >
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={isActive}
                  onClick={() => handleMenuClick(item.path)}
                  sx={{
                    borderRadius: 2,
                    py: 1.5,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? 'inherit' : 'text.secondary',
                    }}
                  >
                    {iconMap[item.icon]}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </Tooltip>
          );
        })}
      </List>

      <Divider />

      {/* Footer Info */}
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {APP_CONFIG.description}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          {/* Mobile Menu Button */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Page Title */}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {NAVIGATION_ITEMS.find(item => item.path === location.pathname)?.title || APP_CONFIG.name}
          </Typography>

          {/* Dark Mode Toggle */}
          <Tooltip title={isDark ? 'Açık Tema' : 'Koyu Tema'}>
            <IconButton onClick={toggleTheme} color="inherit">
              {isDark ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Drawer - Mobile */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Drawer - Desktop */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;
