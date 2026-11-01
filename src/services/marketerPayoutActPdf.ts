import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PLATFORM_OPERATOR } from '../constants/platformOperator';
import { absoluteUploadPath, ensureUploadDir } from '../utils/fileStorage';

export type ActPdfMarketer = {
  name: string;
  email: string;
  phone?: string | null;
  inn?: string | null;
  taxStatus?: string | null;
  bankName: string;
  bankBik: string;
  bankAccount: string;
  bankRecipient: string;
};

export type ActPdfParams = {
  payoutId: string;
  amount: number;
  marketer: ActPdfMarketer;
  /** Дата формирования черновика / акта */
  issuedAt?: Date;
  signature?: {
    signedAt: Date;
    signerEmail: string;
    signIp?: string | null;
    draftContentHash: string;
  };
};

export type ActPdfResult = {
  relativePath: string;
  contentHash: string;
  title: string;
  bytes: Uint8Array;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 50;
const MAX_W = PAGE_W - MARGIN_X * 2;

function fontsDir(): string {
  return path.join(process.cwd(), 'assets', 'fonts');
}

function taxStatusLabel(status?: string | null): string {
  switch (String(status || '').toUpperCase()) {
    case 'NPD':
      return 'Самозанятый (НПД)';
    case 'OTHER':
      return 'Иное';
    default:
      return 'Не указан';
  }
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];
  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
      } else {
        // длинный токен без пробелов — режем по символам
        let chunk = '';
        for (const ch of word) {
          const trial = chunk + ch;
          if (font.widthOfTextAtSize(trial, size) <= maxWidth) chunk = trial;
          else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

async function loadFonts(pdfDoc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  pdfDoc.registerFontkit(fontkit);
  const dir = fontsDir();
  const regularBytes = fs.readFileSync(path.join(dir, 'NotoSans-Regular.ttf'));
  const boldBytes = fs.readFileSync(path.join(dir, 'NotoSans-Bold.ttf'));
  const regular = await pdfDoc.embedFont(regularBytes, { subset: true });
  const bold = await pdfDoc.embedFont(boldBytes, { subset: true });
  return { regular, bold };
}

/**
 * Генерирует персональный акт (черновик или подписанную копию со штампом ПЭП).
 * Если в SA есть шаблон акта (bodyText) — использует его.
 */
export async function buildMarketerPayoutActPdf(params: ActPdfParams): Promise<ActPdfResult> {
  const issuedAt = params.issuedAt || new Date();
  const dateStr = issuedAt.toLocaleDateString('ru-RU');
  const amountStr = formatMoney(params.amount);
  const op = PLATFORM_OPERATOR;
  const m = params.marketer;

  try {
    const { MarketerLegalDocumentService } = await import('./marketerLegalDocumentService');
    const { renderLegalTextPdf } = await import('./marketerLegalPdf');
    const template = await MarketerLegalDocumentService.getActTemplateBody();
    if (template?.trim()) {
      let body = template;
      if (params.signature) {
        const s = params.signature;
        body +=
          `\n\nОтметка о подписании (ПЭП)\n` +
          `Подписант: ${s.signerEmail}\n` +
          `Дата и время: ${s.signedAt.toLocaleString('ru-RU')}\n` +
          `IP: ${s.signIp || '—'}\n` +
          `Хэш черновика (SHA-256): ${s.draftContentHash}\n` +
          `Документ подписан кодом из письма на электронную почту.`;
      } else {
        body +=
          `\n\nДокумент ещё не подписан. После подтверждения кода будет сохранена подписанная копия.`;
      }
      const suffix = params.signature ? 'signed' : 'draft';
      const pdf = await renderLegalTextPdf({
        title: `Акт на вывод средств от ${dateStr}`,
        bodyText: body,
        vars: {
          date: dateStr,
          marketer: {
            name: m.name,
            email: m.email,
            phone: m.phone,
            inn: m.inn,
            taxStatus: m.taxStatus,
          },
          payout: {
            id: params.payoutId,
            amount: params.amount,
          },
          extra: {
            'marketer.bankName': m.bankName,
            'marketer.bankBik': m.bankBik,
            'marketer.bankAccount': m.bankAccount,
            'marketer.bankRecipient': m.bankRecipient,
          },
        },
        storageKey: `${params.payoutId}-${suffix}`,
        uploadNamespace: 'marketer-cabinet/payouts',
      });
      return {
        relativePath: pdf.relativePath,
        contentHash: pdf.contentHash,
        title: `Акт на вывод средств от ${dateStr}`,
        bytes: pdf.bytes,
      };
    }
  } catch (e) {
    console.warn('[payout-act] template render failed, fallback to built-in layout', e);
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const { regular, bold } = await loadFonts(pdfDoc);

  type Line = { text: string; bold?: boolean; size?: number; gapAfter?: number };
  const lines: Line[] = [
    { text: 'Закрывающий акт', bold: true, size: 16, gapAfter: 4 },
    { text: 'об оказании услуг по партнёрской программе', bold: true, size: 12, gapAfter: 14 },
    { text: `Дата составления: ${dateStr}`, size: 10, gapAfter: 4 },
    { text: `ID заявки: ${params.payoutId}`, size: 10, gapAfter: 16 },

    { text: '1. Заказчик (оператор платформы)', bold: true, size: 11, gapAfter: 8 },
    { text: op.fullName, size: 10, gapAfter: 3 },
    { text: `ИНН ${op.inn} · ОГРНИП ${op.ogrnip}`, size: 10, gapAfter: 3 },
    { text: `Адрес: ${op.legalAddress}`, size: 10, gapAfter: 3 },
    { text: `Email: ${op.email}`, size: 10, gapAfter: 3 },
    {
      text: `Банк: ${op.bankName}, БИК ${op.bankBik}, р/с ${op.bankAccount}, к/с ${op.bankCorrAccount}`,
      size: 10,
      gapAfter: 14,
    },

    { text: '2. Исполнитель (маркетолог)', bold: true, size: 11, gapAfter: 8 },
    { text: m.name || '—', size: 10, gapAfter: 3 },
    { text: `Email: ${m.email || '—'}`, size: 10, gapAfter: 3 },
    { text: `Телефон: ${m.phone || '—'}`, size: 10, gapAfter: 3 },
    { text: `ИНН: ${m.inn || '—'}`, size: 10, gapAfter: 3 },
    { text: `Налоговый статус: ${taxStatusLabel(m.taxStatus)}`, size: 10, gapAfter: 3 },
    { text: `Получатель платежа: ${m.bankRecipient}`, size: 10, gapAfter: 3 },
    { text: `Банк: ${m.bankName}, БИК ${m.bankBik}`, size: 10, gapAfter: 3 },
    { text: `Расчётный счёт: ${m.bankAccount}`, size: 10, gapAfter: 14 },

    { text: '3. Предмет и сумма', bold: true, size: 11, gapAfter: 8 },
    {
      text:
        'Вознаграждение за привлечение организаций и иные услуги по правилам партнёрской программы платформы.',
      size: 10,
      gapAfter: 6,
    },
    { text: `Сумма к перечислению: ${amountStr}`, bold: true, size: 12, gapAfter: 14 },

    { text: '4. Подписание', bold: true, size: 11, gapAfter: 8 },
    {
      text:
        'Документ подписывается простой электронной подписью: одноразовый код из письма на электронную почту исполнителя по условиям оферты и соглашения об электронной подписи.',
      size: 10,
      gapAfter: 10,
    },
  ];

  if (params.signature) {
    const s = params.signature;
    lines.push(
      { text: 'Отметка о подписании (ПЭП)', bold: true, size: 11, gapAfter: 8 },
      { text: `Подписант: ${s.signerEmail}`, size: 10, gapAfter: 3 },
      { text: `Дата и время: ${formatDateTime(s.signedAt)}`, size: 10, gapAfter: 3 },
      { text: `IP: ${s.signIp || '—'}`, size: 10, gapAfter: 3 },
      { text: `Хэш черновика (SHA-256): ${s.draftContentHash}`, size: 9, gapAfter: 3 },
      {
        text: 'Документ подписан кодом из письма на электронную почту. Подписанная копия сохранена в личном кабинете.',
        size: 10,
        gapAfter: 6,
      }
    );
  } else {
    lines.push({
      text: 'Документ ещё не подписан. После подтверждения кода будет сохранена подписанная копия.',
      size: 10,
      gapAfter: 6,
    });
  }

  let y = PAGE_H - 48;
  for (const line of lines) {
    const size = line.size ?? 10;
    const font = line.bold ? bold : regular;
    const wrapped = wrapText(line.text, font, size, MAX_W);
    for (const w of wrapped) {
      if (y < 48) break;
      page.drawText(w, {
        x: MARGIN_X,
        y,
        size,
        font,
        color: rgb(0.12, 0.14, 0.18),
      });
      y -= size + 4;
    }
    y -= line.gapAfter ?? 2;
  }

  const bytes = await pdfDoc.save();
  const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');
  const dir = ensureUploadDir('marketer-cabinet', 'payouts');
  const suffix = params.signature ? 'signed' : 'draft';
  const filename = `${params.payoutId}-${Date.now()}-${suffix}.pdf`;
  fs.writeFileSync(path.join(dir, filename), bytes);

  return {
    relativePath: `marketer-cabinet/payouts/${filename}`,
    contentHash,
    title: `Акт на вывод средств от ${dateStr}`,
    bytes,
  };
}

export function unlinkActFile(relativePath?: string | null) {
  if (!relativePath) return;
  try {
    fs.unlinkSync(absoluteUploadPath(relativePath));
  } catch {
    /* ignore */
  }
}
