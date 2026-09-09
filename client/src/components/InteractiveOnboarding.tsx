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
      'Добро пожаловать в ПРОФСПОРТСРМ!',
      'Пройдём по основным разделам школьного кабинета.',
      'Следуйте подсказкам — в любой момент обучение можно пропустить.',
      'Повторить тур позже можно в Настройках (только владелец).',
    ],
    targetSelector: 'body',
    position: 'center',
  },
  {
    id: 'dashboard',
    title: 'Панель управления',
    description: 'Главная страница с статистикой',
    content: [
      'Это панель управления — главная страница системы.',
      'Здесь сводка по школе: клиенты, сотрудники, группы, филиалы.',
      'Также видны доход и посещаемость за период.',
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
      'Карточки показывают ключевые метрики школы.',
      'Данные обновляются по мере работы в системе.',
      'Нажмите на карточку, чтобы открыть подробности.',
    ],
    targetSelector: '[data-onboarding="dashboard-stats"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'branches-nav',
    title: 'Раздел «Филиалы»',
    description: 'Переход к филиалам',
    content: [
      'Сначала создайте филиал — к нему привязываются группы и залы.',
      'Нажмите «Филиалы» в меню.',
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
    description: 'Создание филиала',
    content: [
      'Добавьте первый филиал: название, адрес и контакты.',
      'Нажмите «Добавить филиал».',
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
    title: 'Форма филиала',
    description: 'Заполнение данных',
    content: [
      'Заполните название (обязательно), адрес, телефон, email и описание.',
      'Сохраните филиал — после этого можно создавать группы.',
    ],
    targetSelector: '[data-onboarding="branch-form-dialog"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'groups-nav',
    title: 'Раздел «Группы»',
    description: 'Переход к группам',
    content: [
      'Группы организуют тренировки и оплату.',
      'Нажмите «Группы» в меню.',
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
    description: 'Создание группы',
    content: [
      'Создайте группу: филиал, тренер, лимиты и цвет.',
      'Нажмите «Добавить группу».',
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
    title: 'Форма группы и оплата',
    description: 'Ежемесячная оплата',
    content: [
      'Укажите название, филиал, тренера и цену тренировки при необходимости.',
      'Для групп с ежемесячной оплатой включите чекбокс, задайте сумму и день оплаты.',
      'Счёт создаётся за месяц первого занятия (не за месяц набора группы).',
      'Пока есть незакрытый ежемесячный счёт по группе — второй не создаётся.',
      'Настройте схему зарплаты тренера по группе и сохраните.',
    ],
    targetSelector: '[data-onboarding="group-form-dialog"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'trainers-nav',
    title: 'Раздел «Сотрудники»',
    description: 'Переход к сотрудникам',
    content: [
      'Здесь управляют тренерами и администраторами школы.',
      'Нажмите «Сотрудники» в меню.',
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
    title: 'Сотрудники',
    description: 'Добавление персонала',
    content: [
      'Владелец может создать администратора или тренера.',
      'Администратор создаёт только тренеров.',
      'У тренера настраиваются квалификация и схема оплаты.',
      'Нажмите «Добавить сотрудника».',
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
    id: 'clients-nav',
    title: 'Раздел «Клиенты»',
    description: 'Переход к клиентам',
    content: [
      'В «Клиентах» — все ученики школы.',
      'Нажмите пункт меню «Клиенты».',
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
    description: 'Добавление клиента',
    content: [
      'Добавьте первого клиента и заполните карточку.',
      'Нажмите «Добавить клиента».',
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
    title: 'Карточка и абонемент',
    description: 'Клиент в списке',
    content: [
      'В списке видны баланс, задолженность и просроченные платежи.',
      'В карточке — группы, платежи, достижения, нормативы.',
      'Выдача абонемента клиенту отменяет незакрытые ежемесячные счета группы.',
      'Пока действует абонемент (или долг по нему), ежемесячный платёж группы не начисляется.',
      'Чип абонемента показывает остаток посещений или долг.',
    ],
    targetSelector: '[data-onboarding="clients-table"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'memberships-nav',
    title: 'Раздел «Абонементы»',
    description: 'Каталог тарифов',
    content: [
      'Здесь создают тарифы абонементов: пакеты посещений или период.',
      'Нажмите «Абонементы» в меню.',
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
    title: 'Каталог абонементов',
    description: 'Создание тарифов',
    content: [
      'Создайте тарифы с ценой, числом посещений или длительностью.',
      'Клиенту тариф выдаётся из раздела «Клиенты».',
      'Абонемент и ежемесячная оплата группы не действуют одновременно.',
    ],
    targetSelector: '[data-onboarding="memberships-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'schedule-nav',
    title: 'Календарный план',
    description: 'Расписание и соревнования',
    content: [
      'Календарный план — расписание тренировок и соревнования.',
      'Нажмите пункт в меню.',
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
    title: 'Расписание и посещаемость',
    description: 'Тренировки',
    content: [
      'Создавайте групповые и индивидуальные тренировки.',
      'После занятия отметьте посещаемость; для пропусков — «Не списывать».',
      'Если абонемент исчерпан, посещение можно отметить в долг — долг учтётся при продлении.',
    ],
    targetSelector: '[data-onboarding="schedule-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'schedule-competitions',
    title: 'Соревнования',
    description: 'Вкладка соревнований',
    content: [
      'Откройте вкладку «Соревнования» на этой странице.',
      'Создавайте соревнования, участников и результаты.',
      'Если тренер занят — предложите замену тренера в карточке соревнования.',
    ],
    targetSelector: '[data-onboarding="schedule-competitions-tab"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'payments-nav',
    title: 'Раздел «Финансы»',
    description: 'Переход к финансам',
    content: [
      'В «Финансах» — операции, зарплаты и оплата абонементов/месячных счетов.',
      'Нажмите «Финансы» в меню.',
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
    id: 'finance-page',
    title: 'Финансы школы',
    description: 'Три вкладки',
    content: [
      '«Все операции» — журнал доходов и расходов.',
      '«Зарплата тренеров» — начисления и выплаты.',
      '«Оплата абонементов» — приём оплат по счетам и абонементам.',
      'Ежемесячные счета групп создаются автоматически в день оплаты.',
      'Отменять финансовые операции может только владелец школы.',
    ],
    targetSelector: '[data-onboarding="finance-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'settings-nav',
    title: 'Раздел «Настройки»',
    description: 'Переход к настройкам',
    content: [
      'В настройках — профиль, меню и параметры школы.',
      'Нажмите «Настройки».',
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
    description: 'Параметры школы',
    content: [
      'Смена email и пароля, видимость пунктов меню.',
      'День выплаты зарплаты и дату сброса членских взносов меняет только владелец.',
      'Здесь же можно снова запустить это обучение.',
    ],
    targetSelector: '[data-onboarding="settings-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'faq-nav',
    title: 'Раздел «FAQ»',
    description: 'Частые вопросы',
    content: [
      'Краткие ответы по ролям, оплате и работе кабинета.',
      'Нажмите «FAQ».',
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
    description: 'Справка',
    content: [
      'Вопросы по категориям; есть поиск.',
      'Если ответа нет — напишите в поддержку.',
    ],
    targetSelector: '[data-onboarding="faq-page"]',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'knowledge-base-nav',
    title: 'Раздел «База знаний»',
    description: 'Документация',
    content: [
      'Подробные инструкции по функциям системы.',
      'Нажмите «База знаний».',
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
    description: 'Документация',
    content: [
      'Ищите статьи по названию и фильтруйте по темам.',
      'База обновляется вместе с новыми возможностями.',
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
      'Вы прошли обучение по кабинету.',
      'При вопросах откройте FAQ или Базу знаний.',
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
    const sel = currentStep.targetSelector;
    const expectedPath = sel.includes('memberships') ? '/memberships' :
                        sel.includes('clients') ? '/clients' :
                        sel.includes('groups') ? '/groups' :
                        sel.includes('schedule') ? '/schedule' :
                        sel.includes('dashboard') ? '/dashboard' :
                        sel.includes('trainers') ? '/trainers' :
                        sel.includes('branches') ? '/branches' :
                        sel.includes('payments') || sel.includes('finance') ? '/finance' :
                        sel.includes('settings') ? '/settings' :
                        sel.includes('faq') ? '/faq' :
                        sel.includes('knowledge-base') ? '/knowledge-base' : null;

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

