import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import {
  DashboardOutlined,
  PeopleAltOutlined,
  AssignmentOutlined,
  BadgeOutlined,
  GroupsOutlined,
  BusinessOutlined,
  CalendarMonthOutlined,
  EmojiEventsOutlined,
  PaymentsOutlined,
  LocalOfferOutlined,
  SettingsOutlined,
  HelpOutline,
  MenuBookOutlined,
  AttachMoneyOutlined,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import DashboardShell, { ShellNavItem } from '../dashboard/DashboardShell';
import TelegramBanner from '../TelegramBanner';
import { clearAllAuthStorage } from '../../utils/authSession';

interface AppLayoutProps {
  children: React.ReactNode;
  /** Заголовок страницы. Если не передан, страница рисует заголовок сама. */
  pageTitle?: string;
}

/** Пункты меню панели управления школы (по макету) с ролевыми ограничениями. */
const navigationItems: Array<{
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  /** Ключ для настройки видимости вкладок в Settings. */
  tabKey?: string;
  /** Атрибут для интерактивного обучения (InteractiveOnboarding). */
  onboarding?: string;
}> = [
  { label: 'Панель управления', path: '/dashboard', icon: <DashboardOutlined />, roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'dashboard', onboarding: 'dashboard' },
  { label: 'Клиенты', path: '/clients', icon: <PeopleAltOutlined />, roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'clients', onboarding: 'clients-nav' },
  { label: 'Нормативы', path: '/standards', icon: <AssignmentOutlined />, roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'standards', onboarding: 'standards-nav' },
  { label: 'Сотрудники', path: '/trainers', icon: <BadgeOutlined />, roles: ['OWNER', 'ADMIN'], tabKey: 'trainers', onboarding: 'trainers-nav' },
  { label: 'Мой заработок', path: '/trainer/earnings', icon: <AttachMoneyOutlined />, roles: ['TRAINER'], tabKey: 'trainerEarnings' },
  { label: 'Заработок тренеров', path: '/trainers/earnings', icon: <AttachMoneyOutlined />, roles: ['OWNER', 'ADMIN'], tabKey: 'allTrainersEarnings', onboarding: 'trainer-salaries-nav' },
  { label: 'Группы', path: '/groups', icon: <GroupsOutlined />, roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'groups', onboarding: 'groups-nav' },
  { label: 'Филиалы', path: '/branches', icon: <BusinessOutlined />, roles: ['OWNER', 'ADMIN'], tabKey: 'branches', onboarding: 'branches-nav' },
  { label: 'Календарный план', path: '/schedule', icon: <CalendarMonthOutlined />, roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'schedule', onboarding: 'schedule-nav' },
  { label: 'Соревнования', path: '/competitions', icon: <EmojiEventsOutlined />, roles: ['OWNER', 'ADMIN', 'TRAINER'] },
  { label: 'Платежи', path: '/payments', icon: <PaymentsOutlined />, roles: ['OWNER', 'ADMIN'], tabKey: 'payments', onboarding: 'payments-nav' },
  { label: 'Тарифы', path: '/memberships', icon: <LocalOfferOutlined />, roles: ['OWNER', 'ADMIN'], tabKey: 'memberships', onboarding: 'memberships-nav' },
  { label: 'Выданные тарифы', path: '/client-memberships', icon: <LocalOfferOutlined />, roles: ['OWNER', 'ADMIN'], tabKey: 'clientMemberships', onboarding: 'client-memberships-nav' },
  { label: 'Настройки', path: '/settings', icon: <SettingsOutlined />, roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'settings', onboarding: 'settings-nav' },
  { label: 'FAQ', path: '/faq', icon: <HelpOutline />, roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'faq', onboarding: 'faq-nav' },
  { label: 'База знаний', path: '/knowledge-base', icon: <MenuBookOutlined />, roles: ['OWNER', 'ADMIN', 'TRAINER'], tabKey: 'knowledgeBase', onboarding: 'knowledge-base-nav' },
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

  useEffect(() => {
    const handler = (event: CustomEvent) => setVisibleTabs(event.detail.visibleTabs);
    window.addEventListener('tabsVisibilityChange', handler as EventListener);
    return () => window.removeEventListener('tabsVisibilityChange', handler as EventListener);
  }, []);

  const handleLogout = () => {
    logout();
    clearAllAuthStorage();
    navigate('/auth', { replace: true });
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
      icon: item.icon,
      dataOnboarding: item.onboarding,
      onClick: () => navigate(item.path),
    }));

  const userName = user
    ? [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ')
    : '';

  return (
    <Box>
      <TelegramBanner />
      <DashboardShell
        pageTitle={pageTitle}
        navItems={navItems}
        activeKey={location.pathname}
        userName={userName || tenant?.name || 'Профиль'}
        userRole={ROLE_LABELS[user?.role || ''] || tenant?.name || ''}
        onLogout={handleLogout}
      >
        {children}
      </DashboardShell>
    </Box>
  );
};

export default AppLayout;
