import React from 'react';
import { Box, Button, Container, Link as MuiLink, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { colors, radii } from '../../theme/tokens';
import {
  CLIENT_FEATURES,
  PATHS,
  ROLES,
  SCHOOL_FEATURES,
  type FeatureBlock,
} from '../../content/landingContent';
import LandingFeedbackForm from './LandingFeedbackForm';

/** Отступ под sticky-шапку при якорях. */
export const sectionScrollSx = {
  scrollMarginTop: { xs: 72, md: 88 },
} as const;

export const fadeUp = {
  animation: 'landingFadeUp 0.75s cubic-bezier(0.22, 0.61, 0.36, 1) both',
  '@keyframes landingFadeUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
};

export const ShotFrame: React.FC<{ src: string; alt: string; float?: boolean }> = ({
  src,
  alt,
  float,
}) => (
  <Box
    sx={{
      borderRadius: `${radii.panel}px`,
      overflow: 'hidden',
      boxShadow: '0 20px 50px rgba(13, 75, 215, 0.18)',
      border: `1px solid ${colors.divider}`,
      bgcolor: colors.card,
      ...(float
        ? {
            animation: 'landingFloat 7s ease-in-out infinite',
            '@keyframes landingFloat': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-8px)' },
            },
          }
        : {}),
    }}
  >
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      sx={{ display: 'block', width: '100%', height: 'auto' }}
    />
  </Box>
);

export const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

type Tone = 'light' | 'soft' | 'white';

const sectionBg: Record<Tone, string> = {
  light: colors.white,
  soft: `linear-gradient(180deg, #EEF3FF 0%, ${colors.white} 100%)`,
  white: colors.white,
};

function FeatureGrid({
  items,
  withShots,
}: {
  items: FeatureBlock[];
  withShots?: boolean;
}) {
  if (withShots) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 5, md: 7 } }}>
        {items.map((f, idx) => (
          <Box
            key={f.id}
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', md: f.shot ? '1fr 1fr' : '1fr' },
              alignItems: 'center',
            }}
          >
            <Box sx={{ order: { xs: 1, md: idx % 2 === 1 && f.shot ? 2 : 1 } }}>
              <Typography fontWeight={800} sx={{ fontSize: { xs: 20, md: 24 }, mb: 1 }}>
                {f.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2, lineHeight: 1.55 }}>
                {f.text}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {f.points.map((p) => (
                  <Box
                    key={p}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 999,
                      bgcolor: colors.primarySoft,
                      color: colors.primaryDark,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {p}
                  </Box>
                ))}
              </Box>
            </Box>
            {f.shot && (
              <Box sx={{ order: { xs: 2, md: idx % 2 === 1 ? 1 : 2 } }}>
                <ShotFrame src={f.shot} alt={f.alt || f.title} />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
      }}
    >
      {items.map((f) => (
        <Box
          key={f.id}
          sx={{
            p: 2.5,
            borderRadius: `${radii.panel}px`,
            border: `1px solid ${colors.divider}`,
            bgcolor: colors.white,
          }}
        >
          <Typography fontWeight={800} sx={{ mb: 1, fontSize: 18 }}>
            {f.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5, fontSize: 14 }}>
            {f.text}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {f.points.map((p) => (
              <Box
                key={p}
                sx={{
                  px: 1,
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
      ))}
    </Box>
  );
}

/** Выбор пути + роли — заполняет «дыру» между hero и фичами. */
export const LandingPathRolesSection: React.FC<{
  loggedIn: boolean;
  onSchool: () => void;
  /** Только роли (если пути уже в hero). */
  rolesOnly?: boolean;
}> = ({ loggedIn, onSchool, rolesOnly }) => (
  <Box
    component="section"
    sx={{
      py: { xs: rolesOnly ? 4 : 5, md: rolesOnly ? 5 : 7 },
      bgcolor: colors.white,
      borderTop: `1px solid ${colors.divider}`,
      ...sectionScrollSx,
    }}
  >
    <Container maxWidth="lg">
      {!rolesOnly && (
        <>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: 22, md: 28 },
              mb: 1,
              textAlign: 'center',
              color: colors.text,
            }}
          >
            Выберите свой путь
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ mb: 3.5, textAlign: 'center', maxWidth: 480, mx: 'auto' }}
          >
            Два кабинета в одной платформе — для команды школы и для семьи ученика.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              mb: { xs: 4, md: 5 },
            }}
          >
            {PATHS.map((p) => (
              <Box
                key={p.id}
                sx={{
                  p: { xs: 2.25, md: 3 },
                  borderRadius: `${radii.panel}px`,
                  border: `1px solid ${colors.divider}`,
                  background:
                    p.id === 'school'
                      ? `linear-gradient(160deg, ${colors.white} 0%, #EEF3FF 100%)`
                      : colors.white,
                  boxShadow: '0 10px 30px rgba(13, 75, 215, 0.06)',
                }}
              >
                <Typography fontWeight={800} sx={{ fontSize: { xs: 18, md: 20 }, mb: 1 }}>
                  {p.title}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2, lineHeight: 1.5, fontSize: 14 }}>
                  {p.text}
                </Typography>
                <Button
                  variant={p.id === 'school' ? 'contained' : 'outlined'}
                  onClick={() => {
                    if (p.id === 'school') onSchool();
                    else scrollToId(p.anchor);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {p.id === 'school' && loggedIn ? 'В кабинет' : p.cta}
                </Button>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: 18, md: 22 },
          mb: 2,
          textAlign: 'center',
          color: colors.text,
        }}
      >
        Для каждой роли — свой удобный вход
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
        }}
      >
        {ROLES.map((r) => (
          <Box
            key={r.title}
            sx={{
              p: 2,
              borderRadius: `${radii.panel}px`,
              bgcolor: colors.surface,
              border: `1px solid ${colors.divider}`,
            }}
          >
            <Typography fontWeight={800} sx={{ mb: 0.75, fontSize: 15 }}>
              {r.title}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13.5, lineHeight: 1.45 }}>
              {r.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </Container>
  </Box>
);

export const LandingFeatureSections: React.FC<{ tone?: Tone }> = ({ tone = 'light' }) => (
  <>
    <Box
      id="schools"
      component="section"
      sx={{ py: { xs: 6, md: 9 }, background: sectionBg[tone], ...sectionScrollSx }}
    >
      <Container maxWidth="lg">
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 32 }, mb: 1, color: colors.text }}>
          Личный кабинет школы
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 560 }}>
          Полный рабочий контур для владельца, администратора и тренера: люди, расписание, деньги,
          чаты и спорт без разрозненных таблиц.
        </Typography>
        <FeatureGrid items={SCHOOL_FEATURES} withShots />
      </Container>
    </Box>

    <Box
      id="clients"
      component="section"
      sx={{
        py: { xs: 6, md: 9 },
        background: tone === 'soft' ? colors.white : sectionBg.soft,
        ...sectionScrollSx,
      }}
    >
      <Container maxWidth="lg">
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 32 }, mb: 1, color: colors.text }}>
          Личный кабинет ученика и родителя
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 560 }}>
          Клиент школы видит занятия, оплаты и документы в своём кабинете — школа меньше отвечает на
          одни и те же вопросы в мессенджерах.
        </Typography>
        <FeatureGrid items={CLIENT_FEATURES} />
      </Container>
    </Box>
  </>
);

