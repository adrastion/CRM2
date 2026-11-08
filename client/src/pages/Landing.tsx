import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PublicSiteNav from '../components/PublicSiteNav';
import PublicFooter from '../components/PublicFooter';
import { colors } from '../theme/tokens';
import { currentSessionDestination, hasAnySession } from '../utils/authSession';
import { usePublicSiteConfig } from '../hooks/usePublicSiteConfig';
import {
  HERO,
  normalizeLandingVariant,
  type LandingVariant,
} from '../content/landingContent';
import shotDashboard from '../assets/landing-shot-dashboard.webp';
import shotClients from '../assets/landing-shot-clients.webp';
import heroGym from '../assets/landing-hero-gym.webp';
import {
  fadeUp,
  LandingCtaSection,
  LandingFeatureSections,
  LandingFeedbackSection,
  LandingPathRolesSection,
  scrollToId,
  ShotFrame,
  SocialRow,
} from '../components/landing/LandingShared';
import { landingPageAnchors } from '../components/landing/landingNav';
import LandingLedger from '../components/landing/variants/LandingLedger';
import LandingVolt from '../components/landing/variants/LandingVolt';
import LandingRibbon from '../components/landing/variants/LandingRibbon';
import LandingAtlas from '../components/landing/variants/LandingAtlas';

type HeroProps = {
  variant: LandingVariant;
  loggedIn: boolean;
  socials: Array<{ key: string; label: string; url: string }>;
  onPrimary: () => void;
  onLogin: () => void;
};

const ArenaHero: React.FC<HeroProps> = ({ loggedIn, socials, onPrimary, onLogin }) => (
  <Box
    component="section"
    sx={{
      position: 'relative',
      minHeight: { xs: 'auto', md: '92vh' },
      overflow: 'hidden',
      background: `
        radial-gradient(ellipse 80% 60% at 70% 20%, rgba(47, 107, 255, 0.18) 0%, transparent 55%),
        linear-gradient(165deg, #F4F7FF 0%, #FFFFFF 45%, #EEF3FF 100%)
      `,
      pt: { xs: 12, md: 14 },
      pb: { xs: 6, md: 8 },
    }}
  >
    <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, ...fadeUp }}>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 4, md: 6 },
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography
            component="p"
            sx={{
              fontSize: { xs: 34, sm: 48, md: 56 },
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 0.98,
              mb: 2,
              color: colors.text,
            }}
          >
            <Box component="span" sx={{ color: colors.primary }}>
              ПРОФ
            </Box>
            СПОРТСРМ
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 20, sm: 24, md: 28 },
              fontWeight: 700,
              color: colors.text,
              lineHeight: 1.25,
              mb: 1.5,
              maxWidth: 480,
            }}
          >
            {HERO.title}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: 15, md: 16 },
              color: colors.textMuted,
              maxWidth: 440,
              mb: 3,
              lineHeight: 1.55,
            }}
          >
            {HERO.subtitle}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="contained"
              size="large"
              onClick={onPrimary}
              sx={{
                px: 3.5,
                py: 1.35,
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: '0 12px 32px rgba(47, 107, 255, 0.35)',
              }}
            >
              {loggedIn ? 'В кабинет' : 'Подключить школу'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={onLogin}
              sx={{ px: 3, py: 1.35, fontWeight: 700, textTransform: 'none' }}
            >
              Войти
            </Button>
          </Box>
          <SocialRow socials={socials} />
        </Box>
        <Box sx={{ position: 'relative', minHeight: { xs: 220, md: 380 } }}>
          <Box sx={{ width: { xs: '88%', md: '92%' }, ml: 'auto', mr: { xs: 'auto', md: 0 } }}>
            <ShotFrame src={shotDashboard} alt="Кабинет ПРОФСПОРТСРМ" float />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              left: { xs: 0, md: -24 },
              bottom: { xs: -28, md: 24 },
              width: { xs: '58%', md: '48%' },
              display: { xs: 'none', sm: 'block' },
            }}
          >
            <ShotFrame src={shotClients} alt="Клиенты" float />
          </Box>
        </Box>
      </Box>
    </Container>
  </Box>
);

