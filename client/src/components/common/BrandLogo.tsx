import React from 'react';
import { Box, Typography } from '@mui/material';
import logo from '../../assets/logo-ProfSportCRM.png';
import { colors } from '../../theme/tokens';

interface BrandLogoProps {
  /** Высота знака в px (адаптивные значения задаются в вызывающем коде). */
  size?: number | Record<string, number>;
  /** Показывать текстовую часть PROFSPORTCRM под знаком. */
  withWordmark?: boolean;
  /** Расположение текста: под знаком или справа от него. */
  layout?: 'vertical' | 'horizontal';
  /** Размер текстовой части. */
  wordmarkSize?: number | Record<string, number>;
}

/**
 * Фирменный блок: графический знак из logo-ProfSportCRM.png и надпись
 * PROFSPORTCRM. Знак — квадратный PNG с прозрачным фоном, поэтому
 * подложка не нужна.
 */
const BrandLogo: React.FC<BrandLogoProps> = ({
  size = { xs: 64, md: 96 },
  withWordmark = true,
  layout = 'vertical',
  wordmarkSize = { xs: 20, md: 28 },
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: layout === 'vertical' ? 'column' : 'row',
      alignItems: 'center',
      gap: layout === 'vertical' ? 2 : 1.5,
      userSelect: 'none',
    }}
  >
    <Box
      component="img"
      src={logo}
      alt="ПрофСпортСРМ"
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
      }}
    />

    {withWordmark && (
      <Typography
        component="span"
        sx={{
          fontSize: wordmarkSize,
          fontWeight: 800,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        <Box component="span" sx={{ color: colors.primary }}>
          PROF
        </Box>
        <Box component="span" sx={{ color: colors.text }}>
          SPORTCRM
        </Box>
      </Typography>
    )}
  </Box>
);

export default BrandLogo;
