import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Fade,
} from '@mui/material';
import {
  Close,
  ArrowForward,
  ArrowBack,
  CheckCircle,
  TouchApp,
} from '@mui/icons-material';
import { apiService } from '../services/api';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content: string[];
  targetSelector: string; // CSS селектор элемента для подсветки
  action?: {
    type: 'click' | 'navigate' | 'wait';
    selector?: string; // Селектор для клика
    path?: string; // Путь для навигации
    waitTime?: number; // Время ожидания в мс
  };
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlight?: boolean; // Подсветить элемент
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Добро пожаловать!',
    description: 'Начнем интерактивное обучение',
    content: [
      'Добро пожаловать в CRM систему!',
      'Сейчас мы пройдем по основным разделам системы.',
      'Следуйте инструкциям и выполняйте действия.',
      'Вы можете пропустить обучение в любой момент.',
    ],
    targetSelector: 'body',
    position: 'center',
  },
  {
    id: 'dashboard',
    title: 'Панель управления',
    description: 'Главная страница с статистикой',
    content: [
      'Это панель управления - главная страница системы.',
      'Здесь отображается общая статистика вашей школы.',
      'Вы видите количество клиентов, тренеров, групп и филиалов.',
      'Также здесь отображается месячный доход и посещаемость.',
    ],
    targetSelector: '[data-onboarding="dashboard"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'dashboard-stats',
    title: 'Статистика',
    description: 'Ключевые метрики',
    content: [
      'Эти карточки показывают ключевые метрики вашей школы.',
      'Все данные обновляются в реальном времени.',
      'Кликните на любую карточку для просмотра деталей.',
    ],
    targetSelector: '[data-onboarding="dashboard-stats"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'clients-nav',
    title: 'Раздел "Клиенты"',
    description: 'Переход к управлению клиентами',
    content: [
      'В разделе "Клиенты" вы управляете всеми учениками.',
      'Давайте перейдем туда и посмотрим, как это работает.',
      'Кликните на этот пункт меню.',
    ],
    targetSelector: '[data-onboarding="clients-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="clients-nav"]',
    },
  },
  {
    id: 'clients-page',
    title: 'Управление клиентами',
    description: 'Работа с клиентами',
    content: [
      'Здесь вы видите список всех клиентов.',
      'Давайте создадим вашего первого клиента!',
      'Кликните на кнопку "Добавить клиента" справа вверху.',
      'Заполните форму и сохраните клиента.',
    ],
    targetSelector: '[data-onboarding="add-client-button"]',
    position: 'left',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="add-client-button"]',
    },
  },
  {
    id: 'clients-card',
    title: 'Карточка клиента',
    description: 'Информация о клиенте',
    content: [
      'После создания клиента вы увидите его в списке.',
      'В карточке клиента доступна вся информация: ФИО, контакты, баланс, статус.',
      '**Задолженность**: в списке клиентов отображается колонка с общей суммой задолженности и количеством просроченных платежей.',
      'Просроченные платежи - это платежи со статусом "ожидается", у которых истек срок оплаты.',
      'Кликните на иконку "Глаз" для просмотра статистики посещаемости.',
      'Кликните на иконку "Карандаш" для редактирования данных клиента.',
      'В карточке клиента можно управлять группами, платежами, достижениями и нормативами.',
    ],
    targetSelector: '[data-onboarding="clients-table"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'branches-nav',
    title: 'Раздел "Филиалы"',
    description: 'Переход к управлению филиалами',
    content: [
      'Филиалы помогают организовать работу нескольких отделений.',
      'Сначала нужно создать филиал, чтобы потом назначать к нему группы и тренеров.',
      'Давайте перейдем к филиалам.',
    ],
    targetSelector: '[data-onboarding="branches-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="branches-nav"]',
    },
  },
  {
    id: 'branches-page',
    title: 'Управление филиалами',
    description: 'Создание первого филиала',
    content: [
      'Филиалы помогают организовать работу нескольких отделений.',
      'Давайте создадим ваш первый филиал!',
      'Кликните на кнопку "Добавить филиал" справа вверху.',
      'Укажите название, адрес и контакты филиала.',
    ],
    targetSelector: '[data-onboarding="add-branch-button"]',
    position: 'left',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="add-branch-button"]',
    },
  },
  {
    id: 'branches-form',
    title: 'Форма создания филиала',
    description: 'Заполнение данных филиала',
    content: [
      'В форме создания филиала заполните следующие поля:',
      '• Название - обязательное поле, укажите название филиала',
      '• Адрес - адрес расположения филиала',
      '• Телефон - контактный телефон филиала',
      '• Email - электронная почта филиала (необязательно)',
      '• Описание - дополнительная информация о филиале (необязательно)',
      'После заполнения нажмите "Создать филиал" для сохранения.',
    ],
    targetSelector: '[data-onboarding="branch-form-dialog"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'groups-nav',
    title: 'Раздел "Группы"',
    description: 'Переход к управлению группами',
    content: [
      'Группы помогают организовать тренировки.',
      'Теперь, когда у вас есть филиал, можно создать группу.',
      'Кликните на "Группы" в меню.',
    ],
    targetSelector: '[data-onboarding="groups-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="groups-nav"]',
    },
  },
  {
    id: 'groups-page',
    title: 'Управление группами',
    description: 'Создание первой группы',
    content: [
      'Группы помогают организовать тренировки.',
      'Давайте создадим вашу первую группу!',
      'Кликните на кнопку "Добавить группу" справа вверху.',
      'Укажите название, возрастные ограничения, выберите тренера и филиал.',
    ],
    targetSelector: '[data-onboarding="add-group-button"]',
    position: 'left',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="add-group-button"]',
    },
  },
  {
    id: 'groups-form',
    title: 'Форма создания группы',
    description: 'Заполнение данных группы',
    content: [
      'В форме создания группы заполните следующие поля:',
      '• Название группы - обязательное поле',
      '• Описание - дополнительная информация о группе (необязательно)',
      '• Филиал - выберите филиал из списка (обязательно)',
      '• Тренер - выберите тренера для группы (необязательно)',
      '• Максимальное количество участников - лимит участников в группе',
      '• Возрастные ограничения - минимальный и максимальный возраст участников',
      '• Цвет группы - выберите цвет для визуального отличия',
      '• Цена тренировки - стоимость одной тренировки в группе',
      '**Ежемесячная оплата**: включите чекбокс для групп с ежемесячной оплатой',
      '**Сумма ежемесячного платежа**: укажите сумму, если включена ежемесячная оплата',
      '**День оплаты**: укажите день месяца (1-31), до которого должен быть оплачен платеж',
      '**Срок оплаты**: укажите количество дней для оплаты платежей',
      '**Настройка зарплаты тренера**: выберите тип (ежемесячный процент, процент за посещение, сумма за посещение)',
      '**Значение зарплаты**: укажите процент или сумму в зависимости от выбранного типа',
      'После заполнения нажмите "Создать группу" для сохранения.',
    ],
    targetSelector: '[data-onboarding="group-form-dialog"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'schedule-nav',
    title: 'Раздел "Расписание"',
    description: 'Переход к расписанию',
    content: [
      'Расписание - это календарь всех тренировок.',
      'Здесь вы создаете тренировки и отмечаете посещаемость.',
      'Давайте перейдем к расписанию.',
    ],
    targetSelector: '[data-onboarding="schedule-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="schedule-nav"]',
    },
  },
  {
    id: 'schedule-page',
    title: 'Расписание тренировок',
    description: 'Создание и управление тренировками',
    content: [
      'Это календарь тренировок.',
      'Вы можете создавать разовые или повторяющиеся тренировки.',
      '**Групповые тренировки**: выберите группу, тренера, филиал, дату и время.',
      '**Индивидуальные тренировки**: выберите тип "Индивидуальная", клиента, тренера, филиал.',
      'Для индивидуальных тренировок укажите цену и тип заработка тренера (процент или сумма).',
      'После проведения тренировки откройте её и отметьте посещаемость.',
      'Используйте чекбокс "Не списывать средства" для пропусков.',
    ],
    targetSelector: '[data-onboarding="schedule-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'standards-in-card',
    title: 'Нормативы в карточке спортсмена',
    description: 'Фиксация результатов ученика',
    content: [
      'Нормативы фиксируются прямо в карточке спортсмена (раздел «Клиенты»).',
      'Откройте карточку → «Добавить информацию» → Норматив или кнопку «Добавить» в блоке нормативов.',
      'Укажите название норматива, норму (цель), фактический результат и дату.',
    ],
    targetSelector: '[data-onboarding="clients-nav"]',
    position: 'right',
    highlight: true,
  },
  {
    id: 'trainers-nav',
    title: 'Раздел "Тренеры"',
    description: 'Переход к управлению тренерами',
    content: [
      'В разделе "Тренеры" вы управляете персоналом.',
      'Добавляйте тренеров, указывайте их квалификацию и опыт.',
      'Настраивайте систему оплаты для каждого тренера.',
      'Давайте перейдем к тренерам.',
    ],
    targetSelector: '[data-onboarding="trainers-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="trainers-nav"]',
    },
  },
  {
    id: 'trainers-page',
    title: 'Управление тренерами',
    description: 'Создание первого тренера',
    content: [
      'Тренеры - это ваш персонал, который проводит тренировки.',
      'Давайте создадим вашего первого тренера!',
      'Кликните на кнопку "Добавить тренера" справа вверху.',
      'Заполните ФИО, email, пароль, квалификацию и настройте систему оплаты.',
    ],
    targetSelector: '[data-onboarding="add-trainer-button"]',
    position: 'bottom',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="add-trainer-button"]',
    },
  },
  {
    id: 'trainer-salaries-nav',
    title: 'Раздел "Заработок тренеров"',
    description: 'Переход к заработку тренеров',
    content: [
      'Здесь вы отслеживаете заработок всех тренеров.',
      'Просматривайте статистику по каждому тренеру за выбранный период.',
      'Система автоматически рассчитывает зарплату на основе настроек.',
      'Давайте перейдем к заработку тренеров.',
    ],
    targetSelector: '[data-onboarding="trainer-salaries-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="trainer-salaries-nav"]',
    },
  },
  {
    id: 'trainer-salaries-page',
    title: 'Заработок тренеров',
    description: 'Просмотр и управление зарплатами',
    content: [
      'Здесь отображается заработок всех тренеров.',
      'Выберите период для просмотра статистики.',
      'Система показывает общий заработок, количество тренировок и учеников.',
      'Вы можете экспортировать данные в Excel для отчетности.',
    ],
    targetSelector: '[data-onboarding="trainer-salaries-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'branches-nav',
    title: 'Раздел "Филиалы"',
    description: 'Переход к управлению филиалами',
    content: [
      'Филиалы помогают организовать работу нескольких отделений.',
      'Создавайте филиалы и назначайте им тренеров и группы.',
      'Отслеживайте статистику по каждому филиалу отдельно.',
      'Давайте перейдем к филиалам.',
    ],
    targetSelector: '[data-onboarding="branches-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="branches-nav"]',
    },
  },
  {
    id: 'branches-page',
    title: 'Управление филиалами',
    description: 'Создание первого филиала',
    content: [
      'Филиалы помогают организовать работу нескольких отделений.',
      'Давайте создадим ваш первый филиал!',
      'Кликните на кнопку "Добавить филиал" справа вверху.',
      'Укажите название, адрес и контакты филиала.',
    ],
    targetSelector: '[data-onboarding="add-branch-button"]',
    position: 'bottom',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="add-branch-button"]',
    },
  },
  {
    id: 'memberships-nav',
    title: 'Раздел "Тарифы"',
    description: 'Переход к управлению тарифами',
    content: [
      'Тарифы - это типы абонементов для клиентов.',
      'Создавайте тарифы с разной стоимостью и сроком действия.',
      'Настраивайте количество занятий и условия использования.',
      'Давайте перейдем к тарифам.',
    ],
    targetSelector: '[data-onboarding="memberships-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="memberships-nav"]',
    },
  },
  {
    id: 'memberships-page',
    title: 'Управление тарифами',
    description: 'Создание первого тарифа',
    content: [
      'Тарифы - это типы абонементов для клиентов.',
      'Давайте создадим ваш первый тариф!',
      'Кликните на кнопку "Создать тариф" справа вверху.',
      'Укажите название, стоимость, срок действия и количество занятий.',
    ],
    targetSelector: '[data-onboarding="add-membership-button"]',
    position: 'bottom',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="add-membership-button"]',
    },
  },
  {
    id: 'client-memberships-nav',
    title: 'Раздел "Выданные тарифы"',
    description: 'Переход к выданным тарифам',
    content: [
      'Здесь вы видите все выданные клиентам тарифы.',
      'Отслеживайте срок действия и остаток занятий.',
      'Продлевайте тарифы и управляйте их статусом.',
      'Давайте перейдем к выданным тарифам.',
    ],
    targetSelector: '[data-onboarding="client-memberships-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="client-memberships-nav"]',
    },
  },
  {
    id: 'client-memberships-page',
    title: 'Выданные тарифы',
    description: 'Управление выданными тарифами',
    content: [
      'Здесь отображаются все тарифы, выданные клиентам.',
      'Вы можете видеть срок действия, остаток занятий, статус тарифа.',
      'Продлевайте тарифы, изменяйте их статус.',
      'Фильтруйте тарифы по клиенту, филиалу или статусу.',
    ],
    targetSelector: '[data-onboarding="client-memberships-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'payments-nav',
    title: 'Раздел "Платежи"',
    description: 'Переход к управлению платежами',
    content: [
      'В разделе "Платежи" вы управляете всеми платежами клиентов.',
      'Здесь можно создавать платежи, отслеживать ежемесячные платежи, выполнять перерасчет.',
      'Система автоматически создает ежемесячные платежи для групп с ежемесячной оплатой.',
      'Давайте перейдем к платежам.',
    ],
    targetSelector: '[data-onboarding="payments-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="payments-nav"]',
    },
  },
  {
    id: 'payments-page',
    title: 'Управление платежами',
    description: 'Работа с платежами',
    content: [
      'Здесь отображаются все платежи клиентов.',
      'Ежемесячные платежи: для групп с ежемесячной оплатой система автоматически создает платежи раз в месяц.',
      'Создание ежемесячных платежей: нажмите кнопку "Создать ежемесячные платежи" (доступно для OWNER и ADMIN).',
      'Перерасчет платежа: для ежемесячных платежей доступна кнопка "Перерасчет" (только для OWNER и ADMIN).',
      'Перерасчет позволяет изменить сумму платежа для конкретного клиента, сохраняя оригинальную сумму в истории.',
      'Фильтруйте платежи по филиалу, используйте поиск для быстрого нахождения.',
    ],
    targetSelector: '[data-onboarding="payments-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'settings-nav',
    title: 'Раздел "Настройки"',
    description: 'Переход к настройкам',
    content: [
      'В настройках вы управляете параметрами системы.',
      'Меняйте email и пароль.',
      'Настраивайте отображаемые вкладки в меню.',
      'Включайте или отключайте темную тему.',
      'Давайте перейдем к настройкам.',
    ],
    targetSelector: '[data-onboarding="settings-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="settings-nav"]',
    },
  },
  {
    id: 'settings-page',
    title: 'Настройки системы',
    description: 'Управление параметрами',
    content: [
      'Здесь вы настраиваете параметры вашего аккаунта.',
      'Смена почты: обновите email адрес для входа в систему.',
      'Смена пароля: установите новый пароль для безопасности.',
      'Настройка вкладок: выберите, какие разделы отображать в меню.',
      'Темная тема: переключайте между светлой и темной темой интерфейса.',
    ],
    targetSelector: '[data-onboarding="settings-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'faq-nav',
    title: 'Раздел "FAQ"',
    description: 'Переход к часто задаваемым вопросам',
    content: [
      'FAQ содержит ответы на часто задаваемые вопросы.',
      'Здесь вы найдете инструкции по использованию системы.',
      'Вопросы разделены по категориям для удобства поиска.',
      'Давайте перейдем к FAQ.',
    ],
    targetSelector: '[data-onboarding="faq-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="faq-nav"]',
    },
  },
  {
    id: 'faq-page',
    title: 'Часто задаваемые вопросы',
    description: 'Справочная информация',
    content: [
      'Здесь собраны ответы на часто задаваемые вопросы.',
      'Вопросы разделены по категориям: Инструкция, Функционал, Тарифы, Поддержка.',
      'Используйте поиск для быстрого нахождения нужной информации.',
      'Если не нашли ответ, обратитесь в поддержку.',
    ],
    targetSelector: '[data-onboarding="faq-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'knowledge-base-nav',
    title: 'Раздел "База знаний"',
    description: 'Переход к базе знаний',
    content: [
      'База знаний содержит подробную документацию по системе.',
      'Здесь вы найдете детальные инструкции по всем функциям.',
      'Используйте поиск и фильтры для нахождения нужной информации.',
      'Давайте перейдем к базе знаний.',
    ],
    targetSelector: '[data-onboarding="knowledge-base-nav"]',
    position: 'right',
    highlight: true,
    action: {
      type: 'click',
      selector: '[data-onboarding="knowledge-base-nav"]',
    },
  },
  {
    id: 'knowledge-base-page',
    title: 'База знаний',
    description: 'Подробная документация',
    content: [
      'Здесь собрана подробная документация по всем функциям системы.',
      'Используйте поиск для быстрого нахождения нужной информации.',
      'Фильтруйте статьи по категориям.',
      'База знаний регулярно обновляется с новыми функциями.',
    ],
    targetSelector: '[data-onboarding="knowledge-base-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'complete',
    title: 'Обучение завершено!',
    description: 'Готовы начать работу',
    content: [
      'Поздравляем! Вы завершили интерактивное обучение.',
      'Теперь вы знаете все основные функции системы.',
      'Если возникнут вопросы, обратитесь к разделам "FAQ" или "База знаний".',
      'Успешной работы!',
    ],
    targetSelector: 'body',
    position: 'center',
  },
];

