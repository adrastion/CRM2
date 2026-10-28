import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PublicSiteNav from '../components/PublicSiteNav';
import PublicFooter from '../components/PublicFooter';
import { colors, radii, typography } from '../theme/tokens';
import { currentSessionDestination, hasAnySession } from '../utils/authSession';
import heroGym from '../assets/landing-hero-gym.webp';
import sectionDesk from '../assets/landing-section-desk.webp';
import shotDashboard from '../assets/landing-shot-dashboard.webp';
import shotClients from '../assets/landing-shot-clients.webp';
import shotSchedule from '../assets/landing-shot-schedule.webp';
import shotFinance from '../assets/landing-shot-finance.webp';

const SCHOOL_FEATURES = [
  {
    id: 'clients',
    title: 'Клиенты от лида до постоянного ученика',
    text: 'Воронка, пробные занятия и полная карточка спортсмена с группами и платежами.',
    points: ['Статусы лидов', 'Пробные занятия', 'История по ученику'],
    shot: shotClients,
    alt: 'Раздел «Клиенты» в кабинете ПРОФСПОРТСРМ',
  },
  {
    id: 'schedule',
    title: 'Расписание без путаницы в чатах',
    text: 'Календарь связывает группы, тренеров и филиалы. При конфликте с соревнованиями — предложение замены.',
    points: ['Группы и залы', 'Замена тренера', 'События школы'],
    shot: shotSchedule,
    alt: 'Календарный план в кабинете ПРОФСПОРТСРМ',
  },
  {
    id: 'finance',
    title: 'Абонементы, оплаты и зарплата вместе',
    text: 'Выдача абонементов, платежи, журнал операций и начисление зарплаты по схемам школы.',
    points: ['Абонементы', 'Журнал операций', 'Зарплата тренеров'],
    shot: shotFinance,
    alt: 'Финансы в кабинете ПРОФСПОРТСРМ',
  },
] as const;

const CLIENT_POINTS = [
  {
    title: 'Панель и неделя',
    text: 'Ближайшие занятия, метрики и быстрые действия на одном экране.',
  },
  {
    title: 'Календарный план',
    text: 'Тренировки и соревнования — в понятном виде для ученика и родителя.',
  },
  {
    title: 'Платежи и документы',
    text: 'Абонементы, оплаты и нужные бумаги всегда под рукой.',
  },
  {
    title: 'Настройки',
    text: 'Уведомления и смена пароля в личном кабинете.',
  },
] as const;

const ROLES = [
  {
    title: 'Владелец и администратор',
    text: 'Школа целиком: люди, расписание, деньги и настройки.',
  },
  {
    title: 'Тренер',
    text: 'Свои группы, посещаемость и раздел «Мой заработок».',
  },
  {
    title: 'Клиент и родитель',
    text: 'Личный кабинет: занятия, платежи, документы и связь со школой.',
  },
] as const;

const CTA_STEPS = [
  {
    step: '01',
    title: 'Регистрация',
    text: 'Создайте аккаунт школы — займёт несколько минут.',
    path: '/register',
    action: 'Создать аккаунт',
  },
  {
    step: '02',
    title: 'Тарифы',
    text: 'Выберите план под размер школы или уточните условия.',
    path: '/pricing',
    action: 'Смотреть тарифы',
  },
  {
    step: '03',
    title: 'Контакты',
    text: 'Вопросы по подключению — напишите нам, поможем.',
    path: '/contacts',
    action: 'Написать нам',
  },
] as const;

const fadeUp = {
  animation: 'landingFadeUp 0.75s cubic-bezier(0.22, 0.61, 0.36, 1) both',
  '@keyframes landingFadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
};

const ctaHover = {
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
  },
};

