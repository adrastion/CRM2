import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  CheckCircleOutline,
  HomeOutlined,
  PeopleAltOutlined,
  BusinessOutlined,
  PersonOutline,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperAdminAuth } from '../../contexts/SuperAdminAuthContext';
import { useTesterAuth } from '../../contexts/TesterAuthContext';
import DashboardShell, {
  ShellNavItem,
  GlobalSearchResults,
  GlobalSearchResultItem,
} from '../dashboard/DashboardShell';
import { CreateFlowsProvider } from '../../contexts/CreateFlowsContext';
import { logoutCurrentAccount, prepareAddAccount } from '../../utils/accountSwitcher';
import { NavIconName } from '../../assets/icons/registry';
import { apiService } from '../../services/api';
import { useChatUnreadBadge } from '../../hooks/useChatUnreadBadge';
import { useMarketerCabinetReady } from '../../hooks/useMarketerCabinetReady';
import { canAccessAdminNav } from '../../utils/roles';
import {
  SA_NAV_GROUPS,
  SA_SECTION_TITLES,
  resolveSaLocation,
  saDashboardPath,
} from '../../config/saDashboard';

interface AppLayoutProps {
  children: React.ReactNode;
  /** Заголовок страницы. Если не передан, страница рисует заголовок сама. */
  pageTitle?: string;
}

/** Пункты меню панели управления школы (по макету) с ролевыми ограничениями. */
const navigationItems: Array<{
  label: string;
  path: string;
  iconName: NavIconName;
  roles: string[];
  /** Ключ для настройки видимости вкладок в Settings. */
  tabKey?: string;
  /** Атрибут для интерактивного обучения (InteractiveOnboarding). */
  onboarding?: string;
}> = [
  { label: 'Панель управления', path: '/dashboard', iconName: 'dashboard', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'dashboard', onboarding: 'dashboard' },
  { label: 'Чаты', path: '/chats', iconName: 'chats', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'chats', onboarding: 'chats-nav' },
  { label: 'Заметки и задачи', path: '/staff-workspace', iconName: 'knowledge-base', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'staffWorkspace', onboarding: 'staff-workspace-nav' },
  { label: 'Клиенты', path: '/clients', iconName: 'clients', roles: ['OWNER', 'ADMIN', 'TRAINER', 'PROMOTER'], tabKey: 'clients', onboarding: 'clients-nav' },
  { label: 'Сотрудники', path: '/trainers', iconName: 'staff', roles: ['OWNER', 'ADMIN'], tabKey: 'trainers', onboarding: 'trainers-nav' },
  { label: 'Мой профиль', path: '/trainer/profile', iconName: 'clients', roles: ['TRAINER', 'OWNER'], tabKey: 'trainerProfile', onboarding: 'trainer-profile-nav' },
  { label: 'Мой заработок', path: '/trainer/earnings', iconName: 'earnings', roles: ['TRAINER', 'OWNER'], tabKey: 'trainerEarnings', onboarding: 'trainer-earnings-nav' },
  { label: 'Филиалы и группы', path: '/groups', iconName: 'groups', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'groups', onboarding: 'groups-nav' },
  { label: 'Календарный план', path: '/schedule', iconName: 'schedule', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'schedule', onboarding: 'schedule-nav' },
  { label: 'Тренировочный план', path: '/training-plan', iconName: 'schedule', roles: ['OWNER', 'TRAINER'], tabKey: 'trainingPlan', onboarding: 'training-plan-nav' },
  { label: 'Абонементы', path: '/memberships', iconName: 'tariffs', roles: ['OWNER', 'ADMIN'], tabKey: 'memberships', onboarding: 'memberships-nav' },
  { label: 'Финансы', path: '/finance', iconName: 'finance', roles: ['OWNER', 'ADMIN'], tabKey: 'finance', onboarding: 'payments-nav' },
  { label: 'Настройки', path: '/settings', iconName: 'settings', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'settings', onboarding: 'settings-nav' },
  { label: 'FAQ', path: '/faq', iconName: 'faq', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'faq', onboarding: 'faq-nav' },
  { label: 'Новости', path: '/news', iconName: 'issued-tariffs', roles: ['OWNER', 'ADMIN', 'TRAINER', 'PROMOTER'], tabKey: 'news', onboarding: 'news-nav' },
  { label: 'Связь с разработчиком', path: '/feedback', iconName: 'chats', roles: ['OWNER', 'ADMIN', 'TRAINER', 'PROMOTER'], tabKey: 'feedback', onboarding: 'feedback-nav' },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
  PROMOTER: 'Промоутер',
};

