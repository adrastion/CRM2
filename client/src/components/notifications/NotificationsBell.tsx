import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
  CircularProgress,
} from '@mui/material';
import { NotificationsNone } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors } from '../../theme/tokens';

export type InboxPayload = {
  items: Array<{
    id: string;
    category: string;
    type: string;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
    readAt: string | null;
    createdAt: string;
  }>;
  aggregates: Array<{
    category: string;
    title: string;
    count: number;
    latestAt: string | null;
    url?: string;
  }>;
  unreadTotal: number;
};

type Props = {
  channel: 'school' | 'portal';
};

const NotificationsBell: React.FC<Props> = ({ channel }) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InboxPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res =
        channel === 'school'
          ? await apiService.getSchoolNotifications()
          : await apiService.getPortalNotifications();
      setData(res);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, [load]);

  const unread = data?.unreadTotal || 0;

  const open = Boolean(anchor);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchor(e.currentTarget);
    void load();
  };

  const go = async (url: string | undefined, category?: string, ids?: string[]) => {
    try {
      if (channel === 'school') {
        await apiService.markSchoolNotificationsRead({
          category,
          ids,
          all: !category && !ids?.length,
        });
      } else {
        await apiService.markPortalNotificationsRead({
          category,
          ids,
          all: !category && !ids?.length,
        });
      }
    } catch {
      /* ignore */
    }
    setAnchor(null);
    void load();
    if (url) {
      if (channel === 'portal' && url === '/client/dashboard') {
        // stay / focus chats tab via hash
        navigate('/client/dashboard');
        return;
      }
      navigate(url);
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <IconButton
        aria-label="Уведомления"
        size="small"
        sx={{ color: colors.textMuted }}
        onClick={handleOpen}
      >
        <NotificationsNone sx={{ fontSize: 22 }} />
      </IconButton>
      {unread > 0 && (
        <Box
          aria-label={`Непрочитанных уведомлений: ${unread}`}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 20,
            height: 20,
            px: 0.5,
            borderRadius: '999px',
            bgcolor: colors.danger,
            color: colors.white,
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {unread > 9 ? '9+' : unread}
        </Box>
      )}

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 440 } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>Уведомления</Typography>
          {unread > 0 && (
            <Typography
              component="button"
              type="button"
              onClick={() => void go(undefined)}
              sx={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: colors.primary,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            >
              Прочитать все
            </Typography>
          )}
        </Box>
        <Divider />
        {loading && !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense disablePadding>
            {(data?.aggregates || []).map((a) => (
              <ListItemButton
                key={`agg-${a.category}`}
                onClick={() => void go(a.url, a.category)}
              >
                <ListItemText
                  primary={a.title}
                  primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }}
                />
              </ListItemButton>
            ))}
            {(data?.items || [])
              .filter((i) => !i.readAt)
              .slice(0, 20)
              .map((item) => (
                <ListItemButton
                  key={item.id}
                  onClick={() =>
                    void go(
                      typeof item.data?.url === 'string' ? item.data.url : undefined,
                      undefined,
                      [item.id]
                    )
                  }
                >
                  <ListItemText
                    primary={item.title}
                    secondary={item.body || undefined}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }}
                    secondaryTypographyProps={{ fontSize: 12 }}
                  />
                </ListItemButton>
              ))}
            {!unread && (
              <Box sx={{ px: 2, py: 3 }}>
                <Typography sx={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
                  Нет новых уведомлений
                </Typography>
              </Box>
            )}
          </List>
        )}
      </Popover>
    </Box>
  );
};

export default NotificationsBell;
