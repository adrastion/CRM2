import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperAdminAuth } from '../../contexts/SuperAdminAuthContext';
import { useTesterAuth } from '../../contexts/TesterAuthContext';
import DashboardShell, {
  ShellNavItem,
  GlobalSearchResults,
  GlobalSearchResultItem,
} from '../dashboard/DashboardShell';
import SalaryPayoutBanner from '../SalaryPayoutBanner';
import { logoutCurrentAccount, prepareAddAccount } from '../../utils/accountSwitcher';
import { NavIconName } from '../../assets/icons/registry';
import { apiService } from '../../services/api';
import { useChatUnreadBadge } from '../../hooks/useChatUnreadBadge';
import { canAccessAdminNav } from '../../utils/roles';

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
  { label: 'Чаты', path: '/chats', iconName: 'chats', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'chats' },
  { label: 'Клиенты', path: '/clients', iconName: 'clients', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'clients', onboarding: 'clients-nav' },
  { label: 'Сотрудники', path: '/trainers', iconName: 'staff', roles: ['OWNER', 'ADMIN'], tabKey: 'trainers', onboarding: 'trainers-nav' },
  { label: 'Мой заработок', path: '/trainer/earnings', iconName: 'earnings', roles: ['TRAINER'], tabKey: 'trainerEarnings' },
  { label: 'Группы', path: '/groups', iconName: 'groups', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'groups', onboarding: 'groups-nav' },
  { label: 'Филиалы', path: '/branches', iconName: 'branches', roles: ['OWNER', 'ADMIN'], tabKey: 'branches', onboarding: 'branches-nav' },
  { label: 'Календарный план', path: '/schedule', iconName: 'schedule', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'schedule', onboarding: 'schedule-nav' },
  { label: 'Абонементы', path: '/memberships', iconName: 'tariffs', roles: ['OWNER', 'ADMIN'], tabKey: 'memberships', onboarding: 'memberships-nav' },
  { label: 'Финансы', path: '/finance', iconName: 'finance', roles: ['OWNER', 'ADMIN'], tabKey: 'finance', onboarding: 'payments-nav' },
  { label: 'Настройки', path: '/settings', iconName: 'settings', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'settings', onboarding: 'settings-nav' },
  { label: 'FAQ', path: '/faq', iconName: 'faq', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'faq', onboarding: 'faq-nav' },
  { label: 'База знаний', path: '/knowledge-base', iconName: 'knowledge-base', roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'knowledgeBase', onboarding: 'knowledge-base-nav' },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
};

/** Секции панели супер-админа (`/admin/dashboard?section=`). */
const SA_DASHBOARD_SECTIONS: Array<{
  section: string;
  label: string;
  iconName: NavIconName;
}> = [
  { section: 'overview', label: 'Общая статистика', iconName: 'dashboard' },
  { section: 'transactions', label: 'История транзакций', iconName: 'finance' },
  { section: 'accounts', label: 'Все аккаунты', iconName: 'staff' },
  { section: 'analytics', label: 'Аналитика', iconName: 'schedule' },
  { section: 'kpi', label: 'KPI метрики', iconName: 'standards' },
  { section: 'audit', label: 'Логи аудита', iconName: 'faq' },
  { section: 'tariffs', label: 'Управление тарифами', iconName: 'tariffs' },
  { section: 'marketers', label: 'Маркетологи', iconName: 'clients' },
  { section: 'server-load', label: 'Нагрузка сервера', iconName: 'settings' },
  { section: 'maintenance', label: 'Техобслуживание', iconName: 'faq' },
  { section: 'notifications', label: 'Уведомления', iconName: 'faq' },
  { section: 'planner', label: 'Планировщик', iconName: 'schedule' },
  { section: 'development', label: 'Разработка', iconName: 'knowledge-base' },
  { section: 'chats', label: 'Чаты', iconName: 'chats' },
  { section: 'changelog', label: 'Изменения', iconName: 'issued-tariffs' },
];

const SA_SECTION_TITLES: Record<string, string> = Object.fromEntries(
  SA_DASHBOARD_SECTIONS.map((item) => [item.section, item.label])
);

