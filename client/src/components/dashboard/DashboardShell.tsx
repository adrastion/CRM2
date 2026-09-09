import React from 'react';
import {
  Box,
  IconButton,
  InputBase,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  KeyboardArrowDown,
  Logout,
  MenuOutlined,
  NotificationsNone,
  Search as SearchIcon,
  Close,
  Check,
  PersonAddAlt1,
} from '@mui/icons-material';
import { colors, radii, sizes, typography } from '../../theme/tokens';
import DesignIcon from '../common/DesignIcon';
import { NavIconName } from '../../assets/icons/registry';
import {
  getActiveAccountId,
  listSavedAccounts,
  switchToAccount,
  upsertFromActiveStorage,
  type SavedAccountSlot,
} from '../../utils/accountSwitcher';

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
  /** Счётчик непрочитанных (например, чаты). 0 / undefined — скрыть. */
  badge?: number;
}

export interface GlobalSearchResultItem {
  id: string;
  type: 'client' | 'trainer' | 'group';
  title: string;
  subtitle?: string;
}

export interface GlobalSearchResults {
  clients: GlobalSearchResultItem[];
  trainers: GlobalSearchResultItem[];
  groups: GlobalSearchResultItem[];
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
  /** Добавить ещё один аккаунт (очистить активную сессию, оставить реестр). */
  onAddAccount?: () => void;
  /** Поисковая строка отключена (например, в режиме ожидания подтверждения). */
  searchDisabled?: boolean;
  /** Полностью скрыть поиск (ЛК клиента). */
  hideSearch?: boolean;
  /** maxWidth поиска на sm/md (кабинет школы — шире). */
  searchMaxWidth?: { sm?: number | string; md?: number | string };
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Результаты глобального поиска для dropdown. */
  searchResults?: GlobalSearchResults | null;
  searchLoading?: boolean;
  onSearchResultClick?: (item: GlobalSearchResultItem) => void;
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
  onAddAccount,
  searchDisabled,
  hideSearch = false,
  searchMaxWidth,
  searchValue = '',
  onSearchChange,
  searchResults = null,
  searchLoading = false,
  onSearchResultClick,
  children,
}) => {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
  const [savedAccounts, setSavedAccounts] = React.useState<SavedAccountSlot[]>([]);
  const [activeAccountId, setActiveAccountId] = React.useState<string | null>(null);
  const searchWrapRef = React.useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!menuAnchor) return;
    // Подхватить текущую сессию, если пользователь залогинен до появления реестра
    upsertFromActiveStorage();
    setSavedAccounts(listSavedAccounts());
    setActiveAccountId(getActiveAccountId());
  }, [menuAnchor]);

  // Авто-синхронизация SA/Tester в свитчере при привязке/отвязке без повторного входа
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!localStorage.getItem('token') || !localStorage.getItem('user')) return;
      try {
        const { syncLinkedPlatformAccounts } = await import('../../utils/authSession');
        const result = await syncLinkedPlatformAccounts();
        if (cancelled || result.kickedTo) return;
        if (result.changed || menuAnchor) {
          setSavedAccounts(listSavedAccounts());
          setActiveAccountId(getActiveAccountId());
        }
      } catch {
        /* ignore */
      }
    };
    run();
    const onFocus = () => {
      void run();
    };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(run, 20000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [menuAnchor]);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const hasSearchHits =
    Boolean(searchResults) &&
    ((searchResults!.clients.length || 0) +
      (searchResults!.trainers.length || 0) +
      (searchResults!.groups.length || 0) >
      0);

  const showSearchDropdown =
    searchOpen &&
    !searchDisabled &&
    (searchValue || '').trim().length >= 2 &&
    (searchLoading || hasSearchHits || Boolean(searchResults));

  const renderSearchSection = (
    label: string,
    items: GlobalSearchResultItem[]
  ) => {
    if (!items.length) return null;
    return (
      <Box key={label} sx={{ py: 0.5 }}>
        <Typography
          sx={{
            px: 1.5,
            py: 0.5,
            fontSize: 11,
            fontWeight: 700,
            color: colors.textHint,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </Typography>
        {items.map((item) => (
          <Box
            key={`${item.type}-${item.id}`}
            component="button"
            type="button"
            onClick={() => {
              onSearchResultClick?.(item);
              setSearchOpen(false);
              setMobileSearchOpen(false);
            }}
            sx={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              border: 'none',
              bgcolor: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              px: 1.5,
              py: 1,
              '&:hover': { bgcolor: colors.surface },
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
              {item.title}
            </Typography>
            {item.subtitle && (
              <Typography sx={{ fontSize: 12, color: colors.textHint }}>{item.subtitle}</Typography>
            )}
          </Box>
        ))}
      </Box>
    );
  };

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
              gap: 1.5,
              width: '100%',
              border: 'none',
              textAlign: 'left',
              fontFamily: 'inherit',
              cursor: interactive ? 'pointer' : 'default',
              px: 2,
              py: 1.25,
              ml: 0,
              borderRadius: '0 10px 10px 0',
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
                    top: 6,
                    bottom: 6,
                    width: 4,
                    borderRadius: '0 4px 4px 0',
                    bgcolor: colors.primaryDark,
                  }
                : undefined,
              '& img': { flexShrink: 0 },
            }}
          >
            {item.iconName ? (
              <DesignIcon category="nav" name={item.iconName} size={22} active={active} />
            ) : (
              item.icon
            )}
            <Typography
              component="span"
              sx={{
                flex: 1,
                fontSize: typography.label,
                fontWeight: active ? 600 : 500,
                lineHeight: 1.25,
                minWidth: 0,
              }}
            >
              {item.label}
            </Typography>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <Box
                component="span"
                sx={{
                  flexShrink: 0,
                  minWidth: 18,
                  height: 18,
                  px: item.badge > 9 ? 0.6 : 0,
                  borderRadius: 999,
                  bgcolor: active ? 'rgba(255,255,255,0.95)' : '#E53935',
                  color: active ? colors.primary : '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: '18px',
                  textAlign: 'center',
                }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.card, display: 'flex', flexDirection: 'column' }}>
      {/* Шапка: логотип слева | поиск по центру | профиль справа */}
      <Box
        component="header"
        sx={{
          display: 'grid',
          // Без поиска (ЛК клиента) — только логотип и профиль, иначе профиль
          // попадает во вторую колонку 1fr auto 1fr и оказывается по центру.
          gridTemplateColumns: hideSearch
            ? '1fr auto'
            : { xs: 'auto 1fr auto', sm: '1fr auto 1fr' },
          alignItems: 'center',
          columnGap: { xs: 1, md: 2 },
          px: { xs: 2, md: 3 },
          py: { xs: 1, md: 1.25 },
          bgcolor: colors.card,
          borderBottom: `1px solid ${colors.surface}`,
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            justifySelf: 'start',
            minWidth: 0,
          }}
        >
          <IconButton
            aria-label="Открыть меню"
            size="small"
            onClick={() => setMobileNavOpen((v) => !v)}
            sx={{ display: { md: 'none' }, color: colors.text }}
          >
            <MenuOutlined />
          </IconButton>

          <Typography
            component="span"
            sx={{
              fontSize: { xs: 14, md: 16 },
              fontWeight: 800,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            <Box component="span" sx={{ color: colors.primary }}>
              ПРОФ
            </Box>
            <Box component="span" sx={{ color: colors.text }}>
              СПОРТСРМ
            </Box>
          </Typography>
        </Box>

        {!hideSearch && (
        <Box
          ref={searchWrapRef}
          sx={{
            position: 'relative',
            justifySelf: 'center',
            width: '100%',
            maxWidth: {
              xs: '100%',
              sm: searchMaxWidth?.sm ?? 420,
              md: searchMaxWidth?.md ?? 540,
            },
            display: { xs: 'none', sm: 'block' },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              height: 40,
              px: 1.5,
              borderRadius: `${radii.pill}px`,
              bgcolor: colors.surface,
              border: `1px solid ${colors.borderDisabled}`,
              opacity: searchDisabled ? 0.6 : 1,
            }}
          >
            <DesignIcon category="ui" name="search" size={18} />
            <InputBase
              placeholder="Поиск клиентов, сотрудников, групп"
              value={searchValue}
              disabled={searchDisabled}
              onChange={(e) => {
                onSearchChange?.(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              inputProps={{ 'aria-label': 'Глобальный поиск' }}
              sx={{
                flex: 1,
                fontSize: typography.label,
                color: colors.text,
                '& input::placeholder': { color: colors.textHint, opacity: 1 },
              }}
            />
          </Box>
          {showSearchDropdown && (
            <Box
              sx={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                bgcolor: colors.card,
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
                boxShadow: '0 8px 28px rgba(32,34,36,0.12)',
                maxHeight: 360,
                overflowY: 'auto',
                zIndex: 40,
                py: 0.5,
              }}
            >
              {searchLoading && (
                <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: colors.textHint }}>
                  Поиск…
                </Typography>
              )}
              {!searchLoading && searchResults && !hasSearchHits && (
                <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: colors.textHint }}>
                  Ничего не найдено
                </Typography>
              )}
              {!searchLoading && searchResults && (
                <>
                  {renderSearchSection('Клиенты', searchResults.clients)}
                  {renderSearchSection('Сотрудники', searchResults.trainers)}
                  {renderSearchSection('Группы', searchResults.groups)}
                </>
              )}
            </Box>
          )}
        </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            justifySelf: 'end',
            flexShrink: 0,
          }}
        >
          {!hideSearch && (
          <IconButton
            aria-label="Поиск"
            size="small"
            disabled={searchDisabled}
            onClick={() => {
              setMobileSearchOpen(true);
              setSearchOpen(true);
            }}
            sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: colors.textMuted }}
          >
            <SearchIcon sx={{ fontSize: 22 }} />
          </IconButton>
          )}

          <Box sx={{ position: 'relative' }}>
            <IconButton aria-label="Уведомления" size="small" sx={{ color: colors.textMuted }}>
              <NotificationsNone sx={{ fontSize: 22 }} />
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
              px: 0.5,
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: colors.textMuted,
                color: colors.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
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
            PaperProps={{ sx: { minWidth: 260 } }}
          >
            {savedAccounts.map((account) => {
              const isActive = account.id === activeAccountId;
              return (
                <MenuItem
                  key={account.id}
                  selected={isActive}
                  disabled={isActive}
                  onClick={() => {
                    setMenuAnchor(null);
                    if (!isActive) switchToAccount(account.id);
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {isActive ? <Check fontSize="small" /> : null}
                  </ListItemIcon>
                  <ListItemText
                    primary={account.displayName}
                    secondary={account.subtitle || undefined}
                    primaryTypographyProps={{
                      noWrap: true,
                      sx: { maxWidth: 200, fontWeight: isActive ? 700 : 500 },
                    }}
                    secondaryTypographyProps={{ noWrap: true, sx: { maxWidth: 200 } }}
                  />
                </MenuItem>
              );
            })}
            {savedAccounts.length > 0 && <Divider />}
            {onAddAccount && (
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  onAddAccount();
                }}
              >
                <ListItemIcon>
                  <PersonAddAlt1 fontSize="small" />
                </ListItemIcon>
                Добавить аккаунт
              </MenuItem>
            )}
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
      </Box>

      {!hideSearch && mobileSearchOpen && (
        <Box
          ref={mobileSearchRef}
          sx={{
            display: { xs: 'block', sm: 'none' },
            position: 'sticky',
            top: 56,
            zIndex: 28,
            bgcolor: colors.card,
            borderBottom: `1px solid ${colors.surface}`,
            px: 2,
            py: 1.5,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              height: 40,
              px: 1.5,
              borderRadius: `${radii.pill}px`,
              bgcolor: colors.surface,
              border: `1px solid ${colors.borderDisabled}`,
            }}
          >
            <DesignIcon category="ui" name="search" size={18} />
            <InputBase
              autoFocus
              placeholder="Поиск клиентов, сотрудников, групп"
              value={searchValue}
              disabled={searchDisabled}
              onChange={(e) => {
                onSearchChange?.(e.target.value);
                setSearchOpen(true);
              }}
              inputProps={{ 'aria-label': 'Глобальный поиск' }}
              sx={{
                flex: 1,
                fontSize: typography.label,
                color: colors.text,
                '& input::placeholder': { color: colors.textHint, opacity: 1 },
              }}
            />
            <IconButton
              size="small"
              aria-label="Закрыть поиск"
              onClick={() => {
                setMobileSearchOpen(false);
                setSearchOpen(false);
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
          {showSearchDropdown && (
            <Box
              sx={{
                mt: 1,
                bgcolor: colors.card,
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
                maxHeight: 320,
                overflowY: 'auto',
                py: 0.5,
              }}
            >
              {searchLoading && (
                <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: colors.textHint }}>
                  Поиск…
                </Typography>
              )}
              {!searchLoading && searchResults && !hasSearchHits && (
                <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: colors.textHint }}>
                  Ничего не найдено
                </Typography>
              )}
              {!searchLoading && searchResults && (
                <>
                  {renderSearchSection('Клиенты', searchResults.clients)}
                  {renderSearchSection('Сотрудники', searchResults.trainers)}
                  {renderSearchSection('Группы', searchResults.groups)}
                </>
              )}
            </Box>
          )}
        </Box>
      )}

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
              top: 56,
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
            px: { xs: 2, md: 3 },
            py: { xs: 2, md: 2.5 },
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 2, md: 2.5 },
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
                  fontSize: { xs: 20, md: typography.pageTitle },
                  fontWeight: 700,
                  color: colors.text,
                  lineHeight: 1.2,
                }}
              >
                {pageTitle}
              </Typography>
            )}
            {pageAction && (
              <Box sx={{ width: { xs: '100%', sm: 'auto' }, '& > *': { width: { xs: '100%', sm: 'auto' } } }}>
                {pageAction}
              </Box>
            )}
          </Box>

          <Box sx={{ flex: 1 }}>{children}</Box>

          <Box
            component="footer"
            sx={{
              textAlign: 'center',
              pt: 2,
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
              © {new Date().getFullYear()} ПРОФСПОРТСРМ. Все права защищены.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardShell;
