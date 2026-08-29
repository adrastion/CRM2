/**
 * Проверяет, что тексты новых экранов попали в production-бандл.
 * Запуск: node scripts/verify-build-strings.js
 */
const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'client', 'build', 'static', 'js');

const needles = [
  'Стать партнером',
  'Вход в личный кабинет',
  'Придумайте пароль',
  'Подтвердите пароль',
  'Запомнить меня',
  'В аккаунт какой организации вы хотите войти?',
  'Войти в аккаунт как клиент',
  'Войти в аккаунт как Сотрудник',
  'Ожидайте подтверждения от администратора организации',
  'Создайте свою спортивную школу',
  'Быстрые действия',
  'Календарь событий',
  'Прирост со вчерашнего дня',
  'PROF',
  '#4880FF'.toLowerCase(),
];

const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
const contents = files.map((f) => ({
  name: f,
  text: fs.readFileSync(path.join(jsDir, f), 'utf8'),
}));

/** Минификатор экранирует не-ASCII как \uXXXX, поэтому ищем оба варианта. */
function escapeUnicode(str) {
  return str
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : ch;
    })
    .join('');
}

function findIn(needle) {
  const variants = [needle, escapeUnicode(needle)];
  const lower = needle.toLowerCase();
  return contents.find(
    (c) => variants.some((v) => c.text.includes(v)) || c.text.toLowerCase().includes(lower)
  );
}

let failed = 0;
for (const needle of needles) {
  const hit = findIn(needle);
  if (hit) {
    console.log(`  OK   "${needle}" -> ${hit.name}`);
  } else {
    failed++;
    console.log(`  FAIL "${needle}" не найдено в бандле`);
  }
}

// Старые экраны не должны остаться в сборке.
const removed = ['Войти как клиент', 'Войти как сотрудник', 'Выберите, кто вы'];
for (const needle of removed) {
  const hit = findIn(needle);
  if (hit) {
    failed++;
    console.log(`  FAIL старый текст "${needle}" всё ещё в ${hit.name}`);
  } else {
    console.log(`  OK   старый текст "${needle}" удалён`);
  }
}

console.log(failed === 0 ? '\nВсе строки на месте\n' : `\nПровалено: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
