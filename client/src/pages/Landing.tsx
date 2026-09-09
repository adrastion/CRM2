import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/common/BrandLogo';
import PublicFooter from '../components/PublicFooter';
import { colors, radii, typography } from '../theme/tokens';
import { currentSessionDestination, hasAnySession } from '../utils/authSession';
import heroGym from '../assets/landing-hero-gym.jpg';
import sectionDesk from '../assets/landing-section-desk.jpg';

const MODULES = [
  {
    title: 'Панель управления',
    text: 'Метрики школы, быстрые действия и обзор дня на одном экране.',
  },
  {
    title: 'Клиенты и лиды',
    text: 'Воронка, пробные занятия и полная карточка спортсмена.',
  },
  {
    title: 'Сотрудники',
    text: 'Тренеры и администраторы; работа одного специалиста в нескольких школах.',
  },
  {
    title: 'Группы и филиалы',
    text: 'Составы, залы и филиалы с привязкой к расписанию.',
  },
  {
    title: 'Календарный план',
    text: 'Занятия, соревнования и события; подсказки по замене тренера.',
  },
  {
    title: 'Посещаемость',
    text: 'Отметки на занятии и выгрузка в Excel по нужным срезам.',
  },
  {
    title: 'Абонементы и финансы',
    text: 'Выдача, оплаты, начисления и журнал всех операций.',
  },
  {
    title: 'Зарплата тренеров',
    text: 'Гибкие схемы начисления и прозрачный учёт выплат.',
  },
  {
    title: 'Чаты',
    text: 'Переписка школы с непрочитанными в реальном времени.',
  },
  {
    title: 'Нормативы',
    text: 'Шаблоны для групп и результаты учеников.',
  },
  {
    title: 'База знаний',
    text: 'Инструкции и FAQ прямо в кабинете сотрудников.',
  },
  {
    title: 'Единый вход',
    text: 'Один логин для ролей и переключение сохранённых аккаунтов.',
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
    title: 'Клиент / родитель',
    text: 'Кабинет спортсмена: занятия, абонементы, связь со школой.',
  },
] as const;

const CAPABILITIES = [
  {
    id: 'clients',
    title: 'Клиенты от лида до постоянного ученика',
    text: 'Ведите воронку, назначайте пробные и держите карточку спортсмена с группами и платежами.',
    points: ['Статусы лидов', 'Пробные занятия', 'История по ученику'],
    visual: 'clients' as const,
  },
  {
    id: 'schedule',
    title: 'Расписание без путаницы в чатах',
    text: 'Календарь связывает группы, тренеров и филиалы. При конфликте с соревнованиями — предложение замены.',
    points: ['Группы и залы', 'Замена тренера', 'События школы'],
    visual: 'schedule' as const,
  },
  {
    id: 'finance',
    title: 'Абонементы, оплаты и зарплата вместе',
    text: 'Выдача абонементов, платежи, журнал операций и начисление зарплаты по схемам школы.',
    points: ['Абонементы', 'Журнал операций', 'Начисление зарплаты'],
    visual: 'finance' as const,
  },
] as const;

const fadeUp = {
  animation: 'landingFadeUp 0.75s cubic-bezier(0.22, 0.61, 0.36, 1) both',
  '@keyframes landingFadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
};

