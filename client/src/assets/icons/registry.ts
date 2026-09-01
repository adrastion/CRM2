/** Навигационные иконки бокового меню (серые, ~34px). */
import dashboard from './nav/dashboard.svg';
import clients from './nav/clients.svg';
import standards from './nav/standards.svg';
import staff from './nav/staff.svg';
import groups from './nav/groups.svg';
import branches from './nav/branches.svg';
import schedule from './nav/schedule.svg';
import competitions from './nav/competitions.svg';
import finance from './nav/finance.svg';
import tariffs from './nav/tariffs.svg';
import issuedTariffs from './nav/issued-tariffs.svg';
import faq from './nav/faq.svg';
import knowledgeBase from './nav/knowledge-base.svg';
import settings from './nav/settings.svg';

/** KPI и быстрые действия (синий фон, ~81×88). */
import totalClients from './metrics/total-clients.svg';
import activeClients from './metrics/active-clients.svg';
import trainersMetric from './nav/trainers.svg';
import groupsMetric from './metrics/groups-dashboard.svg';
import branchesMetric from './metrics/branches-dashboard.svg';
import monthlyRevenue from './metrics/monthly-revenue.svg';
import attendance from './metrics/attendance.svg';
import myTrainings from './metrics/my-trainings.svg';
import balance from './metrics/balance.svg';
import addClient from './metrics/add-client.svg';
import scheduleTraining from './metrics/schedule-training.svg';
import recordPayment from './metrics/record-payment.svg';
import standardsAction from './nav/standards.svg';

/** UI-элементы (поиск, сортировка). */
import search from './ui/search.svg';
import sort from './ui/sort.svg';
import phone from './ui/phone.svg';
import email from './ui/email.svg';

export type NavIconName =
  | 'dashboard'
  | 'clients'
  | 'standards'
  | 'staff'
  | 'groups'
  | 'branches'
  | 'schedule'
  | 'competitions'
  | 'finance'
  | 'tariffs'
  | 'issued-tariffs'
  | 'settings'
  | 'faq'
  | 'knowledge-base'
  | 'earnings';

export type MetricIconName =
  | 'total-clients'
  | 'active-clients'
  | 'trainers'
  | 'groups'
  | 'branches'
  | 'monthly-revenue'
  | 'attendance'
  | 'my-trainings'
  | 'balance'
  | 'add-client'
  | 'schedule-training'
  | 'record-payment'
  | 'standards';

export type UiIconName = 'search' | 'sort' | 'phone' | 'email';

export const navIcons: Record<NavIconName, string> = {
  dashboard,
  clients,
  standards,
  staff,
  groups,
  branches,
  schedule,
  competitions,
  finance,
  tariffs,
  'issued-tariffs': issuedTariffs,
  settings,
  faq,
  'knowledge-base': knowledgeBase,
  earnings: finance,
};

export const metricIcons: Record<MetricIconName, string> = {
  'total-clients': totalClients,
  'active-clients': activeClients,
  trainers: trainersMetric,
  groups: groupsMetric,
  branches: branchesMetric,
  'monthly-revenue': monthlyRevenue,
  attendance,
  'my-trainings': myTrainings,
  balance,
  'add-client': addClient,
  'schedule-training': scheduleTraining,
  'record-payment': recordPayment,
  standards: standardsAction,
};

export const uiIcons: Record<UiIconName, string> = {
  search,
  sort,
  phone,
  email,
};