const MotionHero: React.FC<HeroProps> = ({ loggedIn, socials, onPrimary, onLogin }) => (
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
          linear-gradient(90deg, rgba(8, 24, 64, 0.9) 0%, rgba(8, 24, 64, 0.55) 48%, rgba(8, 24, 64, 0.2) 75%, transparent 100%),
          linear-gradient(0deg, rgba(8, 24, 64, 0.78) 0%, transparent 48%)
        `,
      }}
    />
    <Container
      maxWidth="lg"
      sx={{ position: 'relative', zIndex: 1, pb: { xs: 7, md: 10 }, pt: { xs: 14, md: 18 }, ...fadeUp }}
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
        {HERO.title}
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
        {HERO.subtitle}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <Button
          variant="contained"
          size="large"
          onClick={onPrimary}
          sx={{
            px: 3.5,
            py: 1.4,
            fontWeight: 800,
            fontSize: 15,
            textTransform: 'none',
            bgcolor: colors.primary,
            boxShadow: '0 12px 32px rgba(72, 128, 255, 0.45)',
          }}
        >
          {loggedIn ? 'В кабинет' : 'Подключить школу'}
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={onLogin}
          sx={{
            px: 3,
            py: 1.35,
            fontWeight: 700,
            textTransform: 'none',
            color: colors.white,
            borderColor: 'rgba(255,255,255,0.55)',
            '&:hover': { borderColor: colors.white, bgcolor: 'rgba(255,255,255,0.08)' },
          }}
        >
          Войти
        </Button>
      </Box>
      <SocialRow socials={socials} light />
    </Container>
  </Box>
);

const EditorialHero: React.FC<HeroProps> = ({ loggedIn, socials, onPrimary, onLogin }) => (
  <Box
    component="section"
    sx={{
      pt: { xs: 14, md: 18 },
      pb: { xs: 8, md: 12 },
      background: `
        linear-gradient(180deg, #F7F9FF 0%, #FFFFFF 55%, #F3F6FC 100%)
      `,
    }}
  >
    <Container maxWidth="md" sx={{ textAlign: 'center', ...fadeUp }}>
      <Typography
        component="p"
        sx={{
          fontSize: { xs: 40, sm: 56, md: 72 },
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 0.95,
          mb: 3,
          color: colors.text,
        }}
      >
        <Box component="span" sx={{ color: colors.primary }}>
          ПРОФ
        </Box>
        СПОРТСРМ
      </Typography>
      <Typography
        component="h1"
        sx={{
          fontSize: { xs: 22, sm: 28, md: 34 },
          fontWeight: 600,
          color: colors.text,
          lineHeight: 1.25,
          mb: 2,
          maxWidth: 640,
          mx: 'auto',
        }}
      >
        {HERO.title}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: 16, md: 18 },
          color: colors.textMuted,
          maxWidth: 520,
          mx: 'auto',
          mb: 4,
          lineHeight: 1.6,
        }}
      >
        {HERO.subtitle}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Button
          variant="contained"
          size="large"
          onClick={onPrimary}
          sx={{ px: 4, py: 1.4, fontWeight: 800, textTransform: 'none' }}
        >
          {loggedIn ? 'В кабинет' : 'Подключить школу'}
        </Button>
        <Button
          variant="text"
          size="large"
          onClick={onLogin}
          sx={{ px: 2, py: 1.35, fontWeight: 700, textTransform: 'none', color: colors.text }}
        >
          Войти
        </Button>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <SocialRow socials={socials} />
      </Box>
      <Box sx={{ mt: { xs: 5, md: 7 }, maxWidth: 720, mx: 'auto' }}>
        <ShotFrame src={shotDashboard} alt="Кабинет ПРОФСПОРТСРМ" />
      </Box>
    </Container>
  </Box>
);

/** Pulse Split — два пути в первом экране + скрины обоих кабинетов. */
const PulseHero: React.FC<HeroProps> = ({ loggedIn, socials, onPrimary, onLogin }) => (
  <Box
    component="section"
    sx={{
      pt: { xs: 12, md: 14 },
      pb: { xs: 5, md: 7 },
      background: `
        radial-gradient(ellipse 70% 50% at 50% 0%, rgba(47, 107, 255, 0.14) 0%, transparent 60%),
        linear-gradient(180deg, #F4F7FF 0%, #FFFFFF 100%)
      `,
    }}
  >
    <Container maxWidth="lg" sx={{ ...fadeUp }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 3.5, md: 4.5 } }}>
        <Typography
          component="p"
          sx={{
            fontSize: { xs: 34, sm: 48, md: 56 },
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 0.98,
            mb: 2,
            color: colors.text,
          }}
        >
          <Box component="span" sx={{ color: colors.primary }}>
            ПРОФ
          </Box>
          СПОРТСРМ
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 20, sm: 24, md: 28 },
            fontWeight: 700,
            color: colors.text,
            lineHeight: 1.25,
            mb: 1.5,
            maxWidth: 560,
            mx: 'auto',
          }}
        >
          {HERO.title}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: 15, md: 16 },
            color: colors.textMuted,
            maxWidth: 500,
            mx: 'auto',
            mb: 2.5,
            lineHeight: 1.55,
          }}
        >
          {HERO.subtitle}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1 }}>
          <Button
            variant="contained"
            size="large"
            onClick={onPrimary}
            sx={{ px: 3.5, py: 1.3, fontWeight: 800, textTransform: 'none' }}
          >
            {loggedIn ? 'В кабинет' : 'Подключить школу'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={onLogin}
            sx={{ px: 3, py: 1.3, fontWeight: 700, textTransform: 'none' }}
          >
            Войти
          </Button>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <SocialRow socials={socials} />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            p: 2,
            borderRadius: 3,
            border: `1px solid ${colors.divider}`,
            bgcolor: colors.white,
            boxShadow: '0 16px 40px rgba(13, 75, 215, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Typography fontWeight={800} sx={{ fontSize: 18 }}>
            Кабинет школы
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Клиенты, расписание, финансы и чаты — рабочий день без Excel и мессенджер-хаоса.
          </Typography>
          <ShotFrame src={shotDashboard} alt="Кабинет школы" />
          <Button
            variant="contained"
            onClick={onPrimary}
            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
          >
            {loggedIn ? 'Открыть кабинет' : 'Для школы'}
          </Button>
        </Box>
        <Box
          sx={{
            p: 2,
            borderRadius: 3,
            border: `1px solid ${colors.divider}`,
            bgcolor: colors.white,
            boxShadow: '0 16px 40px rgba(13, 75, 215, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Typography fontWeight={800} sx={{ fontSize: 18 }}>
            Кабинет ученика
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Занятия, абонементы и документы для ученика и родителя — всё в одном входе.
          </Typography>
          <ShotFrame src={shotClients} alt="Кабинет ученика" />
          <Button
            variant="outlined"
            onClick={() => scrollToId('clients')}
            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
          >
            Для ученика и родителя
          </Button>
        </Box>
      </Box>
    </Container>
  </Box>
);

/** Публичный лендинг с вариантами (переключатель в SA). */
const Landing: React.FC = () => {
  const navigate = useNavigate();
  const loggedIn = hasAnySession();
  const { config } = usePublicSiteConfig();
  const socials = config?.socialLinks || [];
  const variant = normalizeLandingVariant(config?.landingVariant);

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

  const heroProps: HeroProps = {
    variant,
    loggedIn,
    socials,
    onPrimary: goSchoolPrimary,
    onLogin: goLogin,
  };

  // Отдельные композиции (фирменная палитра).
  if (variant === 'ledger') {
    return (
      <LandingLedger
        loggedIn={loggedIn}
        socials={socials}
        onPrimary={goSchoolPrimary}
        onLogin={goLogin}
      />
    );
  }
  if (variant === 'volt') {
    return (
      <LandingVolt
        loggedIn={loggedIn}
        socials={socials}
        onPrimary={goSchoolPrimary}
        onLogin={goLogin}
      />
    );
  }
  if (variant === 'ribbon') {
    return (
      <LandingRibbon
        loggedIn={loggedIn}
        socials={socials}
        onPrimary={goSchoolPrimary}
        onLogin={goLogin}
      />
    );
  }
  if (variant === 'atlas') {
    return (
      <LandingAtlas
        loggedIn={loggedIn}
        socials={socials}
        onPrimary={goSchoolPrimary}
        onLogin={goLogin}
      />
    );
  }

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
      <PublicSiteNav variant="overlay" landingAnchors={landingPageAnchors()} />

      {variant === 'motion' && <MotionHero {...heroProps} />}
      {variant === 'editorial' && <EditorialHero {...heroProps} />}
      {variant === 'pulse' && <PulseHero {...heroProps} />}
      {variant === 'arena' && <ArenaHero {...heroProps} />}

      <LandingPathRolesSection
        loggedIn={loggedIn}
        onSchool={goSchoolPrimary}
        rolesOnly={variant === 'pulse'}
      />
      <LandingFeatureSections tone={variant === 'editorial' || variant === 'pulse' ? 'soft' : 'light'} />
      <LandingFeedbackSection />
      <LandingCtaSection loggedIn={loggedIn} onPrimary={goSchoolPrimary} />
      <PublicFooter />
    </Box>
  );
};

export default Landing;
