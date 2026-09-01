import React from 'react';
import { Box, IconButton, InputBase, Typography, Menu, MenuItem, ListItemIcon } from '@mui/material';
import { KeyboardArrowDown, Logout, MenuOutlined, NotificationsNone } from '@mui/icons-material';
import { colors, radii, sizes, typography } from '../../theme/tokens';
import DesignIcon from '../common/DesignIcon';
import { NavIconName } from '../../assets/icons/registry';

export interface ShellNavItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  iconName?: NavIconName;
  /** Не переходить по клику (заглушки в неподтверждённом кабинете). */
  disabled?: boolean;
  onClick?: () => void;
  /** Значение атрибута data-onboarding — интерактивное обучение ищет пункты по нему. */
  dataOnboarding?: string;
}

interface DashboardShellProps {
  /**
   * Заголовок страницы под шапкой. Если не передан, заголовок рисует сама
   * страница — так существующие экраны не получают дублирующийся заголовок.
   */
  pageTitle?: string;
  /** Правый слот рядом с заголовком. */
  pageAction?: React.ReactNode;
  navItems: ShellNavItem[];
  activeKey: string;
  /** Имя и роль в шапке. */
  userName: string;
  userRole: string;
  /** Количество непрочитанных уведомлений. */
  notifications?: number;
  onLogout: () => void;
  /** Поисковая строка отключена (например, в режиме ожидания подтверждения). */
  searchDisabled?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  children: React.ReactNode;
}

/**
 * Каркас панели управления по макету:
 * белая шапка с поиском и профилем, синее выделение активного пункта в меню,
 * серый контент-холст #F5F6FA и футер со ссылками.
 */