/**
 * Оболочка защищённых страниц: тот же каркас, что и в макете панели управления
 * (шапка с поиском и профилем, боковое меню с ролевой фильтрацией, футер).
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children, pageTitle }) => {
  const { user, tenant, logout } = useAuth();
  const { superAdmin, logout: logoutSuperAdmin } = useSuperAdminAuth();
  const { tester, logout: logoutTester } = useTesterAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdminRoute =
    Boolean(superAdmin && localStorage.getItem('superAdminToken')) &&
    (location.pathname.startsWith('/admin/dashboard') ||
      location.pathname.startsWith('/admin/support-hub'));

  const isTesterRoute =
    Boolean(tester && localStorage.getItem('testerToken')) &&
    location.pathname.startsWith('/tester');

  const isMarketerRoute = location.pathname.startsWith('/marketer/');
  const isPromoCodeAdminRoute = location.pathname.startsWith('/admin/promo-codes');
  const marketerCabinet = useMarketerCabinetReady(isMarketerRoute);
  /** Пока статус неизвестен или онбординг не завершён — рабочее пространство недоступно. */
  const marketerLocked = isMarketerRoute && (marketerCabinet.loading || !marketerCabinet.complete);
  /** Кабинеты вне школьной сессии — без школьных уведомлений/поиска/баннеров. */
  const isNonSchoolShell = isMarketerRoute || isPromoCodeAdminRoute;

  const isPlatformShell = isSuperAdminRoute || isTesterRoute || isNonSchoolShell;

  const schoolToken = !isPlatformShell ? localStorage.getItem('token') : null;
  const chatUnread = useChatUnreadBadge({
    mode: 'staff',
    token: schoolToken,
    enabled: Boolean(schoolToken && user),
  });
  const [devNotesUnread, setDevNotesUnread] = useState(0);
  const [saNotifUnread, setSaNotifUnread] = useState(0);
  const [supportHubUnread, setSupportHubUnread] = useState(0);

  const [visibleTabs, setVisibleTabs] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem('visibleTabs');
    return saved ? JSON.parse(saved) : {};
  });

  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSuperAdminRoute && !isTesterRoute) return;
    // Пока в панели SA/Tester — периодически проверяем, что сессия ещё действительна
    // (отвязка инвалидирует JWT через sessionVersion).
    const ping = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        await apiService.listPlatformChangelog();
      } catch {
        /* 401 interceptor сделает kick */
      }
    };
    const timer = window.setInterval(ping, 60_000);
    const onFocus = () => {
      void ping();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') void ping();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isSuperAdminRoute, isTesterRoute]);

  useEffect(() => {
    if (!isSuperAdminRoute) {
      setDevNotesUnread(0);
      setSaNotifUnread(0);
      setSupportHubUnread(0);
      return;
    }
    let cancelled = false;
    const pull = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const [notes, notifs, support] = await Promise.all([
          apiService.getDevNotesUnreadCount(),
          apiService.getSaNotifications(),
          apiService.superAdminSupportUnreadTotal().catch(() => ({ unreadTotal: 0 })),
        ]);
        if (cancelled) return;
        setDevNotesUnread(notes);
        setSaNotifUnread(notifs.filter((n: { readAt?: string | null }) => !n.readAt).length);
        setSupportHubUnread(Number(support?.unreadTotal) || 0);
      } catch {
        /* сессия могла истечь */
      }
    };
    void pull();
    const timer = window.setInterval(pull, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isSuperAdminRoute]);

  useEffect(() => {
    const handler = (event: CustomEvent) => setVisibleTabs(event.detail.visibleTabs);
    window.addEventListener('tabsVisibilityChange', handler as EventListener);
    return () => window.removeEventListener('tabsVisibilityChange', handler as EventListener);
  }, []);

  useEffect(() => {
    if (isPlatformShell) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchValue.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await apiService.globalSearch(q);
        setSearchResults(data);
      } catch {
        setSearchResults({ clients: [], trainers: [], groups: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchValue, isPlatformShell]);

  const handleLogout = () => {
    const nextDestination = logoutCurrentAccount();
    if (nextDestination) {
      // Полный reload — контексты подхватят другой аккаунт из localStorage
      window.location.assign(nextDestination);
      return;
    }
    if (isSuperAdminRoute) {
      logoutSuperAdmin();
    } else if (isTesterRoute) {
      logoutTester();
    } else {
      logout();
    }
    navigate('/', { replace: true });
  };

  const handleAddAccount = () => {
    // Сначала снимок текущей сессии в реестр, потом сброс React-контекста
    prepareAddAccount();
    if (isSuperAdminRoute) {
      logoutSuperAdmin();
    } else if (isTesterRoute) {
      logoutTester();
    } else {
      logout();
    }
    navigate('/auth', { replace: true });
  };

  const handleSearchResultClick = (item: GlobalSearchResultItem) => {
    setSearchValue('');
    setSearchResults(null);
    if (item.type === 'client') {
      const path = location.pathname;
      const from =
        path.includes('/finance')
          ? 'Финансы'
          : path.includes('/schedule')
            ? 'Календарный план'
            : path.includes('/groups') || path.includes('/branches')
              ? 'Филиалы и группы'
              : path.includes('/trainers') || path.includes('/staff')
                ? 'Сотрудники'
                : 'Клиенты';
      const qs = new URLSearchParams({ clientId: item.id, from });
      navigate(`/clients?${qs.toString()}`);
    } else if (item.type === 'trainer') {
      const qs = new URLSearchParams({ trainerId: item.id, from: 'Поиск' });
      navigate(`/trainers?${qs.toString()}`);
    } else {
      navigate(`/groups?groupId=${encodeURIComponent(item.id)}`);
    }
  };

  const saResolved = resolveSaLocation(location.search);
  const saSection = saResolved.section;

  // Алиасы старых ?section= → канонический URL
  React.useEffect(() => {
    if (!isSuperAdminRoute || !location.pathname.startsWith('/admin/dashboard')) return;
    if (!saResolved.wasAlias) return;
    navigate(saDashboardPath(saResolved.section, saResolved.tab), { replace: true });
  }, [
    isSuperAdminRoute,
    location.pathname,
    saResolved.wasAlias,
    saResolved.section,
    saResolved.tab,
    navigate,
  ]);

  const navItems: ShellNavItem[] = isSuperAdminRoute
    ? [
        ...SA_NAV_GROUPS.flatMap((group) => [
          {
            key: `group:${group.id}`,
            label: group.label,
            variant: 'header' as const,
          },
          ...group.items.map((item) => ({
            key: `/admin/dashboard?section=${item.section}`,
            label: item.label,
            iconName: item.iconName,
            onClick: () => navigate(saDashboardPath(item.section)),
            ...(item.section === 'development' && devNotesUnread > 0 ? { badge: devNotesUnread } : {}),
            ...(item.section === 'notifications' && saNotifUnread > 0 ? { badge: saNotifUnread } : {}),
          })),
        ]),
        {
          key: '/admin/support-hub',
          label: 'Support Hub',
          iconName: 'knowledge-base' as NavIconName,
          onClick: () => navigate('/admin/support-hub'),
          ...(supportHubUnread > 0 ? { badge: supportHubUnread } : {}),
        },
      ]
    : isTesterRoute
      ? [
          {
            key: '/tester/dashboard',
            label: 'Панель тестировщика',
            iconName: 'dashboard',
            onClick: () => navigate('/tester/dashboard'),
          },
        ]
      : isMarketerRoute
        ? ([
            {
              key: 'group:marketer-workspace',
              label: 'Рабочее пространство',
              variant: 'header' as const,
            },
            {
              key: '/marketer/dashboard',
              label: 'Главная',
              iconName: 'dashboard' as const,
              disabled: marketerLocked,
              onClick: marketerLocked ? undefined : () => navigate('/marketer/dashboard'),
            },
            {
              key: '/marketer/clients',
              label: 'Мои организации',
              iconName: 'branches' as const,
              disabled: marketerLocked,
              onClick: marketerLocked ? undefined : () => navigate('/marketer/clients'),
            },
            {
              key: '/marketer/team',
              label: 'Моя команда',
              iconName: 'staff' as const,
              disabled: marketerLocked,
              onClick: marketerLocked ? undefined : () => navigate('/marketer/team'),
            },
            {
              key: '/marketer/finance',
              label: 'Финансы и выплаты',
              iconName: 'finance' as const,
              disabled: marketerLocked,
              onClick: marketerLocked ? undefined : () => navigate('/marketer/finance'),
            },
            {
              key: '/marketer/documents',
              label: 'Документы',
              iconName: 'knowledge-base' as const,
              disabled: marketerLocked,
              onClick: marketerLocked ? undefined : () => navigate('/marketer/documents'),
            },
            {
              key: '/marketer/activity',
              label: 'Моя активность',
              iconName: 'schedule' as const,
              disabled: marketerLocked,
              onClick: marketerLocked ? undefined : () => navigate('/marketer/activity'),
            },
            {
              key: '/marketer/invite',
              label: 'Пригласить маркетолога',
              iconName: 'clients' as const,
              disabled: marketerLocked,
              onClick: marketerLocked ? undefined : () => navigate('/marketer/invite'),
            },
            {
              key: '/marketer/news',
              label: 'Новости',
              iconName: 'issued-tariffs' as const,
              disabled: marketerLocked,
              onClick: marketerLocked ? undefined : () => navigate('/marketer/news'),
            },
            {
              key: 'group:marketer-settings',
              label: 'Аккаунт',
              variant: 'header' as const,
            },
            {
              key: '/marketer/profile',
              label: 'Мой профиль',
              icon: (
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '1.8px solid currentColor',
                    flexShrink: 0,
                  }}
                />
              ),
              onClick: () => navigate('/marketer/profile'),
            },
            {
              key: '/marketer/settings',
              label: 'Настройки',
              iconName: 'settings' as const,
              onClick: () => navigate('/marketer/settings'),
            },
            {
              key: '/marketer/onboarding',
              label: 'Подключение к программе',
              icon: <CheckCircleOutline sx={{ fontSize: 18 }} />,
              onClick: () => navigate('/marketer/onboarding'),
            },
          ] as ShellNavItem[])
        : isPromoCodeAdminRoute
          ? [
              {
                key: '/admin/promo-codes',
                label: 'Промокоды',
                iconName: 'tariffs',
                onClick: () => navigate('/admin/promo-codes'),
              },
            ]
      : navigationItems
          .filter((item) => {
            const role = user?.role || '';
            const roleOk =
              item.roles.includes(role) ||
              (canAccessAdminNav(user) && item.roles.includes('ADMIN') && !item.roles.includes('TRAINER'));
            // «Мой заработок» / «Мой профиль»: TRAINER всегда; OWNER — только с trainerId
            if (item.path === '/trainer/earnings' || item.path === '/trainer/profile') {
              if (role === 'TRAINER') {
                return visibleTabs[item.tabKey!] !== false;
              }
              if (role === 'OWNER' && user?.trainerId) {
                return visibleTabs[item.tabKey!] !== false;
              }
              return false;
            }
            if (!roleOk) return false;
            if (item.tabKey && visibleTabs[item.tabKey] === false) return false;
            return true;
          })
          .map((item) => ({
            key: item.path,
            label: item.label,
            iconName: item.iconName,
            dataOnboarding: item.onboarding,
            onClick: () => navigate(item.path),
            ...(item.path === '/chats' && chatUnread > 0 ? { badge: chatUnread } : {}),
          }));

  const marketerName = (() => {
    try {
      const raw = localStorage.getItem('marketer');
      if (!raw) return '';
      const m = JSON.parse(raw);
      return m?.name || m?.email || '';
    } catch {
      return '';
    }
  })();

  const promoAdminName = (() => {
    try {
      const raw = localStorage.getItem('promoCodeAdmin');
      if (!raw) return '';
      const a = JSON.parse(raw);
      return a?.name || a?.email || '';
    } catch {
      return '';
    }
  })();

  const userName = isSuperAdminRoute
    ? [superAdmin?.lastName, superAdmin?.firstName].filter(Boolean).join(' ') ||
      superAdmin?.email ||
      'Супер-админ'
    : isTesterRoute
      ? [tester?.lastName, tester?.firstName].filter(Boolean).join(' ') ||
        tester?.email ||
        'Тестировщик'
      : isMarketerRoute
        ? marketerName || 'Маркетолог'
        : isPromoCodeAdminRoute
          ? promoAdminName || 'Админ промокодов'
      : user
        ? [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ')
        : '';

  const userRole = isSuperAdminRoute
    ? 'Супер-админ'
    : isTesterRoute
      ? 'Тестировщик'
      : isMarketerRoute
        ? 'Личный кабинет'
        : isPromoCodeAdminRoute
          ? 'Админ промокодов'
      : canAccessAdminNav(user) && user?.role === 'TRAINER'
        ? 'Старший тренер'
        : ROLE_LABELS[user?.role || ''] || tenant?.name || '';

  const marketerActiveKey = (() => {
    const p = location.pathname;
    if (p.startsWith('/marketer/profile')) return '/marketer/profile';
    if (p.startsWith('/marketer/settings')) return '/marketer/settings';
    if (p.startsWith('/marketer/onboarding')) return '/marketer/onboarding';
    if (p.startsWith('/marketer/clients')) return '/marketer/clients';
    if (p.startsWith('/marketer/team')) return '/marketer/team';
    if (p.startsWith('/marketer/finance')) return '/marketer/finance';
    if (p.startsWith('/marketer/documents')) return '/marketer/documents';
    if (p.startsWith('/marketer/activity')) return '/marketer/activity';
    if (p.startsWith('/marketer/invite')) return '/marketer/invite';
    if (p.startsWith('/marketer/news')) return '/marketer/news';
    return '/marketer/dashboard';
  })();

  const activeKey = isSuperAdminRoute
    ? location.pathname.startsWith('/admin/support-hub')
      ? '/admin/support-hub'
      : `/admin/dashboard?section=${saSection}`
    : isTesterRoute
      ? '/tester/dashboard'
      : isMarketerRoute
        ? marketerActiveKey
        : isPromoCodeAdminRoute
          ? '/admin/promo-codes'
      : location.pathname.startsWith('/schedule')
        ? '/schedule'
        : location.pathname;

  const resolvedPageTitle = isSuperAdminRoute
    ? pageTitle ||
      (location.pathname.startsWith('/admin/support-hub')
        ? 'Support Hub'
        : SA_SECTION_TITLES[saSection] || 'Панель супер-админа')
    : isMarketerRoute
      ? pageTitle || undefined
      : isPromoCodeAdminRoute
        ? pageTitle || 'Промокоды'
        : pageTitle;

  const marketerBreadcrumb = (() => {
    if (!isMarketerRoute) return undefined;
    const p = location.pathname;
    if (p.startsWith('/marketer/clients')) return 'Мои организации';
    if (p.startsWith('/marketer/team')) return 'Моя команда';
    if (p.startsWith('/marketer/finance')) return 'Финансы и выплаты';
    if (p.startsWith('/marketer/documents')) return 'Документы';
    if (p.startsWith('/marketer/activity')) return 'Моя активность';
    if (p.startsWith('/marketer/invite')) return 'Пригласить маркетолога';
    if (p.startsWith('/marketer/news')) return 'Новости';
    if (p.startsWith('/marketer/profile')) return 'Мой профиль';
    if (p.startsWith('/marketer/settings')) return 'Настройки';
    if (p.startsWith('/marketer/onboarding')) return 'Подключение к программе';
    return 'Главная';
  })();

  return (
    <Box>
      <CreateFlowsProvider>
        <DashboardShell
          pageTitle={resolvedPageTitle}
          navItems={navItems}
          activeKey={activeKey}
          userName={userName || tenant?.name || 'Профиль'}
          userRole={userRole}
          notificationsChannel={isPlatformShell ? null : 'school'}
          onLogout={handleLogout}
          onAddAccount={handleAddAccount}
          hideSearch={isPlatformShell}
          showSupportHelp={isMarketerRoute ? true : undefined}
          onProfileClick={isMarketerRoute ? () => navigate('/marketer/profile') : undefined}
          shellVariant={isMarketerRoute ? 'marketer' : 'default'}
          breadcrumb={marketerBreadcrumb}
          hideMobileBottomNav={location.pathname.startsWith('/chats')}
          mobileBottomTabs={
            isMarketerRoute
              ? marketerLocked
                ? [
                    {
                      key: '/marketer/profile',
                      label: 'Профиль',
                      icon: <PersonOutline sx={{ fontSize: 18 }} />,
                    },
                    {
                      key: '/marketer/onboarding',
                      label: 'Подключение',
                      icon: <CheckCircleOutline sx={{ fontSize: 18 }} />,
                    },
                  ]
                : [
                    {
                      key: '/marketer/dashboard',
                      label: 'Главная',
                      icon: <HomeOutlined sx={{ fontSize: 18 }} />,
                    },
                    {
                      key: '/marketer/clients',
                      label: 'Организации',
                      icon: <BusinessOutlined sx={{ fontSize: 18 }} />,
                    },
                    {
                      key: '/marketer/team',
                      label: 'Команда',
                      icon: <PeopleAltOutlined sx={{ fontSize: 18 }} />,
                    },
                    {
                      key: '/marketer/finance',
                      label: 'Финансы',
                      icon: <AccountBalanceWalletOutlined sx={{ fontSize: 18 }} />,
                    },
                  ]
              : undefined
          }
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchResults={searchResults}
          searchLoading={searchLoading}
          onSearchResultClick={handleSearchResultClick}
          searchMaxWidth={{ sm: 560, md: 720 }}
        >
          {children}
        </DashboardShell>
      </CreateFlowsProvider>
    </Box>
  );
};

export default AppLayout;
