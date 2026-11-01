import React, { useMemo, useState } from 'react';
import { Box, Button, Typography, type SxProps, type Theme } from '@mui/material';
import { ContentCopy, LinkOutlined, LocalOfferOutlined } from '@mui/icons-material';
import { adLinkUrl } from '../../utils/refCode';
import { marketerCardSx, marketerRadii } from './marketerUi';
import type { PersonalPromo } from './MarketerPersonalPromo';

type AdLink = { code?: string; path?: string } | null | undefined;

type Props = {
  adLink?: AdLink;
  promo?: PersonalPromo;
  sx?: SxProps<Theme>;
};

function resolveUrl(adLink: AdLink): string {
  if (!adLink) return '';
  if (adLink.path) {
    if (/^https?:\/\//i.test(adLink.path)) return adLink.path;
    return `${window.location.origin}${adLink.path.startsWith('/') ? '' : '/'}${adLink.path}`;
  }
  if (adLink.code) return adLinkUrl(adLink.code);
  return '';
}

function displayHostPath(url: string): string {
  if (!url) return '—';
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

function discountLabel(promo: NonNullable<PersonalPromo>): string {
  if (promo.discountType === 'PERCENTAGE') return `${promo.discountValue}%`;
  return `${new Intl.NumberFormat('ru-RU').format(promo.discountValue)} ₽`;
}

/**
 * Ссылка /ref + промокод — горизонтальная полоска на всю ширину Главной.
 */
const MarketerInviteTools: React.FC<Props> = ({ adLink, promo, sx }) => {
  const [copiedKey, setCopiedKey] = useState<'link' | 'promo' | null>(null);
  const url = useMemo(() => resolveUrl(adLink), [adLink]);
  const display = useMemo(() => displayHostPath(url), [url]);
  const hasPromo = Boolean(promo?.code);

  const copy = async (key: 'link' | 'promo', value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <Box
      sx={[
        {
          ...marketerCardSx,
          p: { xs: 1.5, md: '14px 18px' },
          mb: 2.5,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: hasPromo ? 'minmax(0,1.4fr) minmax(220px,.7fr)' : '1fr',
          },
          gap: { xs: 1.25, md: 2 },
          alignItems: 'center',
          minWidth: 0,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '8px',
            bgcolor: '#eaf2ff',
            color: '#2566e9',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <LinkOutlined sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#13213a', lineHeight: 1.25 }}>
            Пригласить организацию
          </Typography>
          <Typography
            component="code"
            sx={{
              display: 'block',
              mt: 0.35,
              fontFamily: 'inherit',
              fontSize: 12,
              color: '#3466af',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {display}
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
          onClick={() => void copy('link', url)}
          disabled={!url}
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            fontSize: 11,
            bgcolor: '#e8f1ff',
            color: '#2563d6',
            borderRadius: marketerRadii.control,
            px: 1.5,
            py: 0.85,
            flexShrink: 0,
            '&:hover': { bgcolor: '#dce9ff' },
          }}
        >
          {copiedKey === 'link' ? 'Скопировано' : 'Копировать'}
        </Button>
      </Box>

      {hasPromo && promo && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            minWidth: 0,
            pl: { md: 2 },
            borderLeft: { md: '1px solid #e8eef6' },
          }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              bgcolor: '#eef8f1',
              color: '#1a8f5c',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <LocalOfferOutlined sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 11, color: '#7a889e', lineHeight: 1.25 }}>
              Промокод · −{discountLabel(promo)}
            </Typography>
            <Typography
              component="code"
              sx={{
                display: 'block',
                mt: 0.2,
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: '#1a6b45',
              }}
            >
              {promo.code}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
            onClick={() => void copy('promo', promo.code)}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              fontSize: 11,
              bgcolor: '#e8f6ee',
              color: '#1a8f5c',
              borderRadius: marketerRadii.control,
              px: 1.5,
              py: 0.85,
              flexShrink: 0,
              '&:hover': { bgcolor: '#d9f0e3' },
            }}
          >
            {copiedKey === 'promo' ? 'Скопировано' : 'Копировать'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default MarketerInviteTools;