const DashboardShell: React.FC<DashboardShellProps> = ({
  pageTitle,
  pageAction,
  navItems,
  activeKey,
  userName,
  userRole,
  notifications = 0,
  onLogout,
  searchDisabled,
  searchValue = '',
  onSearchChange,
  children,
}) => {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const nav = (
    <Box
      component="nav"
      aria-label="Основное меню"
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 2 }}
    >
      {navItems.map((item) => {
        const active = item.key === activeKey;
        const interactive = !item.disabled && Boolean(item.onClick);
        return (
          <Box
            key={item.key}
            component={interactive ? 'button' : 'div'}
            type={interactive ? 'button' : undefined}
            onClick={
              interactive
                ? () => {
                    item.onClick?.();
                    setMobileNavOpen(false);
                  }
                : undefined
            }
            aria-current={active ? 'page' : undefined}
            aria-disabled={item.disabled || undefined}
            data-onboarding={item.dataOnboarding}
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              width: '100%',
              border: 'none',
              textAlign: 'left',
              fontFamily: 'inherit',
              cursor: interactive ? 'pointer' : 'default',
              px: 3,
              py: 1.75,
              ml: 0,
              borderRadius: '0 12px 12px 0',
              bgcolor: active ? colors.primary : 'transparent',
              color: active ? colors.white : item.disabled ? colors.textHint : colors.text,
              opacity: item.disabled ? 0.6 : 1,
              transition: 'background-color 160ms ease, color 160ms ease',
              '&:hover': interactive && !active ? { bgcolor: colors.surface } : undefined,
              '&::before': active
                ? {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 6,
                    borderRadius: '0 6px 6px 0',
                    bgcolor: colors.primaryDark,
                  }
                : undefined,
              '& img': { flexShrink: 0 },
            }}
          >
            {item.iconName ? (
              <DesignIcon category="nav" name={item.iconName} size={34} active={active} />
            ) : (
              item.icon
            )}
            <Typography
              component="span"
              sx={{ fontSize: typography.label, fontWeight: active ? 600 : 500, lineHeight: 1.25 }}
            >
              {item.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.card, display: 'flex', flexDirection: 'column' }}>
      {/* Шапка */}
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1.5, md: 3 },
          px: { xs: 2, md: 4 },
          py: { xs: 1.5, md: 2 },
          bgcolor: colors.card,
          borderBottom: `1px solid ${colors.surface}`,
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <IconButton
          aria-label="Открыть меню"
          onClick={() => setMobileNavOpen((v) => !v)}
          sx={{ display: { md: 'none' }, color: colors.text }}
        >
          <MenuOutlined />
        </IconButton>

        <Typography
          component="span"
          sx={{
            fontSize: { xs: 15, md: 18 },
            fontWeight: 800,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Box component="span" sx={{ color: colors.primary }}>
            PROF
          </Box>
          <Box component="span" sx={{ color: colors.text }}>
            SPORTCRM
          </Box>
        </Typography>

        <Box
          sx={{
            flex: 1,
            maxWidth: 540,
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: 1.5,
            height: 46,
            px: 2,
            borderRadius: `${radii.pill}px`,
            bgcolor: colors.surface,
            border: `1px solid ${colors.borderDisabled}`,
            opacity: searchDisabled ? 0.6 : 1,
          }}
        >
          <DesignIcon category="ui" name="search" size={22} />
          <InputBase
            placeholder="Поиск"
            value={searchValue}
            disabled={searchDisabled}
            onChange={(e) => onSearchChange?.(e.target.value)}
            inputProps={{ 'aria-label': 'Поиск' }}
            sx={{
              flex: 1,
              fontSize: typography.label,
              color: colors.text,
              '& input::placeholder': { color: colors.textHint, opacity: 1 },
            }}
          />
        </Box>

        <Box sx={{ flex: 1, display: { sm: 'none' } }} />

        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <IconButton aria-label="Уведомления" sx={{ color: colors.textMuted }}>
            <NotificationsNone sx={{ fontSize: 26 }} />
          </IconButton>
          {notifications > 0 && (
            <Box
              aria-label={`Непрочитанных уведомлений: ${notifications}`}
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 20,
                height: 20,
                px: 0.5,
                borderRadius: '999px',
                bgcolor: colors.danger,
                color: colors.white,
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {notifications > 9 ? '9+' : notifications}
            </Box>
          )}
        </Box>

        <Box
          component="button"
          type="button"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            border: 'none',
            bgcolor: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
            px: 0.5,
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              bgcolor: colors.textMuted,
              color: colors.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {userName.slice(0, 1).toUpperCase() || '—'}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left', minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: typography.label,
                fontWeight: 600,
                color: colors.textMuted,
                lineHeight: 1.2,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userName}
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
              {userRole}
            </Typography>
          </Box>
          <KeyboardArrowDown sx={{ color: colors.textHint }} />
        </Box>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onLogout();
            }}
          >
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Выйти
          </MenuItem>
        </Menu>
      </Box>

      {/* Меню + контент */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box
          sx={{
            width: sizes.sidebarWidth,
            flexShrink: 0,
            bgcolor: colors.card,
            display: { xs: 'none', md: 'block' },
          }}
        >
          {nav}
        </Box>

        {mobileNavOpen && (
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              top: 68,
              zIndex: 25,
              bgcolor: colors.card,
              overflowY: 'auto',
              display: { md: 'none' },
            }}
          >
            {nav}
          </Box>
        )}

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            bgcolor: colors.surface,
            px: { xs: 2, md: 4 },
            py: { xs: 3, md: 4 },
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 3, md: 4 },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            {pageTitle && (
              <Typography
                component="h1"
                sx={{
                  fontSize: typography.pageTitle,
                  fontWeight: 700,
                  color: colors.text,
                  lineHeight: 1.1,
                }}
              >
                {pageTitle}
              </Typography>
            )}
            {pageAction}
          </Box>

          <Box sx={{ flex: 1 }}>{children}</Box>

          <Box
            component="footer"
            sx={{
              textAlign: 'center',
              pt: 3,
              borderTop: `1px solid ${colors.divider}`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              {[
                { label: 'Пользовательское соглашение', href: '/terms' },
                { label: 'Контакты и реквизиты', href: '/contacts' },
                { label: 'Тарифы', href: '/pricing' },
              ].map((link, i, arr) => (
                <React.Fragment key={link.href}>
                  <Typography
                    component="a"
                    href={link.href}
                    sx={{
                      fontSize: typography.hint,
                      color: colors.textMuted,
                      textDecoration: 'none',
                      '&:hover': { color: colors.primary, textDecoration: 'underline' },
                    }}
                  >
                    {link.label}
                  </Typography>
                  {i < arr.length - 1 && (
                    <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>|</Typography>
                  )}
                </React.Fragment>
              ))}
            </Box>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
              © {new Date().getFullYear()} ПрофСпортСРМ. Все права защищены.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardShell;
