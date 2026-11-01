import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PLATFORM_OPERATOR } from '../constants/platformOperator';
import { ensureUploadDir } from '../utils/fileStorage';

export type LegalTemplateVars = {
  marketer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    inn?: string | null;
    taxStatus?: string | null;
  };
  payout?: {
    id?: string;
    amount?: number | string;
    period?: string | null;
  };
  date?: string;
  extra?: Record<string, string>;
};

function taxLabel(status?: string | null): string {
  switch (String(status || '').toUpperCase()) {
    case 'NPD':
      return 'Самозанятый (НПД)';
    case 'OTHER':
      return 'Иное';
    default:
      return 'Не указан';
  }
}

function formatMoney(amount: number | string | undefined): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Приводит формулировки сторон к единым плейсхолдерам:
 * Заказчик ← Contacts (operator), Исполнитель ← профиль маркетолога.
 */
export function normalizePartyPlaceholders(text: string): string {
  let t = String(text || '');

  // Заказчик / Оператор ← реквизиты с «Контакты»
  t = t.replace(
    /Заказчик:\s*\{\{operator\.fullName\}\},\s*ИНН\s*\[___\],\s*ОГРН\s*\[___\],\s*адрес\s*\[___\]/gi,
    'Заказчик: {{customer.block}}'
  );
  t = t.replace(
    /Заказчик:\s*\{\{operator\.fullName\}\},\s*ИНН\s*\{\{operator\.inn\}\},\s*ОГРНИП\s*\{\{operator\.ogrnip\}\}/gi,
    'Заказчик: {{customer.block}}'
  );
  t = t.replace(/Заказчик:\s*\[.*?\]/gi, 'Заказчик: {{customer.block}}');
  t = t.replace(
    /Оператор:\s*\{\{operator\.fullName\}\},\s*ИНН\s*\{\{operator\.inn\}\},\s*ОГРНИП\s*\{\{operator\.ogrnip\}\}/gi,
    'Оператор (Заказчик): {{customer.block}}'
  );
  t = t.replace(/Оператор данных:\s*\{\{operator\.fullName\}\},\s*\{\{operator\.legalAddress\}\},\s*ИНН\s*\{\{operator\.inn\}\}/gi, 'Оператор данных (Заказчик): {{customer.block}}');

  // Исполнитель / Маркетолог ← ЛК профиля
  t = t.replace(
    /Исполнитель:\s*\{\{marketer\.name\}\},\s*ИНН\s*\[___\],\s*статус\s*\[___\]/gi,
    'Исполнитель: {{executor.block}}'
  );
  t = t.replace(
    /Исполнитель:\s*\{\{marketer\.name\}\},\s*ИНН\s*\{\{marketer\.inn\}\},\s*\{\{marketer\.taxStatus\}\}/gi,
    'Исполнитель: {{executor.block}}'
  );
  t = t.replace(/Исполнитель:\s*\[.*?\]/gi, 'Исполнитель: {{executor.block}}');
  t = t.replace(
    /Исполнитель:\s*\{\{marketer\.name\}\},\s*ИНН\s*\{\{marketer\.inn\}\}/gi,
    'Исполнитель: {{executor.block}}'
  );
  t = t.replace(
    /Маркетолог:\s*\{\{marketer\.name\}\},\s*ИНН\s*\{\{marketer\.inn\}\},\s*\{\{marketer\.phone\}\}/gi,
    'Исполнитель (Маркетолог): {{executor.block}}'
  );
  t = t.replace(
    /далее «Оператор»\.\s*Исполнитель:\s*\{\{marketer\.name\}\}/gi,
    'далее «Оператор». Исполнитель: {{executor.block}}'
  );

  // Хвосты [___] у сторон после частичной подстановки
  t = t.replace(
    /\{\{operator\.fullName\}\},\s*ИНН\s*\[___\],\s*ОГРН\s*\[___\],\s*адрес\s*\[___\]/gi,
    '{{customer.block}}'
  );
  t = t.replace(/\{\{marketer\.name\}\},\s*ИНН\s*\[___\],\s*статус\s*\[___\]/gi, '{{executor.block}}');

  // Хвосты после {{customer.block}} / {{executor.block}}
  t = t.replace(
    /\{\{customer\.block\}\},\s*ИНН\s*\[___\],\s*ОГРН\s*\[___\],\s*адрес\s*\[___\]/gi,
    '{{customer.block}}'
  );
  t = t.replace(/\{\{executor\.block\}\},\s*ИНН\s*\[___\],\s*статус\s*\[___\]/gi, '{{executor.block}}');

  return t;
}

