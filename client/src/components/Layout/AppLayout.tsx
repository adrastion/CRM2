import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import DashboardShell, {
  ShellNavItem,
  GlobalSearchResults,
  GlobalSearchResultItem,
} from '../dashboard/DashboardShell';
import TelegramBanner from '../TelegramBanner';
import SalaryPayoutBanner from '../SalaryPayoutBanner';
import { clearAllAuthStorage } from '../../utils/authSession';
import { NavIconName } from '../../assets/icons/registry';
import { apiService } from '../../services/api';

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

/**
 * Оболочка защищённых страниц: тот же каркас, что и в макете панели управления
 * (шапка с поиском и профилем, боковое меню с ролевой фильтрацией, футер).
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children, pageTitle }) => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [visibleTabs, setVisibleTabs] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem('visibleTabs');
    return saved ? JSON.parse(saved) : {};
  });

  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: CustomEvent) => setVisibleTabs(event.detail.visibleTabs);
    window.addEventListener('tabsVisibilityChange', handler as EventListener);
    return () => window.removeEventListener('tabsVisibilityChange', handler as EventListener);
  }, []);

  useEffect(() => {
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
  }, [searchValue]);

  const handleLogout = () => {
    logout();
    clearAllAuthStorage();
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

  const navItems: ShellNavItem[] = navigationItems
    .filter((item) => {
      if (!item.roles.includes(user?.role || '')) return false;
      if (item.tabKey && visibleTabs[item.tabKey] === false) return false;
      return true;
    })
    .map((item) => ({
      key: item.path,
      label: item.label,
      iconName: item.iconName,
      dataOnboarding: item.onboarding,
      onClick: () => navigate(item.path),
    }));

  const userName = user
    ? [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ')
    : '';

  const activeKey = location.pathname.startsWith('/schedule')
    ? '/schedule'
    : location.pathname;

  return (
    <Box>
      <TelegramBanner />
      <SalaryPayoutBanner />
      <DashboardShell
        pageTitle={pageTitle}
        navItems={navItems}
        activeKey={activeKey}
        userName={userName || tenant?.name || 'Профиль'}
        userRole={ROLE_LABELS[user?.role || ''] || tenant?.name || ''}
        onLogout={handleLogout}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onSearchResultClick={handleSearchResultClick}
      >
        {children}
      </DashboardShell>
    </Box>
  );
};

export default AppLayout;
