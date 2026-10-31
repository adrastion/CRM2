import React, { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ContentCopy, LinkOutlined } from '@mui/icons-material';
import { adLinkUrl } from '../../utils/refCode';
import { marketerCardSx, marketerRadii } from './marketerUi';

type AdLink = { code?: string; path?: string } | null | undefined;

type Props = {
  adLink?: AdLink;
  /** card — блок на Главной; strip — компактная полоска в Мои организации */
  variant?: 'card' | 'strip';
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

/**
 * Ссылка /ref/:code для приглашения школ (не путать с /join для команды).
 * Атрибуция сохраняется ~90 дней, даже если регистрация позже с прямого домена.
 */
const MarketerSchoolRefLink: React.FC<Props> = ({ adLink, variant = 'card' }) => {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => resolveUrl(adLink), [adLink]);
  const display = useMemo(() => displayHostPath(url), [url]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (variant === 'strip') {
    return (
      <Box
        sx={{
          ...marketerCardSx,
          p: { xs: 1.5, md: '14px 18px' },
          mb: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 1.25, sm: 2 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, flex: 1, minWidth: 0 }}>
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
              mt: 0.15,
            }}
          >
            <LinkOutlined sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#13213a', lineHeight: 1.3 }}>
              Ссылка для школ
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#7a889e', mt: 0.35, lineHeight: 1.45 }}>
              Отправьте владельцу — закрепление сохранится ~90 дней, даже если регистрация позже.
            </Typography>
            <Typography
              component="code"
              sx={{
                display: 'block',
                mt: 0.85,
                fontFamily: 'inherit',
                fontSize: 11.5,
                color: '#3466af',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {display}
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
          onClick={() => void copy()}
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
            alignSelf: { xs: 'stretch', sm: 'center' },
            '&:hover': { bgcolor: '#dce9ff' },
          }}
        >
          {copied ? 'Скопировано' : 'Копировать'}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ ...marketerCardSx, p: { xs: 2, md: '21px 21px 19px' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mb: 0.75 }}>
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
        <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#13213a' }}>
          Пригласить организацию
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: '#8390a4', mb: 1.5, lineHeight: 1.5 }}>
        Отправьте ссылку владельцу школы. Закрепление сохранится около 90 дней — даже если он
        зарегистрируется позже с обычного сайта.
      </Typography>
      <Typography sx={{ fontSize: 11, color: '#91a0b4' }}>Ваша ссылка для школ</Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          border: '1px dashed #d2e1f8',
          borderRadius: marketerRadii.control,
          bgcolor: '#f8fbff',
          p: 1.25,
          mt: 1,
          minWidth: 0,
        }}
      >
        <Typography
          component="code"
          sx={{
            fontFamily: 'inherit',
            fontSize: 11,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
            color: '#3466af',
          }}
        >
          {display}
        </Typography>
        <Button
          size="small"
          startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
          onClick={() => void copy()}
          disabled={!url}
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            fontSize: 10,
            bgcolor: '#e8f1ff',
            color: '#2563d6',
            borderRadius: '6px',
            px: 1.25,
            flexShrink: 0,
            '&:hover': { bgcolor: '#dce9ff' },
          }}
        >
          {copied ? 'Скопировано' : 'Копировать'}
        </Button>
      </Box>
      <Typography sx={{ fontSize: 10.5, color: '#91a0b4', mt: 1.5, lineHeight: 1.45 }}>
        Не путайте со ссылкой для команды маркетологов — та только для приглашения коллег.
      </Typography>
    </Box>
  );
};

export default MarketerSchoolRefLink;