/** Собирает словарь подстановок для шаблона. */
export function buildLegalTemplateDict(vars: LegalTemplateVars = {}): Record<string, string> {
  const op = PLATFORM_OPERATOR;
  const m = vars.marketer || {};
  const p = vars.payout || {};
  const date =
    vars.date ||
    new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const customerBlock = [
    op.fullName,
    `ИНН ${op.inn}`,
    `ОГРНИП ${op.ogrnip}`,
    `адрес ${op.legalAddress}`,
    `email ${op.email}`,
  ].join(', ');

  const name = m.name || '—';
  const inn = m.inn || '—';
  const email = m.email || '—';
  const phone = m.phone || '—';
  const tax = taxLabel(m.taxStatus);
  const executorBlock = [
    name,
    `ИНН ${inn}`,
    `статус ${tax}`,
    `email ${email}`,
    `тел. ${phone}`,
  ].join(', ');

  const dict: Record<string, string> = {
    'operator.fullName': op.fullName,
    'operator.shortName': op.shortName,
    'operator.inn': op.inn,
    'operator.ogrnip': op.ogrnip,
    'operator.email': op.email,
    'operator.legalAddress': op.legalAddress,
    'operator.bankName': op.bankName,
    'operator.bankBik': op.bankBik,
    'operator.bankAccount': op.bankAccount,
    'operator.bankCorrAccount': op.bankCorrAccount,
    'customer.block': customerBlock,
    'executor.block': executorBlock,
    заказчик: customerBlock,
    исполнитель: executorBlock,
    'marketer.name': name,
    'marketer.email': email,
    'marketer.phone': phone,
    'marketer.inn': inn,
    'marketer.taxStatus': tax,
    'payout.id': p.id || '—',
    'payout.idShort': p.id ? String(p.id).slice(-8) : '—',
    'payout.amount': formatMoney(p.amount),
    'payout.period': p.period || '—',
    date,
    ...(vars.extra || {}),
  };
  return dict;
}

export function applyLegalTemplate(bodyText: string, vars: LegalTemplateVars = {}): string {
  const dict = buildLegalTemplateDict(vars);
  const normalized = normalizePartyPlaceholders(bodyText);
  return normalized.replace(/\{\{\s*([a-zA-Z0-9_.А-Яа-яЁё]+)\s*\}\}/g, (_m, key: string) => {
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : `{{${key}}}`;
  });
}

function fontsDir(): string {
  return path.join(process.cwd(), 'assets', 'fonts');
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

/**
 * Рендерит шаблонный текст в многостраничный PDF (кириллица Noto Sans).
 */
export async function renderLegalTextPdf(params: {
  title: string;
  bodyText: string;
  vars?: LegalTemplateVars;
  storageKey: string;
  /** Каталог внутри uploads, по умолчанию marketer-legal */
  uploadNamespace?: string;
}): Promise<{ relativePath: string; contentHash: string; size: number; bytes: Uint8Array }> {
  const rendered = applyLegalTemplate(params.bodyText, params.vars);
  const uploadNs = params.uploadNamespace || 'marketer-legal';
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const regularBytes = fs.readFileSync(path.join(fontsDir(), 'NotoSans-Regular.ttf'));
  const boldBytes = fs.readFileSync(path.join(fontsDir(), 'NotoSans-Bold.ttf'));
  const regular = await pdfDoc.embedFont(regularBytes, { subset: true });
  const bold = await pdfDoc.embedFont(boldBytes, { subset: true });

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const MAX_W = PAGE_W - MARGIN * 2;
  const BOTTOM = 50;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (need: number) => {
    if (y - need < BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // Title
  ensureSpace(28);
  for (const line of wrapText(params.title, bold, 14, MAX_W)) {
    ensureSpace(18);
    page.drawText(line, { x: MARGIN, y, size: 14, font: bold, color: rgb(0.12, 0.14, 0.18) });
    y -= 18;
  }
  y -= 10;

  const paragraphs = rendered.split(/\n+/);
  for (const para of paragraphs) {
    const text = para.trim();
    if (!text) {
      y -= 8;
      continue;
    }
    const isHeading = /^\d+(\.\d+)*\.?\s/.test(text) || text === text.toUpperCase() && text.length < 80;
    const size = isHeading && text === text.toUpperCase() ? 11 : 10;
    const font = isHeading ? bold : regular;
    for (const line of wrapText(text, font, size, MAX_W)) {
      ensureSpace(size + 4);
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font,
        color: rgb(0.12, 0.14, 0.18),
      });
      y -= size + 4;
    }
    y -= 6;
  }

  const bytes = await pdfDoc.save();
  const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');
  const parts = uploadNs.split('/').filter(Boolean);
  const dir = ensureUploadDir(...(parts as [string, ...string[]]));
  const filename = `${params.storageKey}-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(dir, filename), bytes);
  return {
    relativePath: `${parts.join('/')}/${filename}`,
    contentHash,
    size: bytes.length,
    bytes,
  };
}
