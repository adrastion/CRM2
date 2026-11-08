import React from 'react';
import { Box, Button, Container, Link as MuiLink, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PublicSiteNav from '../../PublicSiteNav';
import PublicFooter from '../../PublicFooter';
import { colors } from '../../../theme/tokens';
import heroGym from '../../../assets/landing-hero-gym.webp';
import LandingFeedbackForm from '../LandingFeedbackForm';
import { landingPageAnchors } from '../landingNav';
import { sectionScrollSx } from '../LandingShared';

type Props = {
  loggedIn: boolean;
  socials: Array<{ key: string; label: string; url: string }>;
  onPrimary: () => void;
  onLogin: () => void;
};

const SCHOOL = [
  { n: '01', t: 'Клиенты', d: 'Воронка, пробные, карточка спортсмена, родители и история.' },
  { n: '02', t: 'Расписание', d: 'Группы, залы, замены тренеров, соревнования в одном календаре.' },
  { n: '03', t: 'Финансы', d: 'Абонементы, оплаты, журнал и зарплата по схемам школы.' },
  { n: '04', t: 'Команда', d: 'Роли, филиалы, чаты и задачи без потери контекста.' },
];

const CLIENT = [
  { t: 'Неделя занятий', d: 'Ближайшие тренировки и напоминания.' },
  { t: 'Абонемент', d: 'Статус, оплаты и документы без звонков в админку.' },
  { t: 'Семья', d: 'Родитель видит то же, что нужно ребёнку.' },
];

/** Ledger — журнальная композиция в фирменной палитре. */
const LandingLedger: React.FC<Props> = ({ loggedIn, socials, onPrimary, onLogin }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.white, color: colors.text, fontFamily: '"Montserrat", sans-serif' }}>
      <PublicSiteNav variant="solid" landingAnchors={landingPageAnchors()} />

      <Box component="section" sx={{ borderBottom: `1px solid ${colors.divider}`, pt: { xs: 2, md: 3 }, pb: { xs: 5, md: 7 } }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' },
              gap: { xs: 4, md: 5 },
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: colors.primary,
                  mb: 2,
                }}
              >
                Спортивные секции · одна платформа
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: 42, sm: 64, md: 78 },
                  fontWeight: 900,
                  lineHeight: 0.9,
                  letterSpacing: '-0.045em',
                  mb: 2.5,
                }}
              >
                ПРОФ
                <br />
                СПОРТ
                <br />
                <Box component="span" sx={{ color: colors.primary }}>
                  СРМ
                </Box>
              </Typography>
              <Box sx={{ width: 72, height: 3, bgcolor: colors.primary, mb: 2.5, borderRadius: 1 }} />
              <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: colors.textMuted, maxWidth: 440, mb: 3, lineHeight: 1.55 }}>
                Рабочий кабинет школы и личный кабинет ученика — без хаоса чатов и таблиц. Нам важно,
                что нужно именно вашей секции.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 2 }}>
                <Button variant="contained" onClick={onPrimary} sx={{ px: 3, py: 1.35, fontWeight: 800, textTransform: 'none' }}>
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
                      sx={{ color: colors.primary, fontWeight: 700, fontSize: 13 }}
                    >
                      {s.label}
                    </MuiLink>
                  ))}
                </Box>
              )}
            </Box>

            <Box
              sx={{
                border: `1px solid ${colors.divider}`,
                overflow: 'hidden',
                borderRadius: 2,
                minHeight: { xs: 240, md: 360 },
                boxShadow: '0 16px 40px rgba(13,75,215,0.12)',
              }}
            >
              <Box
                component="img"
                src={heroGym}
                alt="Спортивный зал"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: { xs: 240, md: 360 } }}
              />
            </Box>
          </Box>
        </Container>
      </Box>

      <Box id="schools" component="section" sx={{ py: { xs: 5, md: 7 }, borderBottom: `1px solid ${colors.divider}`, ...sectionScrollSx }}>
        <Container maxWidth="lg">
          <Typography sx={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: colors.primary, mb: 1, fontWeight: 700 }}>
            Кабинет школы
          </Typography>
          <Typography sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 900, letterSpacing: '-0.03em', mb: 4 }}>
            Операции секции — по пунктам
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 0 }}>
            {SCHOOL.map((row) => (
              <Box
                key={row.n}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr',
                  gap: 2,
                  p: { xs: 2, md: 2.5 },
                  borderTop: `1px solid ${colors.divider}`,
                  borderRight: { md: `1px solid ${colors.divider}` },
                  '&:nth-of-type(2n)': { borderRight: { md: 'none' } },
                }}
              >
                <Typography sx={{ fontWeight: 900, fontSize: 28, color: colors.primary, lineHeight: 1 }}>{row.n}</Typography>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.75 }}>{row.t}</Typography>
                  <Typography sx={{ color: colors.textMuted, fontSize: 14, lineHeight: 1.5 }}>{row.d}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <Box
        id="clients"
        component="section"
        sx={{
          py: { xs: 5, md: 7 },
          background: `linear-gradient(180deg, ${colors.primaryDark} 0%, ${colors.primary} 100%)`,
          color: colors.white,
          ...sectionScrollSx,
        }}
      >
        <Container maxWidth="lg">
          <Typography sx={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: colors.primarySoft, mb: 1, fontWeight: 700 }}>
            Кабинет ученика
          </Typography>
          <Typography sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 900, letterSpacing: '-0.03em', mb: 3.5 }}>
            Семья видит суть, не переписку
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {CLIENT.map((c) => (
              <Box key={c.t} sx={{ borderTop: `3px solid ${colors.primarySoft}`, pt: 2 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 1 }}>{c.t}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.5 }}>{c.d}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 5, md: 7 }, bgcolor: colors.surface, ...sectionScrollSx }}>
        <Container maxWidth="sm">
          <LandingFeedbackForm />
        </Container>
      </Box>

      <Box component="section" sx={{ py: 5, textAlign: 'center' }}>
        <Container maxWidth="sm">
          <Typography sx={{ fontWeight: 900, fontSize: 22, mb: 2 }}>Готовы подключить школу?</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={onPrimary} sx={{ fontWeight: 800, textTransform: 'none', px: 3 }}>
              {loggedIn ? 'В кабинет' : 'Регистрация'}
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

export default LandingLedger;
