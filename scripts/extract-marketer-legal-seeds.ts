/**
 * One-shot: DOCX → src/constants/marketerLegalSeeds.ts
 * Run: npx tsx scripts/extract-marketer-legal-seeds.ts
 */
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

const DOC_DIR = path.join(process.cwd(), 'ProfSport_CRM_Маркетолог', 'Документы');

const MAP: Array<{ key: string; file: string }> = [
  { key: 'offer', file: '01_Проект_оферты_маркетолога.docx' },
  { key: 'programRules', file: '02_Правила_партнерской_программы.docx' },
  { key: 'pep', file: '03_Соглашение_о_простой_электронной_подписи.docx' },
  { key: 'actTemplate', file: '04_Шаблон_акта_и_отчета.docx' },
  { key: 'npdPayouts', file: '05_Порядок_выплат_и_чеков_НПД.docx' },
  { key: 'pdn', file: '06_Персональные_данные_уведомление_и_согласие.docx' },
  { key: 'legalChecklist', file: '07_Чеклист_юридического_согласования.docx' },
];

function normalizePlaceholders(text: string): string {
  let t = text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim();
  // Email ПЭП вместо СМС (продуктовое решение)
  t = t.replace(/по СМС/gi, 'письмом на электронную почту');
  t = t.replace(/СМС/gi, 'письмо на электронную почту');
  t = t.replace(/номер телефона/gi, 'адрес электронной почты');

  const replacements: Array<[RegExp, string]> = [
    [/\[ПОЛНОЕ НАИМЕНОВАНИЕ ЮРИДИЧЕСКОГО ЛИЦА\]/gi, '{{customer.block}}'],
    [/\[ПОЛНОЕ НАИМЕНОВАНИЕ, ИНН, ОГРН\]/gi, '{{customer.block}}'],
    [/\[НАИМЕНОВАНИЕ И РЕКВИЗИТЫ\]/gi, '{{customer.block}}'],
    [/\[НАИМЕНОВАНИЕ, АДРЕС, ИНН\]/gi, '{{customer.block}}'],
    [/\[EMAIL\/КОНТАКТ\]/gi, '{{operator.email}}'],
    [/\[ФИО, ИНН, ТЕЛЕФОН\]/gi, '{{executor.block}}'],
    [/\[ФИО, ИНН, СТАТУС\]/gi, '{{executor.block}}'],
    [/физическое лицо \/ ИП \[ФИО\],\s*ИНН \[___\],\s*статус \[___\]/gi, '{{executor.block}}'],
    [/физическое лицо \/ ИП \[ФИО\]/gi, '{{executor.block}}'],
    [
      /Заказчик:\s*[^.]{0,200}?далее «Оператор»\.\s*Исполнитель:\s*[^.]{0,200}?далее «Маркетолог»\./gi,
      'Заказчик: {{customer.block}}, далее «Оператор». Исполнитель: {{executor.block}}, далее «Маркетолог».',
    ],
    [/Акт № \[___\] от \[ДД\.ММ\.ГГГГ\]/gi, 'Акт № {{payout.idShort}} от {{date}}'],
    [/Сумма вознаграждения по расчету, принятому сторонами: \[___\] ₽/gi, 'Сумма вознаграждения: {{payout.amount}}'],
    [/ИТОГО \[___\] ₽/gi, 'ИТОГО {{payout.amount}}'],
  ];
  for (const [re, to] of replacements) t = t.replace(re, to);
  return t;
}

async function main() {
  const out: Record<string, string> = {};
  for (const item of MAP) {
    const abs = path.join(DOC_DIR, item.file);
    if (!fs.existsSync(abs)) {
      console.warn('missing', abs);
      continue;
    }
    const result = await mammoth.extractRawText({ path: abs });
    out[item.key] = normalizePlaceholders(result.value || '');
    console.log(item.key, out[item.key].length);
  }

  const dest = path.join(process.cwd(), 'src', 'constants', 'marketerLegalSeeds.ts');
  const body = `/** Автогенерация: scripts/extract-marketer-legal-seeds.ts — не править руками без нужды. */\n` +
    `export const MARKETER_LEGAL_SEEDS: Record<string, string> = ${JSON.stringify(out, null, 2)};\n`;
  fs.writeFileSync(dest, body, 'utf8');
  console.log('wrote', dest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