/** Живой UI-мок кабинета поверх фото. */
const UiMock: React.FC<{ variant: 'clients' | 'schedule' | 'finance' }> = ({ variant }) => {
  const rows =
    variant === 'clients'
      ? [
          { a: 'Иванов А.', b: 'Лид', c: 'Пробное' },
          { a: 'Петрова М.', b: 'Активный', c: 'Группа А' },
          { a: 'Сидоров К.', b: 'Активный', c: 'Группа Б' },
        ]
      : variant === 'schedule'
        ? [
            { a: '10:00', b: 'Дзюдо · младшая', c: 'Зал 1' },
            { a: '12:30', b: 'Самбо · средний', c: 'Зал 2' },
            { a: '17:00', b: 'Вольная борьба', c: 'Зал 1' },
          ]
        : [
            { a: 'Абонемент 8', b: '−4 500 ₽', c: 'Выдача' },
            { a: 'Оплата клиента', b: '+4 500 ₽', c: 'Приход' },
            { a: 'Зарплата', b: '−12 000 ₽', c: 'Выплата' },
          ];

  const title =
    variant === 'clients' ? 'Клиенты' : variant === 'schedule' ? 'Расписание' : 'Операции';

  return (
    <Box
      aria-hidden
      sx={{
        bgcolor: 'rgba(255,255,255,0.96)',
        borderRadius: `${radii.panel}px`,
        p: { xs: 2, md: 2.5 },
        boxShadow: '0 20px 50px rgba(13, 75, 215, 0.18)',
        backdropFilter: 'blur(8px)',
        animation: 'landingFloat 7s ease-in-out infinite',
        '@keyframes landingFloat': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: colors.text, mb: 1.5 }}>
        {title}
      </Typography>
      {rows.map((row, i) => (
        <Box
          key={`${row.a}-${i}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr auto',
            gap: 1,
            alignItems: 'center',
            py: 1.1,
            borderBottom: i < rows.length - 1 ? `1px solid ${colors.divider}` : 'none',
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.text }} noWrap>
            {row.a}
          </Typography>
          <Typography sx={{ fontSize: 12, color: colors.textMuted }} noWrap>
            {row.b}
          </Typography>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.primary,
              bgcolor: colors.primarySoft,
              px: 1,
              py: 0.35,
              borderRadius: 1,
            }}
          >
            {row.c}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const loggedIn = hasAnySession();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goPrimary = () => {
    if (loggedIn) {
      navigate(currentSessionDestination() || '/dashboard');
      return;
    }
    navigate('/register');
  };

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          transition: 'background-color 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease',
          bgcolor: scrolled ? 'rgba(255,255,255,0.94)' : 'transparent',
          borderBottom: scrolled ? `1px solid ${colors.divider}` : '1px solid transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box
            onClick={() => navigate('/')}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              px: scrolled ? 0 : 1.25,
              py: scrolled ? 0 : 0.75,
              borderRadius: 2,
              bgcolor: scrolled ? 'transparent' : 'rgba(255,255,255,0.92)',
              transition: 'background-color 0.25s ease, padding 0.25s ease',
            }}
          >
            <BrandLogo
              size={{ xs: 34, md: 40 }}
              layout="horizontal"
              wordmarkSize={{ xs: 12, md: 14 }}
            />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.5, sm: 1 },
              px: scrolled ? 0 : 1,
              py: scrolled ? 0 : 0.5,
              borderRadius: 2,
              bgcolor: scrolled ? 'transparent' : 'rgba(255,255,255,0.88)',
              transition: 'background-color 0.25s ease, padding 0.25s ease',
            }}
          >
            <Button
              color="inherit"
              onClick={scrollToFeatures}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: colors.text, fontWeight: 600 }}
            >
              Возможности
            </Button>
            <Button
              color="inherit"
              onClick={() => navigate('/pricing')}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: colors.text, fontWeight: 600 }}
            >
              Тарифы
            </Button>
            {loggedIn ? (
              <Button variant="contained" onClick={goPrimary} sx={{ fontWeight: 700 }}>
                В кабинет
              </Button>
            ) : (
              <>
                <Button
                  color="inherit"
                  onClick={() => navigate('/auth')}
                  sx={{ color: colors.text, fontWeight: 600 }}
                >
                  Войти
                </Button>
                <Button variant="contained" onClick={() => navigate('/register')} sx={{ fontWeight: 700 }}>
                  Регистрация
                </Button>
              </>
            )}
          </Box>
        </Container>
      </Box>

      {/* Герой: full-bleed фото зала */}
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
              maxWidth: 520,
            }}
          >
            CRM для спортивных школ и секций
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
            Клиенты, расписание, абонементы, посещаемость и зарплата — в одном кабинете под вашу школу.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="contained"
              size="large"
              onClick={goPrimary}
              sx={{
                px: 3.5,
                py: 1.4,
                fontWeight: 800,
                fontSize: 15,
                bgcolor: colors.primary,
                boxShadow: '0 12px 32px rgba(72, 128, 255, 0.45)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  bgcolor: colors.primaryDark,
                  transform: 'translateY(-2px)',
                  boxShadow: '0 16px 36px rgba(72, 128, 255, 0.55)',
                },
              }}
            >
              {loggedIn ? 'Открыть кабинет' : 'Начать работу'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={scrollToFeatures}
              sx={{
                px: 3.5,
                py: 1.4,
                fontWeight: 700,
                fontSize: 15,
                color: colors.white,
                borderColor: 'rgba(255,255,255,0.65)',
                '&:hover': {
                  borderColor: colors.white,
                  bgcolor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              Смотреть возможности
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Модули */}
      <Box
        id="features"
        component="section"
        sx={{
          py: { xs: 7, md: 10 },
          bgcolor: colors.white,
          scrollMarginTop: 24,
          backgroundImage: `
            radial-gradient(ellipse 60% 40% at 100% 0%, rgba(72,128,255,0.1), transparent 55%),
            radial-gradient(ellipse 50% 35% at 0% 100%, rgba(13,75,215,0.06), transparent 50%)
          `,
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
            Весь кабинет школы — по делу
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
            Разделы, которыми пользуются каждый день: от панели и клиентов до финансов и чатов.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: { xs: 0, md: 0 },
              borderTop: `1px solid ${colors.divider}`,
            }}
          >
            {MODULES.map((item, index) => (
              <Box
                key={item.title}
                sx={{
                  py: 3,
                  pr: { md: 3 },
                  pl: { md: index % 3 === 0 ? 0 : 3 },
                  borderBottom: `1px solid ${colors.divider}`,
                  borderRight: {
                    md: index % 3 === 2 ? 'none' : `1px solid ${colors.divider}`,
                  },
                  transition: 'background-color 0.2s ease',
                  '&:hover': { bgcolor: 'rgba(72,128,255,0.04)' },
                }}
              >
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    color: colors.primary,
                    mb: 1,
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 17, color: colors.text, mb: 0.75 }}>
                  {item.title}
                </Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: 14, lineHeight: 1.55 }}>
                  {item.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Сценарии с фото + UI */}
      {CAPABILITIES.map((block, index) => {
        const photoLeft = index % 2 === 1;
        return (
          <Box
            key={block.id}
            component="section"
            sx={{
              position: 'relative',
              minHeight: { xs: 520, md: 560 },
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
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
                py: { xs: 6, md: 8 },
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: { xs: 4, md: 6 },
                alignItems: 'center',
              }}
            >
              <Box sx={{ order: { xs: 1, md: photoLeft ? 2 : 1 } }}>
                <Typography
                  component="h2"
                  sx={{
                    fontSize: { xs: 24, md: 30 },
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
              <Box sx={{ order: { xs: 2, md: photoLeft ? 1 : 2 }, maxWidth: 420, width: '100%' }}>
                <UiMock variant={block.visual} />
              </Box>
            </Container>
          </Box>
        );
      })}

      {/* Роли */}
      <Box
        component="section"
        sx={{
          py: { xs: 7, md: 9 },
          bgcolor: colors.white,
          borderTop: `1px solid ${colors.divider}`,
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
            Для каждой роли — свой кабинет
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
            Данные школ изолированы. Один вход — разные уровни доступа.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: { xs: 4, md: 0 },
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

      {/* CTA на фото */}
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
            Соберите школу в одном кабинете
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.9)',
              mb: 3.5,
              fontSize: 15,
              lineHeight: 1.55,
            }}
          >
            Регистрация занимает минуты — дальше клиенты, расписание и оплаты уже в системе.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="contained"
              size="large"
              onClick={goPrimary}
              sx={{
                bgcolor: colors.white,
                color: colors.primaryDark,
                fontWeight: 800,
                px: 3.5,
                py: 1.35,
                '&:hover': { bgcolor: colors.primarySoft },
              }}
            >
              {loggedIn ? 'В кабинет' : 'Создать аккаунт'}
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
