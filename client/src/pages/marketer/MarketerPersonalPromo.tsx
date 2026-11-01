import React, { useState } from 'react';
import { Box, Button, Typography, type SxProps, type Theme } from '@mui/material';
import { ContentCopy, LocalOfferOutlined } from '@mui/icons-material';
import { marketerCardSx, marketerRadii } from './marketerUi';

export type PersonalPromo = {
  code: string;
  discountType: string;
  discountValue: number;
  description?: string | null;
  usedCount?: number;
  usageLimit?: number | null;
  validUntil?: string | Date | null;
} | null | undefined;

type Props = {
  promo?: PersonalPromo;
  /** card — Главная; strip — компактная полоска */
  variant?: 'card' | 'strip';
  sx?: SxProps<Theme>;
};

function discountLabel(promo: NonNullable<PersonalPromo>): string {
  if (promo.discountType === 'PERCENTAGE') {
    return `${promo.discountValue}%`;
  }
  return `${new Intl.NumberFormat('ru-RU').format(promo.discountValue)} ₽`;
}

/**
 * Личный промокод: только если SA назначил. Без кода компонент не рендерится.
 * По отношению к маркетологу — то же закрепление школ, что и у /ref; плюс скидка клиенту.
 */
const MarketerPersonalPromo: React.FC<Props> = ({ promo, variant = 'card', sx }) => {
  const [copied, setCopied] = useState(false);

  if (!promo?.code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (variant === 'strip') {
    return (
      <Box
        sx={[
          {
            ...marketerCardSx,
            p: { xs: 1.5, md: '14px 18px' },
            mb: 2.5,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: { xs: 1.25, sm: 2 },
            minWidth: 0,
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, flex: 1, minWidth: 0 }}>
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
              mt: 0.15,
            }}
          >
            <LocalOfferOutlined sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#13213a', lineHeight: 1.3 }}>
              Ваш промокод
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#7a889e', mt: 0.35, lineHeight: 1.45 }}>
              Скидка {discountLabel(promo)} · школа закрепляется за вами, как по ссылке
            </Typography>
            <Typography
              component="code"
              sx={{
                display: 'block',
                mt: 0.85,
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: '#1a6b45',
              }}
            >
              {promo.code}
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
          onClick={() => void copy()}
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
            alignSelf: { xs: 'stretch', sm: 'center' },
            '&:hover': { bgcolor: '#d9f0e3' },
          }}
        >
          {copied ? 'Скопировано' : 'Копировать'}
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={[
        { ...marketerCardSx, p: { xs: 2, md: '21px 21px 19px' }, minWidth: 0 },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mb: 0.75 }}>
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
        <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#13213a' }}>Ваш промокод</Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: '#8390a4', mb: 1.5, lineHeight: 1.5 }}>
        Даёт скидку {discountLabel(promo)} при оплате тарифа. Школа закрепляется за вами так же, как
        по персональной ссылке.
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          border: '1px dashed #c5e6d4',
          borderRadius: marketerRadii.control,
          bgcolor: '#f5fbf7',
          p: 1.25,
          minWidth: 0,
        }}
      >
        <Typography
          component="code"
          sx={{
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '0.06em',
            flex: 1,
            minWidth: 0,
            color: '#1a6b45',
          }}
        >
          {promo.code}
        </Typography>
        <Button
          size="small"
          startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
          onClick={() => void copy()}
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            fontSize: 10,
            bgcolor: '#e8f6ee',
            color: '#1a8f5c',
            borderRadius: '6px',
            px: 1.25,
            flexShrink: 0,
            '&:hover': { bgcolor: '#d9f0e3' },
          }}
        >
          {copied ? 'Скопировано' : 'Копировать'}
        </Button>
      </Box>
    </Box>
  );
};

export default MarketerPersonalPromo;
