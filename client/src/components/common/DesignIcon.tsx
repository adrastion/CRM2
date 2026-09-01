import React from 'react';
import { Box, BoxProps } from '@mui/material';
import {
  MetricIconName,
  NavIconName,
  UiIconName,
  metricIcons,
  navIcons,
  uiIcons,
} from '../../assets/icons/registry';

type IconCategory = 'nav' | 'metric' | 'ui';

type DesignIconProps = {
  category: IconCategory;
  name: NavIconName | MetricIconName | UiIconName;
  /** Ширина в px. Высота подстраивается пропорционально. */
  size?: number;
  /** Активный пункт меню — иконка белая на синем фоне. */
  active?: boolean;
  /** Приглушённая иконка (сортировка неактивна). */
  muted?: boolean;
  alt?: string;
  sx?: BoxProps['sx'];
};

const resolveSrc = (category: IconCategory, name: string): string => {
  if (category === 'nav') return navIcons[name as NavIconName];
  if (category === 'metric') return metricIcons[name as MetricIconName];
  return uiIcons[name as UiIconName];
};

/**
 * Иконка из макета Figma (SVG/PNG из assets/icons).
 * Для nav при active=true применяется фильтр «белая иконка».
 */
const DesignIcon: React.FC<DesignIconProps> = ({
  category,
  name,
  size,
  active = false,
  muted = false,
  alt = '',
  sx,
}) => {
  const src = resolveSrc(category, name);
  const defaultSize = category === 'metric' ? 60 : category === 'nav' ? 34 : 22;
  const width = size ?? defaultSize;

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      draggable={false}
      sx={{
        width,
        height: 'auto',
        display: 'block',
        flexShrink: 0,
        objectFit: 'contain',
        opacity: muted ? 0.55 : 1,
        filter: active ? 'brightness(0) invert(1)' : undefined,
        ...sx,
      }}
    />
  );
};

export default DesignIcon;
