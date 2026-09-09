import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/common/BrandLogo';
import PublicFooter from '../components/PublicFooter';
import { colors, radii, typography } from '../theme/tokens';
import { currentSessionDestination, hasAnySession } from '../utils/authSession';

/** Краткий обзор модулей кабинета школы. */
const MODULES = [
  {
    title: 'Панель управления',
    text: 'Ключевые метрики школы: клиенты, группы, выручка и быстрые действия на одном экране.',
  },
  {
    title: 'Клиенты и лиды',
    text: 'Карточки учеников, статусы воронки, пробные занятия и история взаимодействий.',
  },
  {
    title: 'Сотрудники',
    text: 'Тренеры и администраторы; один специалист может работать в нескольких школах.',
  },
  {
    title: 'Группы и филиалы',
    text: 'Состав групп, залы и филиалы — с привязкой тренера и расписания.',
  },
  {
    title: 'Календарный план',
    text: 'Занятия, соревнования и события школы; при конфликте — предложение замены тренера.',
  },
  {
    title: 'Посещаемость',
    text: 'Отметки на занятиях и выгрузка в Excel по тренеру, клиенту или группе.',
  },
  {
    title: 'Абонементы и финансы',
    text: 'Тарифы, платежи, ежемесячные списания, перерасчёт и журнал всех операций.',
  },
  {
    title: 'Зарплата тренеров',
    text: 'Гибкие схемы начисления, в том числе на карточке группы, и учёт выплат.',
  },
  {
    title: 'Чаты',
    text: 'Переписка внутри школы с непрочитанными в реальном времени.',
  },
  {
    title: 'Нормативы',
    text: 'Привязка нормативов к группам и фиксация результатов учеников.',
  },
  {
    title: 'База знаний и FAQ',
    text: 'Инструкции и ответы для сотрудников прямо в кабинете.',
  },
  {
    title: 'Единый вход',
    text: 'Один логин для школы, клиента и других ролей; переключение сохранённых аккаунтов.',
  },
] as const;

const ROLES = [
  {
    title: 'Владелец и администратор',
    text: 'Полное управление школой: клиенты, сотрудники, финансы, абонементы и настройки.',
  },
  {
    title: 'Тренер',
    text: 'Свои группы, расписание, посещаемость и раздел «Мой заработок».',
  },
  {
    title: 'Клиент / родитель',
    text: 'Личный кабинет спортсмена: занятия, абонементы и связь со школой.',
  },
] as const;

const CAPABILITIES = [
  {
    id: 'clients',
    title: 'Клиенты от лида до постоянного ученика',
    text: 'Ведите воронку, назначайте пробные занятия и храните карточку спортсмена с контактами, группами и платежами.',
    points: ['Статусы лидов', 'Пробные занятия', 'История по ученику'],
  },
  {
    id: 'schedule',
    title: 'Расписание без путаницы в чатах',
    text: 'Календарный план связывает группы, тренеров и филиалы. При пересечении с соревнованиями система предлагает замену.',
    points: ['Группы и залы', 'Замена тренера', 'События школы'],
  },
  {
    id: 'finance',
    title: 'Абонементы, оплаты и зарплата в одном месте',
    text: 'Выставляйте абонементы, фиксируйте платежи, смотрите операции и считайте зарплату тренеров по выбранным схемам.',
    points: ['Абонементы', 'Журнал операций', 'Начисление зарплаты'],
  },
] as const;

