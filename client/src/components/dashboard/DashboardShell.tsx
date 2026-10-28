import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  KeyboardArrowDown,
  Logout,
  NotificationsNone,
  Check,
  PersonAddAlt1,
  HomeOutlined,
  PeopleAltOutlined,
  CalendarMonthOutlined,
  ChatBubbleOutline,
  PaymentsOutlined,
  Menu as MenuIcon,
  Add,
  ChevronRight,
  ArrowForward,
  HeadsetMicOutlined,
} from '@mui/icons-material';
import { colors, radii, sizes, typography } from '../../theme/tokens';
import DesignIcon from '../common/DesignIcon';
import NotificationsBell from '../notifications/NotificationsBell';
import { NavIconName } from '../../assets/icons/registry';
import { useCreateFlowsOptional } from '../../contexts/CreateFlowsContext';
import {
  getActiveAccountId,
  listUsableSavedAccounts,
  switchToAccountSafe,
  upsertFromActiveStorage,
  canSwitchToSavedAccount,
  type SavedAccountSlot,
} from '../../utils/accountSwitcher';
import { useMultiAccountUnread } from '../../hooks/useMultiAccountUnread';

const SIDEBAR_GRADIENT =
  'linear-gradient(180deg, #09182F 0%, #0A1A35 64%, #102958 100%)';
const NAV_ACTIVE_GRADIENT = `linear-gradient(90deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`;

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
  /** Заголовок группы в сайдбаре (не кликабелен). */
  variant?: 'item' | 'header';
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
  /** Слот в шапке слева от колокольчика (свитчер учеников ЛК). */
  headerLeading?: React.ReactNode;
  navItems: ShellNavItem[];
  activeKey: string;
  /** Имя и роль в шапке. */
  userName: string;
  userRole: string;
  /** Количество непрочитанных уведомлений (legacy; если передан NotificationsBell — не нужен). */
  notifications?: number;
  /** Канал колокольчика: school CRM или ЛК клиента. */
  notificationsChannel?: 'school' | 'portal' | null;
  onLogout: () => void;
  /** Добавить ещё один аккаунт (очистить активную сессию, оставить реестр). */
  onAddAccount?: () => void;
  /** Поисковая строка отключена (например, в режиме ожидания подтверждения). */
  searchDisabled?: boolean;
  /** Полностью скрыть поиск (ЛК клиента). */
  hideSearch?: boolean;
  /**
   * Кнопка «Нужна помощь?» в сайдбаре / мобильном меню.
   * По умолчанию: скрыта в ЛК клиента (portal), видна в кабинете школы.
   */
  showSupportHelp?: boolean;
  /** На xs скрыть нижний бар (Главная/Календарь/…) — полноэкранный контент, напр. чаты. */
  hideMobileBottomNav?: boolean;
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
 * Каркас кабинета: на md+ тёмный navy-сайдбар и полоса поиска ⌘K;
 * на xs — светлая шапка и нижний бар (макет 11/30).
 */
