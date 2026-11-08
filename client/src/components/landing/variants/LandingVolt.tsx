import React from 'react';
import { Box, Button, Container, Link as MuiLink, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PublicSiteNav from '../../PublicSiteNav';
import PublicFooter from '../../PublicFooter';
import { colors, radii } from '../../../theme/tokens';
import LandingFeedbackForm from '../LandingFeedbackForm';
import { landingPageAnchors } from '../landingNav';
import { sectionScrollSx } from '../LandingShared';

type Props = {
  loggedIn: boolean;
  socials: Array<{ key: string; label: string; url: string }>;
  onPrimary: () => void;
  onLogin: () => void;
};

const SCHOOL_GRID = [
  { k: 'CRM', t: 'Клиенты', d: 'Лид → пробное → постоянный. Карточка, родители, платежи.' },
  { k: 'CAL', t: 'Календарь', d: 'Группы, залы, замены, соревнования без чат-спама.' },
  { k: 'FIN', t: 'Деньги', d: 'Абонементы, оплаты, журнал, зарплата тренеров.' },
  { k: 'OPS', t: 'Команда', d: 'Роли, филиалы, чаты, задачи, уведомления.' },
  { k: 'ATH', t: 'Спорт', d: 'Нормативы, планы циклов, документы учеников.' },
  { k: 'SIG', t: 'Сигналы', d: 'Новости школы и уведомления туда, где работают люди.' },
];

const CLIENT_GRID = [
  { t: 'Панель недели', d: 'Что тренируем, куда ехать, что скоро закончится.' },
  { t: 'Оплаты', d: 'Абонемент и история — прозрачно для родителя.' },
  { t: 'Документы', d: 'Нужные бумаги рядом, не в переписке.' },
  { t: 'Связь', d: 'Уведомления от школы без потери в мессенджерах.' },
];

/** Volt — модульная сетка в фирменной палитре. */
const LandingVolt: React.FC<Props> = ({ loggedIn, socials, onPrimary, onLogin }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.surface, color: colors.text, fontFamily: '"Montserrat", sans-serif' }}>
      <PublicSiteNav variant="solid" landingAnchors={landingPageAnchors()} />

      <Box
        component="section"
        sx={{
          pt: { xs: 4, md: 6 },
          pb: { xs: 6, md: 8 },
          background: `
            radial-gradient(ellipse 80% 60% at 20% 0%, rgba(47, 107, 255, 0.16) 0%, transparent 55%),
            linear-gradient(180deg, ${colors.white} 0%, ${colors.surface} 100%)
          `,
          borderBottom: `1px solid ${colors.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            sx={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: colors.primaryDark,
              bgcolor: colors.primarySoft,
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              mb: 3,
            }}
          >
            Модули для спортивных секций
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 40, sm: 56, md: 68 },
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 0.95,
              mb: 2,
              maxWidth: 780,
            }}
          >
            ПРОФ
            <Box component="span" sx={{ color: colors.primary }}>
              СПОРТСРМ
            </Box>
          </Typography>
          <Box sx={{ width: '100%', maxWidth: 360, height: 4, bgcolor: colors.primary, borderRadius: 2, mb: 2.5 }} />
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: colors.textMuted, maxWidth: 560, mb: 3.5, lineHeight: 1.55 }}>
            Кабинет школы и кабинет ученика в одной системе. Скажите, чего не хватает — мы слушаем
            секции.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 2.5 }}>
            <Button variant="contained" onClick={onPrimary} sx={{ px: 3.25, py: 1.35, fontWeight: 800, textTransform: 'none' }}>
              {loggedIn ? 'В кабинет' : 'Подключить школу'}
            </Button>
            <Button variant="outlined" onClick={onLogin} sx={{ px: 3, py: 1.35, fontWeight: 700, textTransform: 'none' }}>
              Войти
            </Button>
          </Box>
          {socials.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {socials.map((s) => (
                <MuiLink
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{ color: colors.primary, fontWeight: 700, fontSize: 14 }}
                >
                  {s.label}
                </MuiLink>
              ))}
            </Box>
          )}
        </Container>
      </Box>

      <Box id="schools" component="section" sx={{ py: { xs: 5, md: 7 }, ...sectionScrollSx }}>
        <Container maxWidth="lg">
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, mb: 1 }}>Кабинет школы</Typography>
          <Typography sx={{ color: colors.textMuted, mb: 3, maxWidth: 480 }}>
            Модули рабочего дня секции — в одной оболочке.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: 1.5,
            }}
          >
            {SCHOOL_GRID.map((item) => (
              <Box
                key={item.k}
                sx={{
                  bgcolor: colors.white,
                  border: `1px solid ${colors.divider}`,
                  borderRadius: `${radii.panel}px`,
                  p: 2.25,
                  boxShadow: '0 8px 24px rgba(13, 75, 215, 0.06)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 28px rgba(13, 75, 215, 0.12)',
                  },
                }}
              >
                <Typography sx={{ color: colors.primary, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', mb: 1 }}>
                  {item.k}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 0.75 }}>{item.t}</Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 1.45 }}>{item.d}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <Box
        id="clients"
        component="section"
        sx={{ py: { xs: 5, md: 7 }, bgcolor: colors.white, borderTop: `1px solid ${colors.divider}`, ...sectionScrollSx }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.9fr 1.1fr' }, gap: 3 }}>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, mb: 1 }}>Кабинет ученика</Typography>
              <Typography sx={{ color: colors.textMuted, mb: 2, lineHeight: 1.5 }}>
                Родитель и спортсмен получают ясный контур — школа меньше отвечает на одни и те же
                вопросы.
              </Typography>
              <Button variant="outlined" onClick={onLogin} sx={{ fontWeight: 700, textTransform: 'none' }}>
                Войти в ЛК
              </Button>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              {CLIENT_GRID.map((c) => (
                <Box
                  key={c.t}
                  sx={{
                    borderLeft: `3px solid ${colors.primary}`,
                    pl: 1.75,
                    py: 0.75,
                    bgcolor: colors.surface,
                    borderRadius: `0 ${radii.cell}px ${radii.cell}px 0`,
                    pr: 1.5,
                  }}
                >
                  <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{c.t}</Typography>
                  <Typography sx={{ color: colors.textMuted, fontSize: 13.5 }}>{c.d}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 5, md: 7 }, bgcolor: colors.surface, ...sectionScrollSx }}>
        <Container maxWidth="sm">
          <LandingFeedbackForm />
        </Container>
      </Box>

      <Box component="section" sx={{ py: 5, textAlign: 'center', bgcolor: colors.white }}>
        <Container maxWidth="sm">
          <Typography sx={{ fontWeight: 900, fontSize: 22, mb: 2 }}>Готовы начать?</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={onPrimary} sx={{ fontWeight: 800, textTransform: 'none', px: 3 }}>
              {loggedIn ? 'Кабинет' : 'Регистрация'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/pricing')} sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
              Тарифы
            </Button>
          </Box>
        </Container>
      </Box>

      <PublicFooter />
    </Box>
  );
};

export default LandingVolt;