/** Упрощённый превью-интерфейс кабинета — визуальный якорь героя. */
const ProductPreview: React.FC = () => (
  <Box
    aria-hidden
    sx={{
      width: '100%',
      height: '100%',
      minHeight: { xs: 280, md: 420 },
      bgcolor: colors.card,
      borderRadius: { xs: `${radii.panel}px 0 0 0`, md: `${radii.panel}px 0 0 ${radii.panel}px` },
      boxShadow: '0 24px 80px rgba(13, 75, 215, 0.22)',
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '72px 1fr',
      animation: 'landingFloat 6s ease-in-out infinite',
      '@keyframes landingFloat': {
        '0%, 100%': { transform: 'translateY(0)' },
        '50%': { transform: 'translateY(-8px)' },
      },
    }}
  >
    <Box
      sx={{
        bgcolor: colors.surface,
        borderRight: `1px solid ${colors.divider}`,
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      {[colors.primary, colors.divider, colors.divider, colors.divider].map((c, i) => (
        <Box
          key={i}
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.5,
            bgcolor: c === colors.primary ? colors.primarySoft : colors.rowAlt,
            border: c === colors.primary ? `2px solid ${colors.primary}` : 'none',
          }}
        />
      ))}
    </Box>
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {['Клиенты', 'Группы', 'Оплаты'].map((label, i) => (
          <Box
            key={label}
            sx={{
              flex: 1,
              bgcolor: i === 0 ? colors.primarySoft : colors.surface,
              borderRadius: 1.5,
              px: 1.5,
              py: 1.25,
            }}
          >
            <Typography sx={{ fontSize: 11, color: colors.textHint, fontWeight: 600 }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 800, color: colors.text }}>
              {i === 0 ? '248' : i === 1 ? '18' : '₽142k'}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ flex: 1, bgcolor: colors.surface, borderRadius: 1.5, p: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.text, mb: 1 }}>
          Расписание на сегодня
        </Typography>
        {[
          { time: '10:00', name: 'Дзюдо · младшая', trainer: 'Иванов' },
          { time: '12:30', name: 'Самбо · средний', trainer: 'Петрова' },
          { time: '17:00', name: 'Вольная борьба', trainer: 'Сидоров' },
        ].map((row) => (
          <Box
            key={row.time}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1,
              borderBottom: `1px solid ${colors.divider}`,
              '&:last-child': { borderBottom: 'none' },
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.primary, width: 44 }}>
              {row.time}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.text }} noWrap>
                {row.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: colors.textHint }}>{row.trainer}</Typography>
            </Box>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: colors.success,
                flexShrink: 0,
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const loggedIn = hasAnySession();

  const goPrimary = () => {
    if (loggedIn) {
      const dest = currentSessionDestination();
      navigate(dest || '/dashboard');
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
          position: 'sticky',
          top: 0,
          zIndex: 20,
          bgcolor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${colors.divider}`,
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box
            onClick={() => navigate('/')}
            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <BrandLogo
              size={{ xs: 36, md: 44 }}
              layout="horizontal"
              wordmarkSize={{ xs: 13, md: 15 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 } }}>
            <Button color="inherit" onClick={scrollToFeatures} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              Возможности
            </Button>
            <Button color="inherit" onClick={() => navigate('/pricing')} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              Тарифы
            </Button>
            <Button color="inherit" onClick={() => navigate('/contacts')} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
              Контакты
            </Button>
            {loggedIn ? (
              <Button variant="contained" onClick={goPrimary}>
                В кабинет
              </Button>
            ) : (
              <>
                <Button color="inherit" onClick={() => navigate('/auth')}>
                  Войти
                </Button>
                <Button variant="contained" onClick={() => navigate('/register')}>
                  Регистрация
                </Button>
              </>
            )}
          </Box>
        </Container>
      </Box>

      {/* Герой */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background: `
            radial-gradient(ellipse 80% 60% at 10% 20%, rgba(72, 128, 255, 0.28), transparent 55%),
            radial-gradient(ellipse 70% 50% at 90% 10%, rgba(13, 75, 215, 0.18), transparent 50%),
            linear-gradient(165deg, #E8EEFF 0%, #F5F6FA 42%, #FFFFFF 100%)
          `,
          minHeight: { xs: 'auto', md: 'calc(100vh - 72px)' },
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1.05fr' },
            gap: { xs: 4, md: 5 },
            alignItems: 'center',
            py: { xs: 5, md: 6 },
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              animation: 'landingFadeUp 0.7s cubic-bezier(0.22, 0.61, 0.36, 1) both',
              '@keyframes landingFadeUp': {
                from: { opacity: 0, transform: 'translateY(18px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            <Typography
              component="p"
              sx={{
                fontSize: { xs: 28, sm: 36, md: 44 },
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                mb: 2,
              }}
            >
              <Box component="span" sx={{ color: colors.primary }}>
                ПРОФ
              </Box>
              <Box component="span" sx={{ color: colors.text }}>
                СПОРТСРМ
              </Box>
            </Typography>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 20, sm: 24, md: 28 },
                fontWeight: 700,
                color: colors.text,
                lineHeight: 1.25,
                mb: 1.5,
                maxWidth: 460,
              }}
            >
              CRM для спортивных школ и секций
            </Typography>

            <Typography
              sx={{
                fontSize: typography.field,
                color: colors.textMuted,
                maxWidth: 440,
                mb: 3,
                lineHeight: 1.55,
              }}
            >
              Клиенты, расписание, абонементы, посещаемость, зарплата и чаты — в одном кабинете с изоляцией данных каждой школы.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              <Button
                variant="contained"
                size="large"
                onClick={goPrimary}
                sx={{
                  px: 3,
                  py: 1.25,
                  fontWeight: 700,
                  boxShadow: '0 10px 28px rgba(72, 128, 255, 0.35)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 14px 32px rgba(72, 128, 255, 0.45)',
                  },
                }}
              >
                {loggedIn ? 'Открыть кабинет' : 'Начать работу'}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={scrollToFeatures}
                sx={{ px: 3, py: 1.25, fontWeight: 600 }}
              >
                Смотреть возможности
              </Button>
            </Box>
          </Box>

          <Box
            sx={{
              mr: { md: -4, lg: -8 },
              animation: 'landingFadeIn 0.9s 0.15s cubic-bezier(0.22, 0.61, 0.36, 1) both',
              '@keyframes landingFadeIn': {
                from: { opacity: 0, transform: 'translateX(24px)' },
                to: { opacity: 1, transform: 'translateX(0)' },
              },
            }}
          >
            <ProductPreview />
          </Box>
        </Container>
      </Box>

      {/* Модули */}
      <Box
        id="features"
        component="section"
        sx={{ py: { xs: 6, md: 8 }, bgcolor: colors.white, scrollMarginTop: 80 }}
      >
        <Container maxWidth="lg">
          <Typography
            component="h2"
            sx={{
              fontSize: typography.sectionTitle,
              fontWeight: 800,
              color: colors.text,
              mb: 1,
              maxWidth: 560,
            }}
          >
            Функционал кабинета школы
          </Typography>
          <Typography
            sx={{
              color: colors.textMuted,
              mb: 4,
              maxWidth: 560,
              fontSize: typography.field,
              lineHeight: 1.5,
            }}
          >
            Те же разделы, что в боковом меню ПРОФСПОРТСРМ — от панели управления до финансов и базы знаний.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              columnGap: { xs: 3, md: 4 },
              rowGap: { xs: 3.5, md: 4 },
              borderTop: `1px solid ${colors.divider}`,
              pt: 4,
            }}
          >
            {MODULES.map((item, index) => (
              <Box key={item.title}>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: colors.primary,
                    mb: 0.75,
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 17, color: colors.text, mb: 0.75 }}>
                  {item.title}
                </Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: typography.field, lineHeight: 1.55 }}>
                  {item.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Детальные сценарии */}
      {CAPABILITIES.map((block, index) => (
        <Box
          key={block.id}
          component="section"
          sx={{
            py: { xs: 6, md: 8 },
            bgcolor: index % 2 === 0 ? colors.surface : colors.white,
          }}
        >
          <Container
            maxWidth="lg"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
              gap: { xs: 3, md: 6 },
              alignItems: 'center',
            }}
          >
            <Box sx={{ order: { xs: 1, md: index % 2 === 0 ? 1 : 2 } }}>
              <Typography
                component="h2"
                sx={{
                  fontSize: typography.sectionTitle,
                  fontWeight: 800,
                  color: colors.text,
                  mb: 1.5,
                  maxWidth: 480,
                }}
              >
                {block.title}
              </Typography>
              <Typography
                sx={{
                  color: colors.textMuted,
                  fontSize: typography.field,
                  lineHeight: 1.55,
                  mb: 2.5,
                  maxWidth: 480,
                }}
              >
                {block.text}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.25, color: colors.text }}>
                {block.points.map((point) => (
                  <Typography
                    key={point}
                    component="li"
                    sx={{ fontSize: typography.field, fontWeight: 600, mb: 0.75, lineHeight: 1.4 }}
                  >
                    {point}
                  </Typography>
                ))}
              </Box>
            </Box>

            <Box
              aria-hidden
              sx={{
                order: { xs: 2, md: index % 2 === 0 ? 2 : 1 },
                bgcolor: colors.card,
                border: `1px solid ${colors.divider}`,
                borderRadius: `${radii.panel}px`,
                p: 2.5,
                minHeight: 200,
                backgroundImage: `
                  linear-gradient(135deg, rgba(72,128,255,0.08), transparent 55%),
                  linear-gradient(180deg, ${colors.card}, ${colors.surface})
                `,
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.primary, mb: 2 }}>
                {block.points[0]}
              </Typography>
              {block.points.map((point, i) => (
                <Box
                  key={point}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1.25,
                    borderBottom: i < block.points.length - 1 ? `1px solid ${colors.divider}` : 'none',
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
                    {point}
                  </Typography>
                  <Box
                    sx={{
                      width: 56,
                      height: 8,
                      borderRadius: 99,
                      bgcolor: i === 0 ? colors.primary : colors.primarySoft,
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Container>
        </Box>
      ))}

      {/* Роли */}
      <Box component="section" sx={{ py: { xs: 6, md: 8 }, bgcolor: colors.white }}>
        <Container maxWidth="lg">
          <Typography
            component="h2"
            sx={{
              fontSize: typography.sectionTitle,
              fontWeight: 800,
              color: colors.text,
              mb: 1,
            }}
          >
            Для кого система
          </Typography>
          <Typography
            sx={{
              color: colors.textMuted,
              mb: 4,
              maxWidth: 520,
              fontSize: typography.field,
              lineHeight: 1.5,
            }}
          >
            Разные роли — разный доступ. Данные одной школы не смешиваются с другой.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: { xs: 3, md: 5 },
              borderTop: `1px solid ${colors.divider}`,
              pt: 4,
            }}
          >
            {ROLES.map((role, index) => (
              <Box
                key={role.title}
                sx={{
                  borderLeft: { md: index === 0 ? 'none' : `1px solid ${colors.divider}` },
                  pl: { md: index === 0 ? 0 : 4 },
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.text, mb: 1 }}>
                  {role.title}
                </Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: typography.field, lineHeight: 1.55 }}>
                  {role.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box
        component="section"
        sx={{
          py: { xs: 6, md: 8 },
          background: `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.primary} 100%)`,
          color: colors.white,
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography
            component="h2"
            sx={{ fontSize: typography.sectionTitle, fontWeight: 800, mb: 1.5 }}
          >
            Подключите школу и соберите процессы в одном кабинете
          </Typography>
          <Typography sx={{ opacity: 0.9, mb: 3, fontSize: typography.field, lineHeight: 1.5 }}>
            Зарегистрируйтесь или сравните тарифы — дальше можно сразу вести клиентов, расписание и оплаты.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="contained"
              size="large"
              onClick={goPrimary}
              sx={{
                bgcolor: colors.white,
                color: colors.primaryDark,
                fontWeight: 700,
                px: 3,
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
                borderColor: 'rgba(255,255,255,0.7)',
                color: colors.white,
                fontWeight: 600,
                px: 3,
                '&:hover': {
                  borderColor: colors.white,
                  bgcolor: 'rgba(255,255,255,0.08)',
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