export const LandingFeedbackSection: React.FC = () => (
  <Box
    component="section"
    sx={{
      py: { xs: 6, md: 8 },
      background: `linear-gradient(180deg, #EEF3FF 0%, ${colors.white} 100%)`,
      ...sectionScrollSx,
    }}
  >
    <Container maxWidth="sm">
      <LandingFeedbackForm />
    </Container>
  </Box>
);

export const LandingCtaSection: React.FC<{
  loggedIn: boolean;
  onPrimary: () => void;
}> = ({ loggedIn, onPrimary }) => {
  const navigate = useNavigate();
  return (
    <Box component="section" sx={{ py: { xs: 5, md: 7 }, bgcolor: colors.white }}>
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Typography fontWeight={800} sx={{ fontSize: { xs: 22, md: 28 }, mb: 1.5 }}>
          Готовы подключить школу?
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Регистрация займёт несколько минут. Тарифы и контакты — всегда под рукой.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            variant="contained"
            size="large"
            onClick={onPrimary}
            sx={{ textTransform: 'none', fontWeight: 800 }}
          >
            {loggedIn ? 'В кабинет' : 'Регистрация'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/pricing')}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Тарифы
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export const SocialRow: React.FC<{
  socials: Array<{ key: string; label: string; url: string }>;
  light?: boolean;
}> = ({ socials, light }) => {
  if (!socials.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 3 }}>
      {socials.map((s) => (
        <MuiLink
          key={s.key}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{
            fontWeight: 700,
            fontSize: 14,
            color: light ? 'rgba(255,255,255,0.92)' : colors.primary,
          }}
        >
          {s.label}
        </MuiLink>
      ))}
    </Box>
  );
};