function resolveSaDashboardSection(search: string): string {
  const raw = new URLSearchParams(search).get('section') || 'overview';
  return SA_DASHBOARD_SECTIONS.some((item) => item.section === raw) ? raw : 'overview';
}

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

  const isPlatformShell = isSuperAdminRoute || isTesterRoute;

  const schoolToken = !isPlatformShell ? localStorage.getItem('token') : null;
  const chatUnread = useChatUnreadBadge({
    mode: 'staff',
    token: schoolToken,
    enabled: Boolean(schoolToken && user),
  });

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
      try {
        if (isSuperAdminRoute) {
          await apiService.listPlatformChangelog();
        } else {
          await apiService.listPlatformChangelog();
        }
      } catch {
        /* 401 interceptor сделает kick */
      }
    };
    const timer = window.setInterval(ping, 15000);
    const onFocus = () => {
      void ping();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [isSuperAdminRoute, isTesterRoute]);

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
    if (isSuperAdminRoute) {
      logoutSuperAdmin();
    } else if (isTesterRoute) {
      logoutTester();
    } else {
      logout();
    }
    prepareAddAccount();
    navigate('/auth', { replace: true });
  };

  const handleSearchResultClick = (item: GlobalSearchResultItem) => {
    setSearchValue('');
    setSearchResults(null);
    if (item.type === 'client') {
      navigate(`/clients?clientId=${encodeURIComponent(item.id)}`);
    } else if (item.type === 'trainer') {
      navigate(`/trainers?trainerId=${encodeURIComponent(item.id)}`);
    } else {
      navigate(`/groups?groupId=${encodeURIComponent(item.id)}`);
    }
  };

  const saSection = resolveSaDashboardSection(location.search);

  const navItems: ShellNavItem[] = isSuperAdminRoute
    ? [
        ...SA_DASHBOARD_SECTIONS.map((item) => ({
          key: `/admin/dashboard?section=${item.section}`,
          label: item.label,
          iconName: item.iconName,
          onClick: () => navigate(`/admin/dashboard?section=${item.section}`),
        })),
        {
          key: '/admin/support-hub',
          label: 'Support Hub',
          iconName: 'knowledge-base',
          onClick: () => navigate('/admin/support-hub'),
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
      : navigationItems
          .filter((item) => {
            const role = user?.role || '';
            const roleOk =
              item.roles.includes(role) ||
              (canAccessAdminNav(user) && item.roles.includes('ADMIN') && !item.roles.includes('TRAINER'));
            // «Мой заработок» остаётся и для старшего тренера
            if (item.path === '/trainer/earnings' && role === 'TRAINER') return visibleTabs[item.tabKey!] !== false;
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

  const userName = isSuperAdminRoute
    ? [superAdmin?.lastName, superAdmin?.firstName].filter(Boolean).join(' ') ||
      superAdmin?.email ||
      'Супер-админ'
    : isTesterRoute
      ? [tester?.lastName, tester?.firstName].filter(Boolean).join(' ') ||
        tester?.email ||
        'Тестировщик'
      : user
        ? [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ')
        : '';

  const userRole = isSuperAdminRoute
    ? 'Супер-админ'
    : isTesterRoute
      ? 'Тестировщик'
      : canAccessAdminNav(user) && user?.role === 'TRAINER'
        ? 'Старший тренер'
        : ROLE_LABELS[user?.role || ''] || tenant?.name || '';

  const activeKey = isSuperAdminRoute
    ? location.pathname.startsWith('/admin/support-hub')
      ? '/admin/support-hub'
      : `/admin/dashboard?section=${saSection}`
    : isTesterRoute
      ? '/tester/dashboard'
      : location.pathname.startsWith('/schedule')
        ? '/schedule'
        : location.pathname;

  const resolvedPageTitle = isSuperAdminRoute
    ? pageTitle ||
      (location.pathname.startsWith('/admin/support-hub')
        ? 'Support Hub'
        : SA_SECTION_TITLES[saSection] || 'Панель супер-админа')
    : pageTitle;

  return (
    <Box>
      {!isPlatformShell && <SalaryPayoutBanner />}
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
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onSearchResultClick={handleSearchResultClick}
        searchMaxWidth={{ sm: 560, md: 720 }}
      >
        {children}
      </DashboardShell>
    </Box>
  );
};

export default AppLayout;