interface InteractiveOnboardingProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onDecline: () => void;
}

const InteractiveOnboarding: React.FC<InteractiveOnboardingProps> = ({
  open,
  onClose,
  onComplete,
  onDecline,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const navigate = useNavigate();
  const location = useLocation();
  const stepRef = useRef<HTMLDivElement>(null);

  const currentStep = onboardingSteps[activeStep];
  const isLastStep = activeStep === onboardingSteps.length - 1;
  const isFirstStep = activeStep === 0;

  // Подсветка элемента
  useEffect(() => {
    if (!open || !currentStep) return;

    // Сбрасываем позицию при смене шага
    setTooltipPosition({});

    const highlightElement = () => {
      try {
        const element = document.querySelector(currentStep.targetSelector) as HTMLElement;
        
        if (element && currentStep.highlight) {
          setHighlightedElement(element);
          setOverlayVisible(true);
          
          // Прокрутка к элементу
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Добавляем класс для подсветки
          element.style.transition = 'all 0.3s ease';
          element.style.boxShadow = '0 0 0 4px rgba(25, 118, 210, 0.5), 0 0 20px rgba(25, 118, 210, 0.3)';
          // Не устанавливаем z-index на подсвеченный элемент, чтобы не создавать новый stacking context
          // Виджет обучения с z-index 99999 будет поверх всех элементов
        } else {
          setHighlightedElement(null);
          setOverlayVisible(currentStep.position === 'center');
        }
      } catch (error) {
        console.error('Error highlighting element:', error);
        setOverlayVisible(true);
      }
    };

    // Небольшая задержка для рендеринга
    const timer = setTimeout(highlightElement, 300);
    return () => {
      clearTimeout(timer);
      // Убираем подсветку
      const prevElement = document.querySelector(currentStep.targetSelector) as HTMLElement;
      if (prevElement) {
        prevElement.style.boxShadow = '';
        prevElement.style.zIndex = '';
        prevElement.style.position = '';
      }
    };
  }, [open, activeStep, currentStep]);

  // Пересчет позиции после рендеринга виджета с учетом его реальных размеров
  useEffect(() => {
    if (!open || !currentStep || !highlightedElement || !stepRef.current) {
      setTooltipPosition({});
      return;
    }

    const recalculatePosition = () => {
      const element = highlightedElement;
      const tooltip = stepRef.current;
      if (!element || !tooltip) {
        setTooltipPosition({});
        return;
      }

      // Получаем актуальные размеры после рендеринга
      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 20;
      // Для маленьких экранов используем более консервативный padding
      const adaptivePadding = viewportHeight < 900 ? 10 : padding;
      const tooltipHeight = tooltipRect.height || 400;
      const tooltipWidth = tooltipRect.width || 400;
      
      // Для маленьких экранов ограничиваем максимальную высоту виджета
      const maxTooltipHeight = Math.min(tooltipHeight, viewportHeight * 0.7); // Максимум 70% высоты экрана
      
      let position: { top?: number; bottom?: number; left?: number; right?: number } = {};

      if (currentStep.position === 'bottom') {
        const bottomPos = viewportHeight - rect.top + adaptivePadding;
        const leftPos = rect.left + rect.width / 2 - tooltipWidth / 2;
        position = {
          bottom: Math.min(bottomPos, viewportHeight - adaptivePadding),
          left: Math.max(adaptivePadding, Math.min(leftPos, viewportWidth - tooltipWidth - adaptivePadding)),
        };
      } else if (currentStep.position === 'right') {
        const rightPos = rect.right + adaptivePadding;
        const topPos = rect.top;
        // Убеждаемся, что виджет не выходит за нижнюю границу
        const maxTop = Math.max(adaptivePadding, viewportHeight - maxTooltipHeight - adaptivePadding);
        // Убеждаемся, что виджет не выходит за верхнюю границу
        const minTop = adaptivePadding;
        position = {
          top: Math.max(minTop, Math.min(topPos, maxTop)),
          left: Math.min(rightPos, viewportWidth - tooltipWidth - adaptivePadding),
        };
      } else if (currentStep.position === 'top') {
        // Для позиции top используем bottom, чтобы виджет был над элементом
        const spaceAbove = rect.top - adaptivePadding;
        const spaceBelow = viewportHeight - rect.bottom;
        const leftPos = rect.left + rect.width / 2 - tooltipWidth / 2;
        
        // Используем реальную высоту виджета для расчета
        const actualTooltipHeight = tooltipRect.height;
        
        // Если места сверху недостаточно, размещаем снизу
        if (spaceAbove < actualTooltipHeight && spaceBelow > spaceAbove) {
          // Размещаем снизу
          const topPos = rect.bottom + adaptivePadding;
          // Убеждаемся, что виджет не выходит за нижнюю границу
          const maxTop = viewportHeight - actualTooltipHeight - adaptivePadding;
          position = {
            top: Math.min(topPos, maxTop),
            left: Math.max(adaptivePadding, Math.min(leftPos, viewportWidth - tooltipWidth - adaptivePadding)),
          };
        } else {
          // Размещаем сверху, используя top вместо bottom для более точного контроля
          // Желаемая позиция: виджет должен быть над элементом
          const desiredTop = rect.top - actualTooltipHeight - adaptivePadding;
          
          // Убеждаемся, что виджет не выходит за верхнюю границу
          const minTop = adaptivePadding;
          const finalTop = Math.max(minTop, desiredTop);
          
          // Проверяем, что виджет полностью помещается в viewport
          if (finalTop + actualTooltipHeight > viewportHeight - adaptivePadding) {
            // Если не помещается, размещаем снизу элемента
            const topPos = rect.bottom + adaptivePadding;
            const maxTop = viewportHeight - actualTooltipHeight - adaptivePadding;
            position = {
              top: Math.min(topPos, maxTop),
              left: Math.max(adaptivePadding, Math.min(leftPos, viewportWidth - tooltipWidth - adaptivePadding)),
            };
          } else {
            position = {
              top: finalTop,
              left: Math.max(adaptivePadding, Math.min(leftPos, viewportWidth - tooltipWidth - adaptivePadding)),
            };
          }
        }
      } else if (currentStep.position === 'left') {
        const leftPos = rect.left - tooltipWidth - adaptivePadding;
        const topPos = rect.top;
        const maxTop = Math.max(adaptivePadding, viewportHeight - maxTooltipHeight - adaptivePadding);
        const minTop = adaptivePadding;
        
        // Если есть место слева, размещаем слева
        if (leftPos >= adaptivePadding) {
          position = {
            top: Math.max(minTop, Math.min(topPos, maxTop)),
            right: viewportWidth - rect.left + adaptivePadding,
          };
        } else {
          // Если места слева нет, размещаем справа
          position = {
            top: Math.max(minTop, Math.min(topPos, maxTop)),
            left: Math.min(rect.right + adaptivePadding, viewportWidth - tooltipWidth - adaptivePadding),
          };
        }
      }

      // Финальная проверка: убеждаемся, что виджет не выходит за границы
      if (position.top !== undefined) {
        const finalTop = Math.max(adaptivePadding, Math.min(position.top, viewportHeight - tooltipRect.height - adaptivePadding));
        position.top = finalTop;
      }
      if (position.bottom !== undefined) {
        const finalBottom = Math.max(adaptivePadding, Math.min(position.bottom, viewportHeight - tooltipRect.height - adaptivePadding));
        position.bottom = finalBottom;
      }
      
      setTooltipPosition(position);
    };

    // Увеличиваем задержку для получения реальных размеров виджета после рендеринга
    // Используем несколько попыток для надежности
    let attemptCount = 0;
    const maxAttempts = 5;
    
    const tryRecalculate = () => {
      attemptCount++;
      const tooltip = stepRef.current;
      if (tooltip && tooltip.offsetHeight > 0 && tooltip.offsetWidth > 0) {
        recalculatePosition();
        // Дополнительная проверка после небольшой задержки
        setTimeout(() => {
          recalculatePosition();
        }, 50);
      } else if (attemptCount < maxAttempts) {
        setTimeout(tryRecalculate, 100);
      } else {
        // Если не удалось получить размеры, используем расчет с примерными значениями
        recalculatePosition();
      }
    };
    
    const timer = setTimeout(tryRecalculate, 100);
    
    // Также пересчитываем при изменении размера окна
    const resizeHandler = () => {
      recalculatePosition();
    };
    window.addEventListener('resize', resizeHandler);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resizeHandler);
    };
  }, [open, activeStep, currentStep, highlightedElement]);

  // Обработка навигации и автоматических действий при переходе между шагами
  useEffect(() => {
    if (!open || !currentStep) return;

    // Автоматическая навигация для шагов, которые требуют перехода на другую страницу
    const expectedPath = currentStep.targetSelector.includes('clients') ? '/clients' :
                        currentStep.targetSelector.includes('groups') ? '/groups' :
                        currentStep.targetSelector.includes('schedule') ? '/schedule' :
                        currentStep.targetSelector.includes('dashboard') ? '/dashboard' :
                        currentStep.targetSelector.includes('trainers') ? '/trainers' :
                        currentStep.targetSelector.includes('branches') ? '/branches' :
                        currentStep.targetSelector.includes('memberships') ? '/memberships' :
                        currentStep.targetSelector.includes('client-memberships') ? '/client-memberships' :
                        currentStep.targetSelector.includes('payments') || currentStep.targetSelector.includes('finance') ? '/finance' :
                        currentStep.targetSelector.includes('settings') ? '/settings' :
                        currentStep.targetSelector.includes('faq') ? '/faq' :
                        currentStep.targetSelector.includes('knowledge-base') ? '/knowledge-base' : null;

    if (expectedPath && location.pathname !== expectedPath) {
      // Небольшая задержка перед навигацией
      const timer = setTimeout(() => {
        navigate(expectedPath);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Автоматический клик НЕ выполняется автоматически - пользователь должен нажать "Далее"
    // Клик будет выполнен в handleNext при необходимости
  }, [open, activeStep, currentStep, navigate, location.pathname]);

  const handleNext = async () => {
    // Если текущий шаг требует клика, выполняем его перед переходом к следующему
    if (currentStep.action && currentStep.action.type === 'click' && currentStep.action.selector) {
      const element = document.querySelector(currentStep.action.selector) as HTMLElement;
      if (element) {
        // Прокручиваем к элементу
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Небольшая задержка перед кликом, чтобы элемент был виден
        setTimeout(() => {
          element.click();
        }, 300);
        // Дополнительная задержка перед переходом к следующему шагу
        setTimeout(() => {
          if (isLastStep) {
            handleComplete();
          } else {
            setActiveStep(activeStep + 1);
          }
        }, 500);
        return;
      }
    }

    // Обычный переход к следующему шагу
    if (isLastStep) {
      await handleComplete();
    } else {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await apiService.updateOnboardingStatus({ hasCompletedOnboarding: true });
      onComplete();
    } catch (error) {
      console.error('Error updating onboarding status:', error);
      onComplete();
    }
  };

  const handleDecline = async () => {
    try {
      await apiService.updateOnboardingStatus({ onboardingDeclined: true });
      onDecline();
    } catch (error) {
      console.error('Error updating onboarding status:', error);
      onDecline();
    }
  };

  if (!open) return null;

  // Рендерим виджет обучения через React Portal, чтобы он был на верхнем уровне DOM
  const portalContent = (
    <>
      {/* Overlay */}
      {overlayVisible && (
          <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 99998, // Максимально высокий z-index для overlay
            transition: 'opacity 0.3s ease',
          }}
          onClick={currentStep.position === 'center' ? undefined : handleNext}
        />
      )}

      {/* Tooltip */}
      <Fade in={open} timeout={300}>
        <Paper
          ref={stepRef}
          elevation={24}
          sx={{
            position: 'fixed',
            zIndex: 99999, // Максимально высокий z-index, чтобы быть поверх всех элементов
            isolation: 'isolate', // Создаем новый stacking context
            maxWidth: { xs: '90vw', sm: 400 },
            width: { xs: '90vw', sm: 400 },
            maxHeight: { xs: '70vh', sm: '80vh' }, // Уменьшено для маленьких экранов (1280x800)
            overflowY: 'auto',
            overflowX: 'hidden',
            p: 3,
            borderRadius: 3,
            backgroundColor: 'background.paper',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            ...(currentStep.position === 'center' && {
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: { xs: '95vw', sm: 500 },
              width: { xs: '95vw', sm: 500 },
            }),
            ...(currentStep.position === 'bottom' && {
              ...(tooltipPosition.bottom !== undefined && { bottom: `${tooltipPosition.bottom}px` }),
              ...(tooltipPosition.left !== undefined && { left: `${tooltipPosition.left}px` }),
              ...(tooltipPosition.right !== undefined && { right: `${tooltipPosition.right}px` }),
              ...(!highlightedElement && {
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
              }),
            }),
            ...(currentStep.position === 'right' && {
              ...(tooltipPosition.top !== undefined && { top: `${tooltipPosition.top}px` }),
              ...(tooltipPosition.left !== undefined && { left: `${tooltipPosition.left}px` }),
              ...(tooltipPosition.right !== undefined && { right: `${tooltipPosition.right}px` }),
              ...(!highlightedElement && {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }),
            }),
            ...(currentStep.position === 'top' && {
              ...(tooltipPosition.top !== undefined && { top: `${tooltipPosition.top}px` }),
              ...(tooltipPosition.bottom !== undefined && { bottom: `${tooltipPosition.bottom}px` }),
              ...(tooltipPosition.left !== undefined && { left: `${tooltipPosition.left}px` }),
              ...(!highlightedElement && {
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
              }),
            }),
            ...(currentStep.position === 'left' && {
              ...(tooltipPosition.top !== undefined && { top: `${tooltipPosition.top}px` }),
              ...(tooltipPosition.right !== undefined && { right: `${tooltipPosition.right}px` }),
              ...(!highlightedElement && {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }),
            }),
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                {currentStep.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {currentStep.description}
              </Typography>
              <Chip
                label={`Шаг ${activeStep + 1} из ${onboardingSteps.length}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
            <IconButton size="small" onClick={handleDecline}>
              <Close />
            </IconButton>
          </Box>

          <Box sx={{ mb: 3, minHeight: 80 }}>
            {currentStep.content.map((item, index) => (
              <Typography
                key={index}
                variant="body2"
                sx={{
                  mb: 1,
                  lineHeight: 1.6,
                  '&:last-child': { mb: 0 },
                }}
              >
                • {item}
              </Typography>
            ))}
          </Box>

          {currentStep.action && currentStep.action.type === 'click' && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2,
                p: 1.5,
                backgroundColor: 'primary.light',
                borderRadius: 1,
                color: 'white',
              }}
            >
              <TouchApp />
              <Typography variant="body2" fontWeight="medium">
                Кликните на подсвеченный элемент
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button onClick={handleDecline} color="inherit" size="small">
              Пропустить
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {!isFirstStep && (
                <Button
                  onClick={handleBack}
                  startIcon={<ArrowBack />}
                  variant="outlined"
                  size="small"
                >
                  Назад
                </Button>
              )}
              <Button
                onClick={handleNext}
                variant="contained"
                endIcon={isLastStep ? <CheckCircle /> : <ArrowForward />}
                size="small"
              >
                {isLastStep ? 'Завершить' : 'Далее'}
              </Button>
            </Box>
          </Box>

          {/* Stepper */}
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {onboardingSteps.map((step, index) => (
                <Step key={step.id}>
                  <StepLabel />
                </Step>
              ))}
            </Stepper>
          </Box>
        </Paper>
      </Fade>
    </>
  );

  // Используем Portal для рендеринга на верхнем уровне DOM
  return createPortal(portalContent, document.body);
};

export default InteractiveOnboarding;

