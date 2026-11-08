import React from 'react';
import { Box, Button, Container, Link as MuiLink, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PublicSiteNav from '../../PublicSiteNav';
import PublicFooter from '../../PublicFooter';
import { colors, radii } from '../../../theme/tokens';
import shotClients from '../../../assets/landing-shot-clients.webp';
import shotFinance from '../../../assets/landing-shot-finance.webp';
import LandingFeedbackForm from '../LandingFeedbackForm';
import { landingPageAnchors } from '../landingNav';
import { sectionScrollSx } from '../LandingShared';

type Props = {
  loggedIn: boolean;
  socials: Array<{ key: string; label: string; url: string }>;
  onPrimary: () => void;
  onLogin: () => void;
};

const CHAPTERS = [
  {
    id: 'A',
    title: 'Люди секции',
    text: 'Клиенты, родители, тренеры, роли и филиалы — без потери в Excel.',
    points: ['Воронка', 'Карточка ученика', 'Команда'],
  },
  {
    id: 'B',
    title: 'Время и зал',
    text: 'Расписание групп, замены, соревнования и события школы.',
    points: ['Календарь', 'Залы', 'События'],
  },
  {
    id: 'C',
    title: 'Деньги и спорт',
    text: 'Абонементы, оплаты, зарплата, нормативы и документы.',
    points: ['Финансы', 'Планы', 'Документы'],
  },
];

/** Atlas — главы продукта как атлас секции. */
const LandingAtlas: React.FC<Props> = ({ loggedIn, socials, onPrimary, onLogin }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.surface, fontFamily: '"Montserrat", sans-serif' }}>
      <PublicSiteNav variant="solid" landingAnchors={landingPageAnchors()} />

      <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 6 }, pb: { xs: 4, md: 5 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
            alignItems: 'end',
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 36, md: 52 }, letterSpacing: '-0.035em', lineHeight: 0.98, mb: 2 }}>
              ПРОФ
              <Box component="span" sx={{ color: colors.primary }}>
                СПОРТСРМ
              </Box>
            </Typography>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 700, mb: 1.5, maxWidth: 420 }}>
              Атлас кабинетов для спортивной секции
            </Typography>
            <Typography sx={{ color: colors.textMuted, mb: 3, maxWidth: 440, lineHeight: 1.55 }}>
              Глава за главой: школа ведёт операции, ученик и родитель — видят ясный личный кабинет.
              Пишите, чего не хватает на карте.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              <Button variant="contained" onClick={onPrimary} sx={{ fontWeight: 800, textTransform: 'none', px: 3 }}>
                {loggedIn ? 'В кабинет' : 'Подключить школу'}
              </Button>
              <Button variant="outlined" onClick={onLogin} sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
                Войти
              </Button>
            </Box>
            {socials.length > 0 && (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                {socials.map((s) => (
                  <MuiLink key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" sx={{ fontWeight: 700, color: colors.primary }}>
                    {s.label}
                  </MuiLink>
                ))}
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box
              component="img"
              src={shotClients}
              alt=""
              sx={{
                width: '100%',
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
                mt: { md: 4 },
                boxShadow: '0 12px 28px rgba(13,75,215,0.1)',
              }}
            />
            <Box
              component="img"
              src={shotFinance}
              alt=""
              sx={{
                width: '100%',
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
                boxShadow: '0 12px 28px rgba(13,75,215,0.1)',
              }}
            />
          </Box>
        </Box>
      </Container>

      <Container id="schools" maxWidth="lg" sx={{ pb: { xs: 5, md: 7 }, ...sectionScrollSx }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13, color: colors.primary, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 2 }}>
          Кабинет школы · главы
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {CHAPTERS.map((ch) => (
            <Box
              key={ch.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '56px 1fr', md: '72px 1fr' },
                gap: 2,
                alignItems: 'start',
                p: { xs: 2, md: 2.5 },
                bgcolor: colors.white,
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
                boxShadow: '0 8px 24px rgba(13,75,215,0.05)',
              }}
            >
              <Box
                sx={{
                  width: { xs: 48, md: 56 },
                  height: { xs: 48, md: 56 },
                  borderRadius: '50%',
                  bgcolor: colors.primarySoft,
                  color: colors.primaryDark,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 18,
                }}
              >
                {ch.id}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: 20, mb: 0.75 }}>{ch.title}</Typography>
                <Typography sx={{ color: colors.textMuted, mb: 1.25, lineHeight: 1.5 }}>{ch.text}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {ch.points.map((p) => (
                    <Box
                      key={p}
                      sx={{
                        px: 1.1,
                        py: 0.35,
                        borderRadius: 999,
                        bgcolor: colors.primarySoft,
                        color: colors.primaryDark,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {p}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>

      <Box id="clients" sx={{ bgcolor: colors.white, py: { xs: 5, md: 6 }, borderTop: `1px solid ${colors.divider}`, ...sectionScrollSx }}>
        <Container maxWidth="lg">
          <Typography sx={{ fontWeight: 800, fontSize: 13, color: colors.primary, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
            Кабинет ученика
          </Typography>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 24, md: 30 }, mb: 1.5, maxWidth: 520 }}>
            Отдельная глава для семьи
          </Typography>
          <Typography sx={{ color: colors.textMuted, mb: 2.5, maxWidth: 560, lineHeight: 1.55 }}>
            Неделя занятий, абонементы, документы и уведомления — чтобы школа меньше объясняла одно и
            то же в мессенджерах.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5, mb: 2.5 }}>
            {['Расписание недели', 'Платежи и абонемент', 'Родительский доступ'].map((t) => (
              <Box
                key={t}
                sx={{
                  p: 2,
                  borderRadius: `${radii.panel}px`,
                  bgcolor: colors.surface,
                  border: `1px solid ${colors.divider}`,
                  fontWeight: 800,
                }}
              >
                {t}
              </Box>
            ))}
          </Box>
          <Button variant="outlined" onClick={onLogin} sx={{ fontWeight: 700, textTransform: 'none' }}>
            Войти как ученик / родитель
          </Button>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 5, md: 6 }, bgcolor: colors.surface, ...sectionScrollSx }}>
        <Container maxWidth="sm">
          <LandingFeedbackForm title="Дополните карту" subtitle="Какой главы не хватает вашей секции?" />
        </Container>
      </Box>

      <Box sx={{ py: 4, textAlign: 'center', bgcolor: colors.white }}>
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

export default LandingAtlas;
