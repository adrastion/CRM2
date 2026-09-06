import React, { useState } from 'react';
import {
  Dialog,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Paper,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Close,
  Dashboard,
  People,
  Groups,
  CalendarToday,
  AttachMoney,
  Settings,
  CheckCircle,
  ArrowForward,
  ArrowBack,
} from '@mui/icons-material';
import { apiService } from '../services/api';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  content: string[];
  targetElement?: string; // ID элемента для подсветки
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: 'Добро пожаловать!',
    description: 'Краткое знакомство с системой',
    icon: <Dashboard />,
    content: [
      'Добро пожаловать в CRM систему для управления спортивной школой!',
      'Это интерактивное обучение поможет вам быстро освоить основные функции.',
      'Вы можете пропустить обучение в любой момент или пройти его позже.',
      'Обучение займет около 5 минут.',
    ],
  },
  {
    title: 'Панель управления',
    description: 'Главная страница с общей статистикой',
    icon: <Dashboard />,
    content: [
      'Панель управления (Dashboard) - это главная страница системы.',
      'Здесь отображается общая статистика: количество клиентов, тренеров, групп, филиалов.',
      'Вы увидите месячный доход и процент посещаемости.',
      'Список предстоящих тренировок на неделю.',
      'Кнопка "Мой тариф" показывает использование ресурсов и лимиты вашего тарифа.',
    ],
  },
  {
    title: 'Управление клиентами',
    description: 'Работа с клиентами (учениками)',
    icon: <People />,
    content: [
      'В разделе "Клиенты" вы можете добавлять, редактировать и просматривать информацию о клиентах.',
      'Кликните на имя клиента в любом месте системы для перехода к его карточке.',
      'В карточке клиента доступны: группы, история платежей, достижения, нормативы с графиками.',
      'Вы можете добавлять клиентов в группы и отслеживать их прогресс.',
    ],
  },
  {
    title: 'Управление группами',
    description: 'Создание и управление группами',
    icon: <Groups />,
    content: [
      'В разделе "Группы" создавайте группы для организации тренировок.',
      'Укажите название, возрастные ограничения, максимальное количество участников.',
      'Назначьте тренера и филиал для группы.',
      'Добавляйте клиентов в группы через иконку "Люди" (👥).',
      'Один клиент может быть участником нескольких групп.',
    ],
  },
  {
    title: 'Расписание тренировок',
    description: 'Создание и управление расписанием',
    icon: <CalendarToday />,
    content: [
      'В разделе "Расписание" создавайте тренировки для групп.',
      'Можно создать разовую тренировку или повторяющиеся тренировки.',
      'Для повторяющихся тренировок выберите дни недели или конкретные даты.',
      'После проведения тренировки откройте её и нажмите иконку "Люди" для отметки посещаемости.',
      'Используйте чекбокс "Не списывать средства" для пропусков, если не хотите списывать деньги.',
    ],
  },
  {
    title: 'Платежи и финансы',
    description: 'Управление финансами',
    icon: <AttachMoney />,
    content: [
      'В разделе "Финансы" фиксируйте платежи от клиентов и расходы школы.',
      'Для групп с ежемесячной оплатой система создаёт платежи автоматически.',
      'Отслеживайте задолженности клиентов и зарплаты сотрудников.',
      'Все операции учитываются в статистике на Dashboard.',
    ],
  },
  {
    title: 'Настройки',
    description: 'Персонализация системы',
    icon: <Settings />,
    content: [
      'В разделе "Настройки" вы можете:',
      '• Сменить почту и пароль',
      '• Настроить видимость вкладок в меню',
      '• Включить/выключить темную тему',
      '• Настроить длительность тренировок по умолчанию',
      'Вы также можете найти подробную документацию в разделе "База знаний".',
    ],
  },
  {
    title: 'Обучение завершено!',
    description: 'Готовы начать работу',
    icon: <CheckCircle />,
    content: [
      'Поздравляем! Вы завершили интерактивное обучение.',
      'Теперь вы знаете основные функции системы.',
      'Если у вас возникнут вопросы, обратитесь к разделу "База знаний" или "FAQ".',
      'Желаем успешной работы с системой!',
    ],
  },
];

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onDecline: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ open, onClose, onComplete, onDecline }) => {
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    if (activeStep < onboardingSteps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      handleComplete();
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
      onComplete(); // Все равно закрываем, даже если ошибка
    }
  };

  const handleDecline = async () => {
    try {
      await apiService.updateOnboardingStatus({ onboardingDeclined: true });
      onDecline();
    } catch (error) {
      console.error('Error updating onboarding status:', error);
      onDecline(); // Все равно закрываем
    }
  };

  const handleSkip = () => {
    handleDecline();
  };

  const currentStep = onboardingSteps[activeStep];
  const isLastStep = activeStep === onboardingSteps.length - 1;
  const isFirstStep = activeStep === 0;

  return (
    <Dialog
      open={open}
      onClose={handleDecline}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: 6,
        },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={handleDecline}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1,
          }}
        >
          <Close />
        </IconButton>

        <Box sx={{ p: 4, pb: 2 }}>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
            {onboardingSteps.map((step, index) => (
              <Step key={index}>
                <StepLabel>{step.title}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Paper
            elevation={0}
            sx={{
              p: 4,
              backgroundColor: 'primary.light',
              color: 'white',
              borderRadius: 2,
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box sx={{ mr: 2, fontSize: 40 }}>{currentStep.icon}</Box>
              <Box>
                <Typography variant="h5" component="h2" fontWeight="bold">
                  {currentStep.title}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {currentStep.description}
                </Typography>
              </Box>
            </Box>
          </Paper>

          <Box sx={{ minHeight: 200 }}>
            {isFirstStep ? (
              <Typography variant="body1" sx={{ lineHeight: 1.8, mb: 2 }}>
                {currentStep.content[0]}
              </Typography>
            ) : isLastStep ? (
              <Box>
                <Typography variant="body1" sx={{ lineHeight: 1.8, mb: 2, textAlign: 'center' }}>
                  {currentStep.content[0]}
                </Typography>
                <List>
                  {currentStep.content.slice(1).map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircle color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={item} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <List>
                {currentStep.content.map((item, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <ArrowForward color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={item}
                      primaryTypographyProps={{
                        variant: 'body1',
                        sx: { lineHeight: 1.8 },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Box>

        <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'space-between' }}>
          <Button onClick={handleSkip} color="inherit">
            Пропустить обучение
          </Button>
          <Box>
            {!isFirstStep && (
              <Button onClick={handleBack} sx={{ mr: 1 }} startIcon={<ArrowBack />}>
                Назад
              </Button>
            )}
            <Button
              onClick={handleNext}
              variant="contained"
              endIcon={isLastStep ? <CheckCircle /> : <ArrowForward />}
            >
              {isLastStep ? 'Завершить' : 'Далее'}
            </Button>
          </Box>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default OnboardingTour;