/** Реальный скрин кабинета в рамке. */
const ShotFrame: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <Box
    sx={{
      borderRadius: `${radii.panel}px`,
      overflow: 'hidden',
      boxShadow: '0 20px 50px rgba(13, 75, 215, 0.18)',
      border: `1px solid ${colors.divider}`,
      bgcolor: colors.card,
      animation: 'landingFloat 7s ease-in-out infinite',
      '@keyframes landingFloat': {
        '0%, 100%': { transform: 'translateY(0)' },
        '50%': { transform: 'translateY(-6px)' },
      },
    }}
  >
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      sx={{
        display: 'block',
        width: '100%',
        height: 'auto',
        verticalAlign: 'middle',
      }}
    />
  </Box>
);

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const loggedIn = hasAnySession();

  const goSchoolPrimary = () => {
    if (loggedIn) {
      navigate(currentSessionDestination() || '/dashboard');
      return;
    }
    navigate('/register');
  };

  const goLogin = () => {
    if (loggedIn) {
      navigate(currentSessionDestination() || '/dashboard');
      return;
    }
    navigate('/auth');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: colors.white,
        fontFamily: '"Montserrat", sans-serif',
      }}
    >
      <PublicSiteNav
        variant="overlay"
        landingAnchors={[
          { label: 'Школам', onClick: () => scrollToId('schools') },
          { label: 'Ученикам', onClick: () => scrollToId('clients') },
        ]}
      />

      {/* Герой */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          minHeight: { xs: '92vh', md: '100vh' },
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
          backgroundImage: `url(${heroGym})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `
              linear-gradient(90deg, rgba(8, 24, 64, 0.88) 0%, rgba(8, 24, 64, 0.55) 42%, rgba(8, 24, 64, 0.2) 70%, transparent 100%),
              linear-gradient(0deg, rgba(8, 24, 64, 0.75) 0%, transparent 45%)
            `,
          }}
        />

        <Container
          maxWidth="lg"
          sx={{
            position: 'relative',
            zIndex: 1,
            pb: { xs: 7, md: 10 },
            pt: { xs: 14, md: 18 },
            ...fadeUp,
          }}
        >
          <Typography
            component="p"
            sx={{
              fontSize: { xs: 36, sm: 52, md: 68 },
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 0.98,
              mb: 2.5,
              color: colors.white,
              textShadow: '0 8px 40px rgba(0,0,0,0.35)',
            }}
          >
            <Box component="span" sx={{ color: colors.primarySoft }}>
              ПРОФ
            </Box>
            СПОРТСРМ
          </Typography>

          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 20, sm: 26, md: 32 },
              fontWeight: 700,
              color: colors.white,
              lineHeight: 1.2,
              mb: 1.75,
              maxWidth: 540,
            }}
          >
            Одна платформа для школы и кабинета ученика
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: 15, md: 16 },
              color: 'rgba(255,255,255,0.86)',
              maxWidth: 460,
              mb: 3.5,
              lineHeight: 1.55,
            }}
          >
            Сотрудники ведут клиентов, расписание и финансы. Ученики и родители — занятия, платежи и документы.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="contained"
              size="large"
              onClick={goSchoolPrimary}
              sx={{
                px: 3.5,
                py: 1.4,
                fontWeight: 800,
                fontSize: 15,
                textTransform: 'none',
                bgcolor: colors.primary,
                boxShadow: '0 12px 32px rgba(72, 128, 255, 0.45)',
                ...ctaHover,
                '&:hover': {
                  bgcolor: colors.primaryDark,
                  transform: 'translateY(-2px)',
                  boxShadow: '0 16px 36px rgba(72, 128, 255, 0.55)',
                },
              }}
            >
              {loggedIn ? 'Открыть кабинет' : 'Подключить школу'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={goLogin}
              sx={{
                px: 3.5,
                py: 1.4,
                fontWeight: 700,
                fontSize: 15,
                textTransform: 'none',
                color: colors.white,
                borderColor: 'rgba(255,255,255,0.65)',
                ...ctaHover,
                '&:hover': {
                  borderColor: colors.white,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              {loggedIn ? 'В кабинет' : 'Войти'}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Два пути */}
      <Box
        id="audience"
        component="section"
        sx={{
          py: { xs: 7, md: 9 },
          bgcolor: colors.white,
          scrollMarginTop: 72,
          borderBottom: `1px solid ${colors.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 26, md: 34 },
              fontWeight: 800,
              color: colors.text,
              mb: 1.25,
              letterSpacing: '-0.02em',
            }}
          >
            Выберите свой путь
          </Typography>
          <Typography
            sx={{
              color: colors.textMuted,
              mb: 5,
              maxWidth: 520,
              fontSize: typography.field,
              lineHeight: 1.55,
            }}
          >
            Школа подключается через регистрацию. Ученик и родитель входят в личный кабинет.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: { xs: 4, md: 0 },
              borderTop: `1px solid ${colors.divider}`,
              pt: 4,
            }}
          >
            <Box
              sx={{
                pr: { md: 5 },
                borderRight: { md: `1px solid ${colors.divider}` },
              }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: colors.primary,
                  mb: 1.5,
                }}
              >
                ДЛЯ ШКОЛЫ
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 22, color: colors.text, mb: 1.25 }}>
                Кабинет сотрудников
              </Typography>
              <Typography sx={{ color: colors.textMuted, fontSize: 15, lineHeight: 1.55, mb: 3, maxWidth: 400 }}>
                Клиенты, расписание, абонементы, посещаемость, зарплата и чаты — в одном месте.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                <Button
                  variant="contained"
                  onClick={goSchoolPrimary}
                  sx={{ fontWeight: 700, textTransform: 'none', ...ctaHover }}
                >
                  {loggedIn ? 'В кабинет' : 'Регистрация'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/pricing')}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Тарифы
                </Button>
              </Box>
            </Box>

            <Box sx={{ pl: { md: 5 } }}>
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: colors.primary,
                  mb: 1.5,
                }}
              >
                ДЛЯ УЧЕНИКА И РОДИТЕЛЯ
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 22, color: colors.text, mb: 1.25 }}>
                Личный кабинет
              </Typography>
              <Typography sx={{ color: colors.textMuted, fontSize: 15, lineHeight: 1.55, mb: 3, maxWidth: 400 }}>
                Расписание, соревнования, платежи, документы и связь со школой — без лишних чатов.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                <Button
                  variant="contained"
                  onClick={goLogin}
                  sx={{ fontWeight: 700, textTransform: 'none', ...ctaHover }}
                >
                  {loggedIn ? 'Открыть' : 'Войти в кабинет'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => scrollToId('clients')}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Что внутри
                </Button>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Школам */}
      <Box
        id="schools"
        component="section"
        sx={{
          py: { xs: 7, md: 10 },
          bgcolor: colors.surface,
          scrollMarginTop: 72,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 26, md: 34 },
              fontWeight: 800,
              color: colors.text,
              mb: 1.25,
              letterSpacing: '-0.02em',
              maxWidth: 560,
            }}
          >
            Для школы — всё необходимое
          </Typography>
          <Typography
            sx={{
              color: colors.textMuted,
              mb: 5,
              maxWidth: 520,
              fontSize: typography.field,
              lineHeight: 1.55,
            }}
          >
            Три опоры ежедневной работы: люди, расписание и деньги.
          </Typography>
        </Container>

        {SCHOOL_FEATURES.map((block, index) => {
          const photoLeft = index % 2 === 1;
          return (
            <Box
              key={block.id}
              sx={{
                position: 'relative',
                minHeight: { xs: 480, md: 520 },
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                mb: index < SCHOOL_FEATURES.length - 1 ? { xs: 3, md: 4 } : 0,
                backgroundImage: `url(${sectionDesk})`,
                backgroundSize: 'cover',
                backgroundPosition: photoLeft ? '30% center' : '70% center',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: photoLeft
                    ? `linear-gradient(270deg, rgba(245,246,250,0.97) 0%, rgba(245,246,250,0.92) 48%, rgba(245,246,250,0.35) 78%, transparent 100%)`
                    : `linear-gradient(90deg, rgba(245,246,250,0.97) 0%, rgba(245,246,250,0.92) 48%, rgba(245,246,250,0.35) 78%, transparent 100%)`,
                }}
              />
              <Container
                maxWidth="lg"
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  py: { xs: 5, md: 7 },
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1.15fr' },
                  gap: { xs: 4, md: 5 },
                  alignItems: 'center',
                }}
              >
                <Box sx={{ order: { xs: 1, md: photoLeft ? 2 : 1 } }}>
                  <Typography
                    component="h3"
                    sx={{
                      fontSize: { xs: 22, md: 28 },
                      fontWeight: 800,
                      color: colors.text,
                      mb: 1.5,
                      letterSpacing: '-0.02em',
                      maxWidth: 440,
                    }}
                  >
                    {block.title}
                  </Typography>
                  <Typography
                    sx={{
                      color: colors.textMuted,
                      fontSize: 15,
                      lineHeight: 1.55,
                      mb: 2.5,
                      maxWidth: 440,
                    }}
                  >
                    {block.text}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {block.points.map((point) => (
                      <Box key={point} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: colors.primary,
                            flexShrink: 0,
                          }}
                        />
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: colors.text }}>
                          {point}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box sx={{ order: { xs: 2, md: photoLeft ? 1 : 2 }, width: '100%' }}>
                  <ShotFrame src={block.shot} alt={block.alt} />
                </Box>
              </Container>
            </Box>
          );
        })}
      </Box>

      {/* Ученикам и родителям */}
      <Box
        id="clients"
        component="section"
        sx={{
          py: { xs: 7, md: 10 },
          bgcolor: colors.white,
          scrollMarginTop: 72,
          borderBottom: `1px solid ${colors.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
              gap: { xs: 4, md: 6 },
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: colors.primary,
                  mb: 1.5,
                }}
              >
                ЛИЧНЫЙ КАБИНЕТ
              </Typography>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: 26, md: 34 },
                  fontWeight: 800,
                  color: colors.text,
                  mb: 1.5,
                  letterSpacing: '-0.02em',
                }}
              >
                Для ученика и родителя — ясный кабинет
              </Typography>
              <Typography
                sx={{
                  color: colors.textMuted,
                  mb: 4,
                  maxWidth: 460,
                  fontSize: typography.field,
                  lineHeight: 1.55,
                }}
              >
                Обновлённый личный кабинет: панель недели, календарный план, платежи, документы и настройки.
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 3,
                  mb: 4,
                  borderTop: `1px solid ${colors.divider}`,
                  pt: 3,
                }}
              >
                {CLIENT_POINTS.map((item) => (
                  <Box key={item.title}>
                    <Typography sx={{ fontWeight: 800, fontSize: 16, color: colors.text, mb: 0.75 }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ color: colors.textMuted, fontSize: 14, lineHeight: 1.55 }}>
                      {item.text}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Button
                variant="contained"
                size="large"
                onClick={goLogin}
                sx={{ fontWeight: 800, textTransform: 'none', px: 3, ...ctaHover }}
              >
                {loggedIn ? 'Открыть кабинет' : 'Войти в личный кабинет'}
              </Button>
            </Box>

            <Box>
              <ShotFrame src={shotDashboard} alt="Панель управления ПРОФСПОРТСРМ" />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Роли */}
      <Box
        component="section"
        sx={{
          py: { xs: 7, md: 9 },
          bgcolor: colors.white,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 26, md: 32 },
              fontWeight: 800,
              color: colors.text,
              mb: 1,
              letterSpacing: '-0.02em',
            }}
          >
            Для каждой роли — свой доступ
          </Typography>
          <Typography
            sx={{
              color: colors.textMuted,
              mb: 5,
              maxWidth: 500,
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Данные школ изолированы. Один вход — разные уровни прав.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: { xs: 4, md: 0 },
              borderTop: `1px solid ${colors.divider}`,
              pt: 4,
            }}
          >
            {ROLES.map((role, index) => (
              <Box
                key={role.title}
                sx={{
                  px: { md: index === 0 ? 0 : 4 },
                  borderLeft: {
                    md: index === 0 ? 'none' : `1px solid ${colors.divider}`,
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: 48,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: colors.primarySoft,
                    mb: 1.5,
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: colors.text, mb: 1 }}>
                  {role.title}
                </Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: 14, lineHeight: 1.55 }}>
                  {role.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Старт */}
      <Box
        id="start"
        component="section"
        sx={{ py: { xs: 7, md: 9 }, bgcolor: colors.surface, scrollMarginTop: 72 }}
      >
        <Container maxWidth="lg">
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 26, md: 34 },
              fontWeight: 800,
              color: colors.text,
              mb: 1.25,
              letterSpacing: '-0.02em',
            }}
          >
            Как подключить школу
          </Typography>
          <Typography
            sx={{
              color: colors.textMuted,
              mb: 4,
              maxWidth: 520,
              fontSize: typography.field,
              lineHeight: 1.55,
            }}
          >
            Регистрация → тарифы → контакты. На каждом шаге те же разделы в меню.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: { xs: 3, md: 0 },
              borderTop: `1px solid ${colors.divider}`,
              pt: 4,
            }}
          >
            {CTA_STEPS.map((item, index) => (
              <Box
                key={item.step}
                sx={{
                  px: { md: index === 0 ? 0 : 4 },
                  borderLeft: {
                    md: index === 0 ? 'none' : `1px solid ${colors.divider}`,
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: 40,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: colors.primarySoft,
                    mb: 1.5,
                  }}
                >
                  {item.step}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: colors.text, mb: 1 }}>
                  {item.title}
                </Typography>
                <Typography
                  sx={{ color: colors.textMuted, fontSize: 14, lineHeight: 1.55, mb: 2 }}
                >
                  {item.text}
                </Typography>
                <Button
                  variant={index === 0 ? 'contained' : 'outlined'}
                  onClick={() => navigate(item.path)}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  {item.action}
                </Button>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Финальный CTA */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          py: { xs: 8, md: 11 },
          overflow: 'hidden',
          backgroundImage: `url(${heroGym})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 60%',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, rgba(13,75,215,0.92) 0%, rgba(72,128,255,0.82) 100%)`,
          }}
        />
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 26, md: 34 },
              fontWeight: 800,
              color: colors.white,
              mb: 1.5,
              letterSpacing: '-0.02em',
            }}
          >
            Школа и кабинет ученика — в одной системе
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.9)',
              mb: 3.5,
              fontSize: 15,
              lineHeight: 1.55,
            }}
          >
            Подключите школу или войдите в личный кабинет.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="contained"
              size="large"
              onClick={goSchoolPrimary}
              sx={{
                bgcolor: colors.white,
                color: colors.primaryDark,
                fontWeight: 800,
                px: 3.5,
                py: 1.35,
                textTransform: 'none',
                ...ctaHover,
                '&:hover': { bgcolor: colors.primarySoft, transform: 'translateY(-2px)' },
              }}
            >
              {loggedIn ? 'В кабинет' : 'Подключить школу'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={goLogin}
              sx={{
                borderColor: 'rgba(255,255,255,0.75)',
                color: colors.white,
                fontWeight: 700,
                px: 3.5,
                py: 1.35,
                textTransform: 'none',
                ...ctaHover,
                '&:hover': {
                  borderColor: colors.white,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              {loggedIn ? 'Открыть' : 'Войти'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/pricing')}
              sx={{
                borderColor: 'rgba(255,255,255,0.75)',
                color: colors.white,
                fontWeight: 700,
                px: 3.5,
                py: 1.35,
                textTransform: 'none',
                '&:hover': {
                  borderColor: colors.white,
                  bgcolor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              Тарифы
            </Button>
          </Box>
        </Container>
      </Box>

      <PublicFooter />
    </Box>
  );
};

export default Landing;
