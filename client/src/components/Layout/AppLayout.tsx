import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Person,
  Groups,
  Business,
  CalendarToday,
  AttachMoney,
  Logout,
  AccountCircle,
  HelpOutline,
  Description,
  ContactMail,
  LocalOffer,
  Settings,
  Assignment,
  MenuBook,
  EmojiEvents,
  Support,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TelegramIcon from '../TelegramIcon';

const drawerWidth = 240;

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { label: 'Панель управления', path: '/dashboard', icon: <Dashboard />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
  { label: 'Клиенты', path: '/clients', icon: <People />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
  { label: 'Нормативы', path: '/standards', icon: <Assignment />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
  { label: 'Сотрудники', path: '/trainers', icon: <Person />, roles: ['OWNER', 'ADMIN'] },
  { label: 'Мой заработок', path: '/trainer/earnings', icon: <AttachMoney />, roles: ['TRAINER'] },
  { label: 'Заработок тренеров', path: '/trainers/earnings', icon: <AttachMoney />, roles: ['OWNER', 'ADMIN'] },
  { label: 'Группы', path: '/groups', icon: <Groups />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
  { label: 'Филиалы', path: '/branches', icon: <Business />, roles: ['OWNER', 'ADMIN'] },
  { label: 'Расписание', path: '/schedule', icon: <CalendarToday />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
  { label: 'Соревнования', path: '/competitions', icon: <EmojiEvents />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
  { label: 'Платежи', path: '/payments', icon: <AttachMoney />, roles: ['OWNER', 'ADMIN'] },
  { label: 'Тарифы', path: '/memberships', icon: <LocalOffer />, roles: ['OWNER', 'ADMIN'] },
  { label: 'Выданные тарифы', path: '/client-memberships', icon: <LocalOffer />, roles: ['OWNER', 'ADMIN'] },
  { label: 'Настройки', path: '/settings', icon: <Settings />, roles: ['OWNER', 'ADMIN'] },
  { label: 'FAQ', path: '/faq', icon: <HelpOutline />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
  { label: 'База знаний', path: '/knowledge-base', icon: <MenuBook />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
];

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const handleProfile = () => {
    navigate('/profile');
    handleProfileMenuClose();
  };

  const [visibleTabs, setVisibleTabs] = React.useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem('visibleTabs');
    if (saved) {
      return JSON.parse(saved);
    }
    // По умолчанию все вкладки видимы
    return {};
  });

  React.useEffect(() => {
    const handleTabsVisibilityChange = (event: CustomEvent) => {
      setVisibleTabs(event.detail.visibleTabs);
    };

    window.addEventListener('tabsVisibilityChange', handleTabsVisibilityChange as EventListener);
    return () => {
      window.removeEventListener('tabsVisibilityChange', handleTabsVisibilityChange as EventListener);
    };
  }, []);

  const tabKeyMap: { [key: string]: string } = {
    '/dashboard': 'dashboard',
    '/clients': 'clients',
    '/standards': 'standards',
    '/trainers': 'trainers',
    '/trainer/earnings': 'trainerEarnings',
    '/trainers/earnings': 'allTrainersEarnings',
    '/groups': 'groups',
    '/branches': 'branches',
    '/schedule': 'schedule',
    '/payments': 'payments',
    '/memberships': 'memberships',
    '/client-memberships': 'clientMemberships',
    '/settings': 'settings',
    '/faq': 'faq',
    '/knowledge-base': 'knowledgeBase',
  };

  const filteredNavigationItems = navigationItems.filter(item => {
    // Проверка роли
    if (item.roles && !item.roles.includes(user?.role || '')) {
      return false;
    }
    // Проверка видимости вкладки
    const tabKey = tabKeyMap[item.path];
    if (tabKey && visibleTabs[tabKey] === false) {
      return false;
    }
    return true;
  });

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
          {tenant?.name || 'ПрофСпортСРМ'}
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {filteredNavigationItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) {
                  setMobileOpen(false);
                }
              }}
              data-onboarding={
                item.path === '/dashboard' ? 'dashboard' : 
                item.path === '/clients' ? 'clients-nav' :
                item.path === '/groups' ? 'groups-nav' :
                item.path === '/schedule' ? 'schedule-nav' :
                item.path === '/standards' ? 'standards-nav' :
                item.path === '/trainers' ? 'trainers-nav' :
                item.path === '/trainers/earnings' ? 'trainer-salaries-nav' :
                item.path === '/branches' ? 'branches-nav' :
                item.path === '/payments' ? 'payments-nav' :
                item.path === '/memberships' ? 'memberships-nav' :
                item.path === '/client-memberships' ? 'client-memberships-nav' :
                item.path === '/settings' ? 'settings-nav' :
                item.path === '/faq' ? 'faq-nav' :
                item.path === '/knowledge-base' ? 'knowledge-base-nav' : undefined
              }
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {tenant?.name || 'ПрофСпортСРМ'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Иконка новостного Telegram канала */}
            <IconButton
              color="inherit"
              aria-label="Новостной Telegram канал"
              onClick={() => window.open('https://t.me/profsportcrm', '_blank')}
              sx={{ 
                '&:hover': { 
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s',
                padding: '8px',
              }}
              title="Новостной Telegram канал"
            >
              <TelegramIcon sx={{ fontSize: 24 }} />
            </IconButton>
            {/* Иконка технической поддержки Telegram */}
            <IconButton
              color="inherit"
              aria-label="Техническая поддержка Telegram"
              onClick={() => window.open('https://t.me/profsportcrm_ts', '_blank')}
              sx={{ 
                '&:hover': { 
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s',
                padding: '8px',
              }}
              title="Техническая поддержка"
            >
              <Support sx={{ fontSize: 24 }} />
            </IconButton>
            {/* Разделитель */}
            <Box
              sx={{
                width: '1px',
                height: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                mx: 1,
                display: { xs: 'none', sm: 'block' },
              }}
            />
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {user ? [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ') : ''}
            </Typography>
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="primary-search-account-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Box sx={{ flexGrow: 1 }}>
        {children}
        </Box>
        {/* Footer */}
        <Box
          component="footer"
          sx={{
            mt: 4,
            pt: 3,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 2,
            pb: 2,
          }}
        >
          <Typography
            variant="body2"
            component="a"
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              navigate('/terms');
            }}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline',
              },
            }}
          >
            Пользовательское соглашение
          </Typography>
          <Typography variant="body2" color="text.secondary">
            |
          </Typography>
          <Typography
            variant="body2"
            component="a"
            href="/contacts"
            onClick={(e) => {
              e.preventDefault();
              navigate('/contacts');
            }}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline',
              },
            }}
          >
            Контакты и реквизиты
          </Typography>
          <Typography variant="body2" color="text.secondary">
            |
          </Typography>
          <Typography
            variant="body2"
            component="a"
            href="/pricing"
            onClick={(e) => {
              e.preventDefault();
              navigate('/pricing');
            }}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline',
              },
            }}
          >
            Тарифы
          </Typography>
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          Профиль
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Выйти
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default AppLayout;
