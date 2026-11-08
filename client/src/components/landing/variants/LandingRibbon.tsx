import React from 'react';
import { Box, Button, Container, Link as MuiLink, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PublicSiteNav from '../../PublicSiteNav';
import PublicFooter from '../../PublicFooter';
import { colors, radii } from '../../../theme/tokens';
import shotDashboard from '../../../assets/landing-shot-dashboard.webp';
import shotSchedule from '../../../assets/landing-shot-schedule.webp';
import LandingFeedbackForm from '../LandingFeedbackForm';
import { landingPageAnchors } from '../landingNav';
import { sectionScrollSx } from '../LandingShared';

type Props = {
  loggedIn: boolean;
  socials: Array<{ key: string; label: string; url: string }>;
  onPrimary: () => void;
  onLogin: () => void;
};

const RIBBONS: Array<{
  title: string;
  text: string;
  shot?: string;
  imageFirst?: boolean;
}> = [
  {
    title: 'Клиенты и воронка',
    text: 'От лида до постоянного ученика: статусы, пробные, карточка, родители.',
  },
  {
    title: 'Расписание без чатов',
    text: 'Группы, залы, замены и соревнования — календарь, который видит вся команда.',
    shot: shotSchedule,
    imageFirst: true,
  },
  {
    title: 'Финансы секции',
    text: 'Абонементы, оплаты, журнал операций и зарплата тренеров в одном контуре.',
  },
];

/** Ribbon — горизонтальные ленты секций. */
const LandingRibbon: React.FC<Props> = ({ loggedIn, socials, onPrimary, onLogin }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.white, fontFamily: '"Montserrat", sans-serif' }}>
      <PublicSiteNav variant="solid" landingAnchors={landingPageAnchors()} />

      <Box
        sx={{
          background: `linear-gradient(105deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
          color: colors.white,
          py: { xs: 5, md: 7 },
        }}
      >
        <Container maxWidth="lg">
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.9, mb: 1.5 }}>
            ПРОФСПОРТСРМ
          </Typography>
          <Typography
            component="h1"
            sx={{ fontSize: { xs: 32, md: 48 }, fontWeight: 900, letterSpacing: '-0.03em', maxWidth: 640, mb: 2, lineHeight: 1.1 }}
          >
            Лента работы спортивной секции — от школы до семьи
          </Typography>
          <Typography sx={{ fontSize: 16, opacity: 0.92, maxWidth: 520, mb: 3, lineHeight: 1.55 }}>
            Кабинет школы и кабинет ученика в фирменной системе. Нам важно ваше мнение о том, что
            добавить дальше.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            <Button
              onClick={onPrimary}
              sx={{
                bgcolor: colors.white,
                color: colors.primaryDark,
                fontWeight: 800,
                textTransform: 'none',
                px: 3,
                '&:hover': { bgcolor: colors.primarySoft },
              }}
            >
              {loggedIn ? 'В кабинет' : 'Подключить школу'}
            </Button>
            <Button
              onClick={onLogin}
              sx={{
                color: colors.white,
                border: '1px solid rgba(255,255,255,0.55)',
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                '&:hover': { borderColor: colors.white, bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              Войти
            </Button>
          </Box>
          {socials.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2.5 }}>
              {socials.map((s) => (
                <MuiLink key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" sx={{ color: colors.primarySoft, fontWeight: 700 }}>
                  {s.label}
                </MuiLink>
              ))}
            </Box>
          )}
        </Container>
      </Box>

      <Box id="schools" sx={sectionScrollSx}>
        {RIBBONS.map((r, i) => (
          <Box
            key={r.title}
            sx={{
              py: { xs: 4, md: 5 },
              bgcolor: i % 2 === 0 ? colors.surface : colors.white,
              borderBottom: `1px solid ${colors.divider}`,
            }}
          >
            <Container maxWidth="lg">
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: r.shot ? '1fr 1fr' : '1fr' },
                  gap: 3,
                  alignItems: 'center',
                }}
              >
                <Box sx={{ order: { xs: 1, md: r.imageFirst ? 2 : 1 } }}>
                  <Typography sx={{ color: colors.primary, fontWeight: 800, fontSize: 13, mb: 1 }}>
                    ЛК школы · {String(i + 1).padStart(2, '0')}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, mb: 1 }}>{r.title}</Typography>
                  <Typography sx={{ color: colors.textMuted, maxWidth: 480, lineHeight: 1.55 }}>{r.text}</Typography>
                </Box>
                {r.shot && (
                  <Box
                    component="img"
                    src={r.shot}
                    alt=""
                    sx={{
                      order: { xs: 2, md: r.imageFirst ? 1 : 2 },
                      width: '100%',
                      borderRadius: `${radii.panel}px`,
                      border: `1px solid ${colors.divider}`,
                      boxShadow: '0 12px 32px rgba(13,75,215,0.12)',
                    }}
                  />
                )}
              </Box>
            </Container>
          </Box>
        ))}
      </Box>

      <Box id="clients" sx={{ py: { xs: 5, md: 6 }, bgcolor: colors.white, ...sectionScrollSx }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' }, gap: 3, alignItems: 'center' }}>
            <Box>
              <Typography sx={{ color: colors.primary, fontWeight: 800, fontSize: 13, mb: 1 }}>ЛК ученика</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, mb: 1.5 }}>
                Неделя, оплаты и документы — для семьи
              </Typography>
              <Typography sx={{ color: colors.textMuted, mb: 2, lineHeight: 1.55 }}>
                Ученик и родитель видят занятия, абонемент и уведомления без звонков в администрацию.
              </Typography>
              <Button variant="contained" onClick={onLogin} sx={{ fontWeight: 700, textTransform: 'none' }}>
                Войти в кабинет ученика
              </Button>
            </Box>
            <Box
              component="img"
              src={shotDashboard}
              alt=""
              sx={{
                width: '100%',
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
                boxShadow: '0 12px 32px rgba(13,75,215,0.12)',
              }}
            />
          </Box>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 5, md: 6 }, bgcolor: colors.surface, ...sectionScrollSx }}>
        <Container maxWidth="sm">
          <LandingFeedbackForm />
        </Container>
      </Box>

      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Button variant="contained" onClick={onPrimary} sx={{ fontWeight: 800, textTransform: 'none', mr: 1 }}>
          {loggedIn ? 'В кабинет' : 'Регистрация'}
        </Button>
        <Button variant="outlined" onClick={() => navigate('/pricing')} sx={{ fontWeight: 700, textTransform: 'none' }}>
          Тарифы
        </Button>
      </Box>

      <PublicFooter />
    </Box>
  );
};

export default LandingRibbon;
