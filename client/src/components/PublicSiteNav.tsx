import React from 'react';
import {
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Menu as MenuIcon, Close } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from './common/BrandLogo';
import { colors } from '../theme/tokens';
import { currentSessionDestination, hasAnySession } from '../utils/authSession';

export type PublicNavVariant = 'overlay' | 'solid';

interface PublicSiteNavProps {
  /** overlay — поверх героя; solid — обычная белая шапка */
  variant?: PublicNavVariant;
  /** Показывать пункт «Возможности» (якорь на лендинге) */
  showFeatures?: boolean;
  onFeaturesClick?: () => void;
}

/**
 * Единая шапка публичных страниц: главная → тарифы → контакты → вход/регистрация.
 * На узких экранах вторичные ссылки уходят в меню, чтобы «Регистрация» не уезжала за край.
 */
const PublicSiteNav: React.FC<PublicSiteNavProps> = ({
  variant = 'solid',
  showFeatures = false,
  onFeaturesClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const showWordmark = useMediaQuery(theme.breakpoints.up('sm'));
  const loggedIn = hasAnySession();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    if (variant !== 'overlay') return;
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  const solid = variant === 'solid' || scrolled;

  const goCabinet = () => {
    navigate(currentSessionDestination() || '/dashboard');
  };

  const linkActive = (path: string) => location.pathname === path;

  const secondaryLinks: Array<{ label: string; onClick: () => void; active?: boolean }> = [
    ...(showFeatures
      ? [{ label: 'Возможности', onClick: () => onFeaturesClick?.() }]
      : [{ label: 'Главная', onClick: () => navigate('/'), active: linkActive('/') }]),
    { label: 'Тарифы', onClick: () => navigate('/pricing'), active: linkActive('/pricing') },
    { label: 'Контакты', onClick: () => navigate('/contacts'), active: linkActive('/contacts') },
  ];

  const closeAnd = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <>
      <Box
        component="header"
        sx={{
          position: variant === 'overlay' ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          transition: 'background-color 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease',
          bgcolor: solid ? 'rgba(255,255,255,0.96)' : 'transparent',
          borderBottom: solid ? `1px solid ${colors.divider}` : '1px solid transparent',
          backdropFilter: solid ? 'blur(12px)' : 'none',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            minWidth: 0,
          }}
        >
          <Box
            onClick={() => navigate('/')}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              px: solid ? 0 : 1,
              py: solid ? 0 : 0.5,
              borderRadius: 2,
              bgcolor: solid ? 'transparent' : 'rgba(255,255,255,0.92)',
            }}
          >
            <BrandLogo
              size={{ xs: 32, md: 40 }}
              layout="horizontal"
              withWordmark={showWordmark}
              wordmarkSize={{ sm: 12, md: 14 }}
            />
          </Box>

          {/* Десктоп: полный набор */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 0.5,
              flexShrink: 0,
              px: solid ? 0 : 1,
              py: solid ? 0 : 0.5,
              borderRadius: 2,
              bgcolor: solid ? 'transparent' : 'rgba(255,255,255,0.88)',
            }}
          >
            {secondaryLinks.map((link) => (
              <Button
                key={link.label}
                color="inherit"
                onClick={link.onClick}
                sx={{
                  color: colors.text,
                  fontWeight: link.active ? 800 : 600,
                  textTransform: 'none',
                }}
              >
                {link.label}
              </Button>
            ))}
            {loggedIn ? (
              <Button variant="contained" onClick={goCabinet} sx={{ fontWeight: 700, ml: 0.5 }}>
                В кабинет
              </Button>
            ) : (
              <>
                <Button
                  color="inherit"
                  onClick={() => navigate('/auth')}
                  sx={{ color: colors.text, fontWeight: 600, textTransform: 'none' }}
                >
                  Войти
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate('/register')}
                  sx={{ fontWeight: 700, ml: 0.5, textTransform: 'none' }}
                >
                  Регистрация
                </Button>
              </>
            )}
          </Box>

          {/* Планшет/телефон: компактные CTA + меню */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              gap: 0.75,
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            {loggedIn ? (
              <Button
                variant="contained"
                size="small"
                onClick={goCabinet}
                sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                Кабинет
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate('/register')}
                sx={{
                  fontWeight: 700,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  px: 1.5,
                  maxWidth: '42vw',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Регистрация
              </Button>
            )}
            <IconButton
              aria-label="Меню"
              onClick={() => setMenuOpen(true)}
              sx={{
                bgcolor: solid ? colors.surface : 'rgba(255,255,255,0.92)',
                borderRadius: 2,
              }}
            >
              <MenuIcon sx={{ color: colors.text }} />
            </IconButton>
          </Box>
        </Container>
      </Box>

      <Drawer anchor="right" open={menuOpen} onClose={() => setMenuOpen(false)}>
        <Box sx={{ width: 280, pt: 1 }} role="presentation">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pb: 1 }}>
            <Typography sx={{ fontWeight: 800, color: colors.text }}>Меню</Typography>
            <IconButton onClick={() => setMenuOpen(false)} aria-label="Закрыть">
              <Close />
            </IconButton>
          </Box>
          <List>
            {secondaryLinks.map((link) => (
              <ListItemButton key={link.label} onClick={() => closeAnd(link.onClick)} selected={link.active}>
                <ListItemText primary={link.label} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            ))}
            {!loggedIn && (
              <ListItemButton onClick={() => closeAnd(() => navigate('/auth'))}>
                <ListItemText primary="Войти" primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            )}
            {!loggedIn && (
              <ListItemButton onClick={() => closeAnd(() => navigate('/register'))}>
                <ListItemText primary="Регистрация" primaryTypographyProps={{ fontWeight: 700 }} />
              </ListItemButton>
            )}
            {loggedIn && (
              <ListItemButton onClick={() => closeAnd(goCabinet)}>
                <ListItemText primary="В кабинет" primaryTypographyProps={{ fontWeight: 700 }} />
              </ListItemButton>
            )}
          </List>
        </Box>
      </Drawer>
    </>
  );
};

export default PublicSiteNav;
