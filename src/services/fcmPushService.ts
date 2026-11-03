import { prisma } from '../lib/prisma';

type FcmPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

let messaging: import('firebase-admin/messaging').Messaging | null | undefined;

function flattenData(data?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

/** Ленивая инициализация Firebase Admin (нужен FIREBASE_SERVICE_ACCOUNT_JSON или GOOGLE_APPLICATION_CREDENTIALS). */
async function getMessaging(): Promise<import('firebase-admin/messaging').Messaging | null> {
  if (messaging !== undefined) return messaging;
  try {
    const admin = await import('firebase-admin');
    if (!admin.apps.length) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
      if (raw) {
        const cred = JSON.parse(raw);
        admin.initializeApp({
          credential: admin.credential.cert(cred),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      } else {
        messaging = null;
        return null;
      }
    }
    messaging = admin.messaging();
    return messaging;
  } catch (e) {
    console.warn('[FCM] firebase-admin unavailable', e);
    messaging = null;
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

/** Отправка на все FCM-токены актора. */
export async function sendFcmToActor(
  actorType: string,
  actorId: string,
  payload: FcmPayload
): Promise<number> {
  const msg = await getMessaging();
  if (!msg) return 0;

  const tokens = await prisma.mobileDeviceToken.findMany({
    where: { actorType, actorId },
    select: { id: true, token: true },
  });
  if (!tokens.length) return 0;

  const data = flattenData(payload.data);
  let sent = 0;
  await Promise.allSettled(
    tokens.map(async (row) => {
      try {
        await msg.send({
          token: row.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data,
          android: {
            priority: 'high',
            notification: {
              channelId: 'profsport_default',
              sound: 'default',
            },
          },
        });
        sent += 1;
      } catch (e: any) {
        const code = e?.errorInfo?.code || e?.code || '';
        if (
          String(code).includes('registration-token-not-registered') ||
          String(code).includes('invalid-registration-token')
        ) {
          await prisma.mobileDeviceToken.delete({ where: { id: row.id } }).catch(() => undefined);
        } else {
          console.error('[FCM] send error', code || e);
        }
      }
    })
  );
  return sent;
}
