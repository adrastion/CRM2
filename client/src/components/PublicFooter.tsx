import React from 'react';
import { Box, Typography, Container, Link as MuiLink } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { usePublicSiteConfig } from '../hooks/usePublicSiteConfig';
import { colors } from '../theme/tokens';

const PublicFooter: React.FC = () => {
  const navigate = useNavigate();
  const { config } = usePublicSiteConfig();
  const downloadEnabled = Boolean(config?.download?.tabEnabled);
  const socials = config?.socialLinks || [];

  const linkSx = {
    color: 'text.secondary',
    textDecoration: 'none',
    cursor: 'pointer',
    '&:hover': {
      color: 'primary.main',
      textDecoration: 'underline',
    },
  } as const;

  const go = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };

  const links: Array<{ label: string; path: string }> = [
    { label: 'Главная', path: '/' },
    { label: 'Новости', path: '/news' },
    ...(downloadEnabled ? [{ label: 'Приложение', path: '/download' }] : []),
    { label: 'Тарифы', path: '/pricing' },
    { label: 'Вакансии', path: '/vacancies' },
    { label: 'FAQ', path: '/faq' },
    { label: 'Контакты', path: '/contacts' },
    { label: 'Пользовательское соглашение', path: '/terms' },
    { label: 'Политика конфиденциальности', path: '/privacy' },
  ];

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        pt: 3,
        pb: 2.5,
        borderTop: 1,
        borderColor: 'divider',
        background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.white} 100%)`,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 1.25, sm: 2 },
            mb: 2,
          }}
        >
          {links.map((item, idx) => (
            <React.Fragment key={item.path}>
              {idx > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  |
                </Typography>
              )}
              <Typography
                variant="body2"
                component="a"
                href={item.path}
                onClick={go(item.path)}
                sx={linkSx}
              >
                {item.label}
              </Typography>
            </React.Fragment>
          ))}
        </Box>

        {socials.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 2,
              mb: 2,
            }}
          >
            {socials.map((s) => (
              <MuiLink
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{ fontWeight: 700, fontSize: 14 }}
              >
                {s.label}
              </MuiLink>
            ))}
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" align="center">
          © {new Date().getFullYear()} ПРОФСПОРТСРМ. Все права защищены.
        </Typography>
      </Container>
    </Box>
  );
};

export default PublicFooter;