const DashboardShell: React.FC<DashboardShellProps> = ({
  pageTitle,
  pageAction,
  headerLeading,
  navItems,
  activeKey,
  userName,
  userRole,
  notifications = 0,
  notificationsChannel = null,
  onLogout,
  onAddAccount,
  searchDisabled,
  hideSearch = false,
  showSupportHelp,
  hideMobileBottomNav = false,
  searchMaxWidth,
  searchValue = '',
  onSearchChange,
  searchResults = null,
  searchLoading = false,
  onSearchResultClick,
  children,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const createFlows = useCreateFlowsOptional();
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [createSheetOpen, setCreateSheetOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [savedAccounts, setSavedAccounts] = React.useState<SavedAccountSlot[]>([]);
  const [activeAccountId, setActiveAccountId] = React.useState<string | null>(null);
  const [slotAccess, setSlotAccess] = React.useState<Record<string, boolean>>({});
  const searchWrapRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const { counts: accountUnreadCounts, otherAccountsUnread } = useMultiAccountUnread({
    menuOpen: Boolean(menuAnchor),
  });
  const shortcutLabel = React.useMemo(() => {
    if (typeof navigator === 'undefined') return 'Ctrl K';
    const platform = navigator.platform || '';
    const ua = navigator.userAgent || '';
    return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS/i.test(ua) ? '⌘K' : 'Ctrl K';
  }, []);

  React.useEffect(() => {
    if (!menuAnchor) return;
    // Подхватить текущую сессию, если пользователь залогинен до появления реестра
    upsertFromActiveStorage();
    const accounts = listUsableSavedAccounts();
    setSavedAccounts(accounts);
    setActiveAccountId(getActiveAccountId());

    let cancelled = false;
    const testingOn =
      sessionStorage.getItem('testingMode') === '1' ||
      sessionStorage.getItem('closedTestingMode') === '1';
    const maintenanceOn = sessionStorage.getItem('maintenanceMode') === '1';
    if (!testingOn && !maintenanceOn) {
      setSlotAccess({});
      return;
    }

    void (async () => {
      const next: Record<string, boolean> = {};
      await Promise.all(
        accounts.map(async (account) => {
          next[account.id] = await canSwitchToSavedAccount(account);
        })
      );
      if (!cancelled) setSlotAccess(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [menuAnchor]);

  // Авто-синхронизация SA/Tester в свитчере при привязке/отвязке без повторного входа
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!localStorage.getItem('token') || !localStorage.getItem('user')) return;
      try {
        const { syncLinkedPlatformAccounts } = await import('../../utils/authSession');
        const result = await syncLinkedPlatformAccounts();
        if (cancelled || result.kickedTo) return;
        if (result.changed || menuAnchor) {
          setSavedAccounts(listUsableSavedAccounts());
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
    const onVis = () => {
      if (document.visibilityState === 'visible') void run();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const timer = window.setInterval(run, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
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

  React.useEffect(() => {
    if (hideSearch || searchDisabled) return;
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || (e.key !== 'k' && e.key !== 'K')) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) {
        if (document.activeElement === searchInputRef.current) return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hideSearch, searchDisabled]);

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

  const desktopNavItems = navItems.filter((item) => {
    if (
      userRole !== 'Тренер' &&
      (item.key === '/trainer/profile' || item.key === '/trainer/earnings')
    ) {
      return false;
    }
    return true;
  });

  const nav = (
    <Box
      component="nav"
      aria-label="Основное меню"
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.15, py: 0.75, px: 1, flex: 1 }}
    >
      {desktopNavItems.map((item) => {
        if (item.variant === 'header') {
          return (
            <Typography
              key={item.key}
              component="div"
              sx={{
                px: 1,
                pt: 1.15,
                pb: 0.35,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: colors.sidebarMuted,
                userSelect: 'none',
              }}
            >
              {item.label}
            </Typography>
          );
        }
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
              gap: 1,
              width: '100%',
              border: 'none',
              textAlign: 'left',
              fontFamily: 'inherit',
              cursor: interactive ? 'pointer' : 'default',
              px: 1.25,
              py: 0.78,
              borderRadius: 10,
              bgcolor: active ? undefined : 'transparent',
              background: active ? NAV_ACTIVE_GRADIENT : 'transparent',
              color: active ? colors.white : item.disabled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.82)',
              opacity: item.disabled ? 0.7 : 1,
              boxShadow: active ? '0 5px 14px rgba(47, 107, 255, 0.3)' : 'none',
              transition: 'background 160ms ease, color 160ms ease, box-shadow 160ms ease',
              '&:hover':
                interactive && !active
                  ? { bgcolor: colors.sidebarSoft, color: colors.white }
                  : undefined,
              '& img': {
                flexShrink: 0,
                filter: active ? undefined : 'brightness(0) invert(1)',
                opacity: active ? 1 : 0.78,
              },
            }}
          >
            {item.iconName ? (
              <DesignIcon category="nav" name={item.iconName} size={18} active={active} />
            ) : (
              item.icon
            )}
            <Typography
              component="span"
              sx={{
                flex: 1,
                fontSize: typography.label,
                fontWeight: active ? 700 : 500,
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
                  bgcolor: active ? 'rgba(255,255,255,0.95)' : 'rgba(0, 182, 155, 0.28)',
                  color: active ? colors.primary : '#5DFFC8',
                  fontSize: 10,
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

  /** Порядок и состав групп — макет 30. Остальные ссылки — в «Справка». */
  const MOBILE_NAV_GROUPS: Array<{ title: string; keys: string[] }> = [
    {
      title: 'Организация',
      keys: ['/dashboard', '/clients', '/trainers', '/groups'],
    },
    {
      title: 'Работа и планирование',
      keys: ['/chats', '/staff-workspace', '/schedule', '/training-plan'],
    },
    {
      title: 'Платежи и система',
      keys: ['/memberships', '/finance', '/settings'],
    },
  ];
  const MOBILE_EXTRA_KEYS = [
    '/faq',
    '/news',
    '/feedback',
    '/pricing',
    '/trainer/profile',
    '/trainer/earnings',
  ];

  const mobileLinkItems = navItems.filter((item) => item.variant !== 'header');
  const byKey = new Map(mobileLinkItems.map((item) => [item.key, item]));
  const usedMobileKeys = new Set<string>();
  const mobileGroups = MOBILE_NAV_GROUPS.map((group) => {
    const items = group.keys
      .map((key) => byKey.get(key))
      .filter((item): item is ShellNavItem => Boolean(item))
      .map((item) => {
        usedMobileKeys.add(item.key);
        return item;
      });
    return { title: group.title, items };
  }).filter((g) => g.items.length > 0);

  const extraItems: ShellNavItem[] = [];
  for (const key of MOBILE_EXTRA_KEYS) {
    const item = byKey.get(key);
    if (!item || usedMobileKeys.has(item.key)) continue;
    usedMobileKeys.add(item.key);
    extraItems.push(item);
  }
  const leftoverMobile = mobileLinkItems.filter((item) => !usedMobileKeys.has(item.key));
  if (extraItems.length || leftoverMobile.length) {
    mobileGroups.push({ title: 'Справка', items: [...extraItems, ...leftoverMobile] });
  }

  const renderMobileNavItem = (item: ShellNavItem) => {
    const active = item.key === activeKey;
    const interactive = !item.disabled && Boolean(item.onClick);
    const showBadge = typeof item.badge === 'number' && item.badge > 0;
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
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          border: 'none',
          borderBottom: `1px solid ${colors.divider}`,
          textAlign: 'left',
          fontFamily: 'inherit',
          cursor: interactive ? 'pointer' : 'default',
          px: 1.75,
          py: 1.5,
          bgcolor: 'transparent',
          color: active ? colors.primary : item.disabled ? colors.textHint : colors.text,
          opacity: item.disabled ? 0.6 : 1,
          '&:last-child': { borderBottom: 'none' },
          '&:hover': interactive ? { bgcolor: 'rgba(47, 107, 255, 0.04)' } : undefined,
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: `2px solid ${active ? colors.primary : colors.divider}`,
            bgcolor: active ? colors.primarySoft : colors.card,
            flexShrink: 0,
          }}
        />
        <Typography
          component="span"
          sx={{
            flex: 1,
            fontSize: 15,
            fontWeight: active ? 700 : 500,
            lineHeight: 1.25,
            minWidth: 0,
          }}
        >
          {item.label}
        </Typography>
        {showBadge ? (
          <Box
            component="span"
            sx={{
              flexShrink: 0,
              minWidth: 22,
              height: 22,
              px: item.badge! > 9 ? 0.65 : 0,
              borderRadius: 999,
              bgcolor: 'rgba(0, 182, 155, 0.16)',
              color: colors.success,
              fontSize: 11,
              fontWeight: 700,
              lineHeight: '22px',
              textAlign: 'center',
            }}
          >
            {item.badge! > 99 ? '99+' : item.badge}
          </Box>
        ) : (
          <ChevronRight sx={{ fontSize: 20, color: colors.primary, flexShrink: 0, opacity: 0.85 }} />
        )}
      </Box>
    );
  };

  const wordmark = (
    <Typography
      component="span"
      sx={{
        fontSize: 16,
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
  );

  const wordmarkLight = (
    <Typography
      component="span"
      sx={{
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.025em',
        whiteSpace: 'nowrap',
        color: colors.white,
      }}
    >
      ПРОФСПОРТСРМ
    </Typography>
  );

  const renderHeaderActions = () => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, md: 1 },
            justifySelf: 'end',
          }}
        >
          {/* Mobile: кнопка меню */}
          <IconButton
            aria-label={mobileNavOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMobileNavOpen((v) => !v)}
            sx={{
              display: { xs: 'inline-flex', md: 'none' },
              color: colors.text,
            }}
          >
            <MenuIcon />
          </IconButton>

          {headerLeading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: { xs: 0.25, md: 0.5 } }}>
              {headerLeading}
            </Box>
          ) : null}

          {notificationsChannel ? (
            <NotificationsBell channel={notificationsChannel} />
          ) : (
          <Box sx={{ position: 'relative' }}>
            <IconButton aria-label="Уведомления" sx={{ color: colors.textMuted }}>
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
          )}

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
              position: 'relative',
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: { xs: 32, md: 28 },
                height: { xs: 32, md: 28 },
                borderRadius: '50%',
                bgcolor: colors.primary,
                color: colors.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: { xs: 14, md: 11 },
                fontWeight: 700,
                position: 'relative',
              }}
            >
              {userName.slice(0, 1).toUpperCase() || '—'}
              {otherAccountsUnread > 0 && (
                <Box
                  aria-label={`Непрочитанные на других аккаунтах: ${otherAccountsUnread}`}
                  sx={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    px: 0.4,
                    borderRadius: '999px',
                    bgcolor: colors.danger,
                    color: colors.white,
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${colors.card}`,
                  }}
                >
                  {otherAccountsUnread > 9 ? '9+' : otherAccountsUnread}
                </Box>
              )}
            </Box>
            <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left', minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: typography.label,
                  fontWeight: 600,
                  color: colors.text,
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
            <KeyboardArrowDown sx={{ color: colors.textHint, display: { xs: 'none', md: 'block' } }} />
          </Box>
        </Box>
  );

  const accountMenu = (
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
        const maintenanceOn = sessionStorage.getItem('maintenanceMode') === '1';
        const testingOn =
          sessionStorage.getItem('testingMode') === '1' ||
          sessionStorage.getItem('closedTestingMode') === '1';
        const restricted = maintenanceOn || testingOn;
        const knownAccess = slotAccess[account.id];
        const blockedByMode =
          restricted &&
          account.accountType !== 'SUPER_ADMIN' &&
          knownAccess !== true;
        const blockedReason = maintenanceOn
          ? 'Во время техобслуживания доступен только супер-админ'
          : 'Аккаунт не в списке тестирования';
        const unread = !isActive ? accountUnreadCounts[account.id] || 0 : 0;
        return (
          <MenuItem
            key={account.id}
            selected={isActive}
            disabled={isActive || blockedByMode}
            onClick={() => {
              setMenuAnchor(null);
              if (isActive || blockedByMode) return;
              void switchToAccountSafe(account.id);
            }}
            title={blockedByMode ? blockedReason : undefined}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {isActive ? <Check fontSize="small" /> : null}
            </ListItemIcon>
            <ListItemText
              primary={account.displayName}
              secondary={
                blockedByMode
                  ? maintenanceOn
                    ? 'Недоступно (техобслуживание)'
                    : 'Недоступно (нет в списке тестирования)'
                  : account.subtitle || undefined
              }
              primaryTypographyProps={{
                noWrap: true,
                sx: { maxWidth: 180, fontWeight: isActive ? 700 : 500 },
              }}
              secondaryTypographyProps={{ noWrap: true, sx: { maxWidth: 180 } }}
            />
            {unread > 0 && (
              <Box
                component="span"
                sx={{
                  ml: 1,
                  minWidth: 22,
                  height: 22,
                  px: 0.75,
                  borderRadius: '999px',
                  bgcolor: colors.danger,
                  color: colors.white,
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {unread > 99 ? '99+' : unread}
              </Box>
            )}
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
  );

  const searchField = !hideSearch ? (
    <Box
      ref={searchWrapRef}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: searchMaxWidth?.md ?? 374,
        flex: '0 1 auto',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 34,
          px: 1.4,
          borderRadius: `${radii.pill}px`,
          bgcolor: colors.surface,
          border: `1px solid ${colors.borderDisabled}`,
          opacity: searchDisabled ? 0.6 : 1,
        }}
      >
        <DesignIcon category="ui" name="search" size={18} />
        <InputBase
          inputRef={searchInputRef}
          placeholder="Поиск клиентов, сотрудников, групп..."
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
        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            px: 0.65,
            py: 0.25,
            borderRadius: 1,
            border: `1px solid ${colors.divider}`,
            bgcolor: colors.card,
            fontSize: 9,
            fontWeight: 600,
            color: colors.textHint,
            lineHeight: 1.2,
            letterSpacing: '0.02em',
            userSelect: 'none',
          }}
        >
          {shortcutLabel}
        </Box>
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
  ) : null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: colors.surface,
        display: 'flex',
        flexDirection: 'column',
        ...(hideMobileBottomNav
          ? { height: { xs: '100dvh', md: 'auto' }, overflow: { xs: 'hidden', md: 'visible' } }
          : {}),
      }}
    >
      {/* Мобильная шапка: вордмарк + действия (не монтируем вместе с md-шапкой — один NotificationsBell) */}
      {!isMdUp && (
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            columnGap: 1,
            px: 2,
            py: 1.1,
            bgcolor: colors.card,
            borderBottom: `1px solid ${colors.surface}`,
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {wordmark}
          {renderHeaderActions()}
        </Box>
      )}
      {accountMenu}

      {/* Меню + контент */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box
          sx={{
            width: sizes.sidebarWidth,
            flexShrink: 0,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            background: SIDEBAR_GRADIENT,
            position: 'sticky',
            top: 0,
            alignSelf: 'flex-start',
            height: '100vh',
            maxHeight: '100vh',
            overflow: 'hidden',
            isolation: 'isolate',
            '&::before': {
              content: '""',
              position: 'absolute',
              zIndex: -1,
              left: -95,
              right: -75,
              bottom: -115,
              height: 285,
              borderRadius: '50%',
              background:
                'radial-gradient(ellipse at 52% 24%, rgba(55,111,255,0.6) 0 18%, rgba(30,70,170,0.6) 19% 34%, rgba(16,41,88,0.2) 35% 52%, transparent 53%)',
              transform: 'rotate(-12deg)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              zIndex: -1,
              width: 185,
              height: 110,
              right: -72,
              bottom: 62,
              borderRadius: '50%',
              border: '22px solid rgba(50,105,245,0.24)',
              transform: 'rotate(-20deg)',
            },
          }}
        >
          <Box sx={{ px: 2, pt: 2, pb: 1.1, flexShrink: 0 }}>{wordmarkLight}</Box>
          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, position: 'relative', zIndex: 1 }}>{nav}</Box>
          {(showSupportHelp ?? !(hideSearch || notificationsChannel === 'portal')) && (
            <Box
              component="button"
              type="button"
              aria-label="Нужна помощь"
              onClick={() => {
                window.dispatchEvent(new Event('crm:open-support'));
              }}
              sx={{
                m: 1.25,
                mt: 0.35,
                mb: 1.25,
                p: 1.15,
                border: 'none',
                borderRadius: 14,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: 'rgba(255,255,255,0.08)',
                color: colors.white,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
                '&:hover': { background: 'rgba(255,255,255,0.14)' },
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '10px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(145deg, #4B8BFF 0%, #2F6BFF 100%)',
                  boxShadow: '0 4px 12px rgba(47, 107, 255, 0.35)',
                }}
              >
                <HeadsetMicOutlined sx={{ fontSize: 18, color: '#fff' }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: colors.white, lineHeight: 1.2 }}>
                  Нужна помощь?
                </Typography>
                <Typography
                  sx={{
                    mt: 0.25,
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.68)',
                    lineHeight: 1.3,
                  }}
                >
                  Свяжитесь с нашей командой разработчиков
                </Typography>
              </Box>
              <ArrowForward sx={{ fontSize: 14, opacity: 0.75, flexShrink: 0 }} />
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {isMdUp && (
            <Box
              component="header"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2.5,
                py: 0.75,
                minHeight: 48,
                bgcolor: colors.card,
                borderBottom: `1px solid ${colors.divider}`,
                position: 'sticky',
                top: 0,
                zIndex: 20,
              }}
            >
              {searchField}
              <Box sx={{ flex: 1, minWidth: 8 }} aria-hidden />
              <Box sx={{ flexShrink: 0, ml: 'auto' }}>{renderHeaderActions()}</Box>
            </Box>
          )}

        {mobileNavOpen && (
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              top: 56,
              zIndex: 25,
              bgcolor: colors.surface,
              overflowY: 'auto',
              display: { md: 'none' },
              px: 1.5,
              pt: 1.5,
              pb: 12,
            }}
          >
            <Box sx={{ px: 1, mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 20, color: colors.text }}>
                Все разделы
              </Typography>
              <Typography sx={{ fontSize: 13, color: colors.textHint, mt: 0.35 }}>
                Быстрый доступ к возможностям CRM
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {mobileGroups.map((group) => (
                <Box
                  key={group.title}
                  sx={{
                    bgcolor: colors.card,
                    borderRadius: `${radii.panel}px`,
                    boxShadow: '0 2px 12px rgba(32, 34, 36, 0.06)',
                    border: `1px solid ${colors.divider}`,
                    overflow: 'hidden',
                  }}
                >
                  <Typography
                    sx={{
                      px: 1.75,
                      pt: 1.5,
                      pb: 0.75,
                      fontSize: 14,
                      fontWeight: 700,
                      color: colors.text,
                    }}
                  >
                    {group.title}
                  </Typography>
                  {group.items.map((item) => renderMobileNavItem(item))}
                </Box>
              ))}
              {(showSupportHelp ?? !(hideSearch || notificationsChannel === 'portal')) && (
                <Box
                  component="button"
                  type="button"
                  aria-label="Нужна помощь"
                  onClick={() => {
                    setMobileNavOpen(false);
                    window.dispatchEvent(new Event('crm:open-support'));
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    width: '100%',
                    p: 1.5,
                    border: 'none',
                    borderRadius: 14,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    background: 'linear-gradient(135deg, #1B2438 0%, #243356 100%)',
                    color: '#fff',
                    boxShadow: '0 8px 24px rgba(27, 36, 56, 0.18)',
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(145deg, #4B8BFF 0%, #2F6BFF 100%)',
                    }}
                  >
                    <HeadsetMicOutlined sx={{ fontSize: 20, color: '#fff' }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                      Нужна помощь?
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35 }}>
                      Свяжитесь с нашей командой разработчиков
                    </Typography>
                  </Box>
                  <ArrowForward sx={{ fontSize: 18, opacity: 0.8 }} />
                </Box>
              )}
            </Box>
          </Box>
        )}

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            bgcolor: colors.surface,
            px: hideMobileBottomNav ? { xs: 0, md: 3 } : { xs: 2, md: 3 },
            py: hideMobileBottomNav ? { xs: 0, md: 2.5 } : { xs: 2, md: 2.5 },
            pb: hideMobileBottomNav ? { xs: 0, md: 2.5 } : { xs: 11, md: 2.5 },
            display: 'flex',
            flexDirection: 'column',
            gap: hideMobileBottomNav ? { xs: 0, md: 2.5 } : { xs: 2, md: 2.5 },
            ...(hideMobileBottomNav
              ? { flex: 1, minHeight: { xs: 0, md: 'auto' } }
              : {}),
          }}
        >
          {(pageTitle || pageAction) && (
            <Box
              sx={{
                display: hideMobileBottomNav ? { xs: 'none', md: 'flex' } : 'flex',
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
                    fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md },
                    fontWeight: 800,
                    color: '#1B2438',
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
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
          )}

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              ...(hideMobileBottomNav
                ? {
                    minHeight: { xs: 0, md: 0 },
                    height: { xs: 'calc(100dvh - 56px)', md: 'auto' },
                    display: { xs: 'flex', md: 'block' },
                    flexDirection: { xs: 'column' },
                  }
                : {}),
            }}
          >
            {children}
          </Box>

          <Box
            sx={{
              display: hideMobileBottomNav ? 'none' : { xs: 'flex', md: 'none' },
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 30,
              bgcolor: colors.card,
              borderTop: `1px solid ${colors.divider}`,
              boxShadow: '0 -4px 16px rgba(32,34,36,0.06)',
              px: 0.5,
              pt: 0.75,
              pb: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
              justifyContent: 'space-around',
              alignItems: 'flex-end',
            }}
          >
            {(() => {
              const isPortal = hideSearch || notificationsChannel === 'portal';
              const leftTabs = isPortal
                ? ([
                    { key: 'dashboard', label: 'Главная', icon: <HomeOutlined sx={{ fontSize: 18 }} /> },
                    { key: 'plan', label: 'Календарь', icon: <CalendarMonthOutlined sx={{ fontSize: 18 }} /> },
                  ] as const)
                : ([
                    { key: '/dashboard', label: 'Главная', icon: <HomeOutlined sx={{ fontSize: 18 }} /> },
                    { key: '/schedule', label: 'Календарь', icon: <CalendarMonthOutlined sx={{ fontSize: 18 }} /> },
                  ] as const);
              const rightTabs = isPortal
                ? ([
                    { key: 'chats', label: 'Чаты', icon: <ChatBubbleOutline sx={{ fontSize: 18 }} /> },
                    { key: 'payments', label: 'Платежи', icon: <PaymentsOutlined sx={{ fontSize: 18 }} /> },
                  ] as const)
                : null;

              const renderTab = (tab: { key: string; label: string; icon: React.ReactNode }) => {
                const item = navItems.find((n) => n.key === tab.key);
                const active = activeKey === tab.key && !mobileNavOpen;
                return (
                  <Box
                    key={tab.key}
                    component="button"
                    type="button"
                    disabled={!item || item.disabled}
                    onClick={() => {
                      setMobileNavOpen(false);
                      item?.onClick?.();
                    }}
                    sx={{
                      border: 'none',
                      bgcolor: 'transparent',
                      color: active ? colors.primary : colors.textHint,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.25,
                      fontSize: typography.label,
                      fontWeight: active ? 700 : 500,
                      cursor: item ? 'pointer' : 'default',
                      opacity: item ? 1 : 0.4,
                      minWidth: 56,
                      pb: 0.25,
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </Box>
                );
              };

              return (
                <>
                  {leftTabs.map(renderTab)}

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: 64,
                      position: 'relative',
                      top: -14,
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      aria-label="Создать"
                      disabled={!createFlows}
                      onClick={() => {
                        setMobileNavOpen(false);
                        setCreateSheetOpen(true);
                      }}
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        border: 'none',
                        bgcolor: colors.primary,
                        color: colors.white,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 6px 18px rgba(47, 107, 255, 0.4)',
                        cursor: createFlows ? 'pointer' : 'default',
                        opacity: createFlows ? 1 : 0.5,
                        '&:hover': createFlows ? { bgcolor: colors.primaryDark } : undefined,
                      }}
                    >
                      <Add sx={{ fontSize: 30 }} />
                    </Box>
                  </Box>

                  {rightTabs ? (
                    rightTabs.map(renderTab)
                  ) : (
                    <>
                      {(() => {
                        const clientsItem = navItems.find((n) => n.key === '/clients');
                        const clientsActive = activeKey === '/clients' && !mobileNavOpen;
                        return (
                          <Box
                            component="button"
                            type="button"
                            disabled={!clientsItem || clientsItem.disabled}
                            onClick={() => {
                              setMobileNavOpen(false);
                              clientsItem?.onClick?.();
                            }}
                            sx={{
                              border: 'none',
                              bgcolor: 'transparent',
                              color: clientsActive ? colors.primary : colors.textHint,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 0.25,
                              fontSize: typography.label,
                              fontWeight: clientsActive ? 700 : 500,
                              cursor: clientsItem ? 'pointer' : 'default',
                              opacity: clientsItem ? 1 : 0.4,
                              minWidth: 56,
                              pb: 0.25,
                            }}
                          >
                            <PeopleAltOutlined sx={{ fontSize: 18 }} />
                            Клиенты
                          </Box>
                        );
                      })()}

                      <Box
                        component="button"
                        type="button"
                        onClick={() => setMobileNavOpen((v) => !v)}
                        sx={{
                          border: 'none',
                          bgcolor: 'transparent',
                          color: mobileNavOpen ? colors.primary : colors.textHint,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.25,
                          fontSize: typography.label,
                          fontWeight: mobileNavOpen ? 700 : 500,
                          cursor: 'pointer',
                          minWidth: 56,
                          pb: 0.25,
                        }}
                      >
                        <MenuIcon sx={{ fontSize: 18 }} />
                        Меню
                      </Box>
                    </>
                  )}
                </>
              );
            })()}
          </Box>

          {createSheetOpen && (
            <Box
              sx={{
                display: { xs: 'block', md: 'none' },
                position: 'fixed',
                inset: 0,
                zIndex: 40,
                bgcolor: 'rgba(32, 34, 36, 0.4)',
              }}
              onClick={() => setCreateSheetOpen(false)}
            >
              <Box
                role="dialog"
                aria-label="Создать"
                onClick={(e) => e.stopPropagation()}
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: colors.card,
                  borderTopLeftRadius: `${radii.panel}px`,
                  borderTopRightRadius: `${radii.panel}px`,
                  px: 2,
                  pt: 1.5,
                  pb: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
                  boxShadow: '0 -8px 28px rgba(32,34,36,0.16)',
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 4,
                    borderRadius: 999,
                    bgcolor: colors.divider,
                    mx: 'auto',
                    mb: 1.5,
                  }}
                />
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: colors.text, mb: 1.25 }}>
                  Создать
                </Typography>
                {(
                  [
                    {
                      label: 'Клиента',
                      onClick: () => createFlows?.openCreateClient(),
                      show: true,
                    },
                    {
                      label: 'Тренировку',
                      onClick: () => createFlows?.openCreateTraining(),
                      show: true,
                    },
                    {
                      label: 'Платёж',
                      onClick: () => createFlows?.openAddFinanceOperation(),
                      show: Boolean(createFlows),
                    },
                  ] as const
                )
                  .filter((a) => a.show)
                  .map((action) => (
                    <Box
                      key={action.label}
                      component="button"
                      type="button"
                      onClick={() => {
                        setCreateSheetOpen(false);
                        action.onClick();
                      }}
                      sx={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: `1px solid ${colors.divider}`,
                        bgcolor: 'transparent',
                        py: 1.5,
                        px: 0.5,
                        fontFamily: 'inherit',
                        fontSize: 15,
                        fontWeight: 600,
                        color: colors.text,
                        cursor: 'pointer',
                        '&:last-of-type': { borderBottom: 'none' },
                      }}
                    >
                      {action.label}
                    </Box>
                  ))}
              </Box>
            </Box>
          )}

          {!hideMobileBottomNav && (
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
                { label: 'Политика конфиденциальности', href: '/privacy' },
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
          )}
        </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardShell;
