import Typo from 'typo-js';

const IGNORE_KEY = 'crm.spellcheck.ignored';
const PERSONAL_KEY = 'crm.spellcheck.personal';

/** Слова с буквами (кириллица/латиница), в т.ч. через дефис. */
export const WORD_RE = /[A-Za-zА-Яа-яЁё]+(?:-[A-Za-zА-Яа-яЁё]+)*/g;

let typo: Typo | null = null;
let loadPromise: Promise<Typo> | null = null;

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* quota */
  }
}

const ignored = readSet(IGNORE_KEY);
const personal = readSet(PERSONAL_KEY);

export function isSpellcheckReady(): boolean {
  return Boolean(typo);
}

/** Ленивая загрузка русского Hunspell-словаря (как встроенный словарь Telegram Desktop). */
export function loadRuSpell(): Promise<Typo> {
  if (typo) return Promise.resolve(typo);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [aff, dic] = await Promise.all([
      fetch(`${process.env.PUBLIC_URL || ''}/spellcheck/ru.aff`).then((r) => {
        if (!r.ok) throw new Error('ru.aff');
        return r.text();
      }),
      fetch(`${process.env.PUBLIC_URL || ''}/spellcheck/ru.dic`).then((r) => {
        if (!r.ok) throw new Error('ru.dic');
        return r.text();
      }),
    ]);
    const instance = new Typo('ru_RU', aff, dic);
    typo = instance;
    return instance;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

function normalizeForCheck(word: string): string {
  return word.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
}

/** Стоит ли проверять токен (короткие, числа, одноразовые коды — нет). */
export function shouldCheckWord(word: string): boolean {
  if (word.length < 2) return false;
  if (/^\d+$/.test(word)) return false;
  if (!/[А-Яа-яЁёA-Za-z]/.test(word)) return false;
  // Смешанный «код» вроде Abc12 — пропускаем
  if (/\d/.test(word)) return false;
  return true;
}

export function isWordCorrect(word: string): boolean {
  if (!typo || !shouldCheckWord(word)) return true;
  const key = word.toLowerCase();
  if (ignored.has(key) || personal.has(key)) return true;
  if (typo.check(word)) return true;
  // Typo иногда чувствителен к ё
  const alt = normalizeForCheck(word);
  if (alt !== word && typo.check(alt)) return true;
  return false;
}

export function suggestWords(word: string, limit = 5): string[] {
  if (!typo) return [];
  try {
    const raw = typo.suggest(word) || [];
    return raw.slice(0, limit);
  } catch {
    return [];
  }
}

export function ignoreWord(word: string) {
  ignored.add(word.toLowerCase());
  writeSet(IGNORE_KEY, ignored);
}

export function addPersonalWord(word: string) {
  personal.add(word.toLowerCase());
  writeSet(PERSONAL_KEY, personal);
}

export interface WordRange {
  word: string;
  start: number;
  end: number;
}

export function findMisspellings(text: string): WordRange[] {
  if (!typo || !text) return [];
  const out: WordRange[] = [];
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text))) {
    const word = m[0];
    if (!isWordCorrect(word)) {
      out.push({ word, start: m.index, end: m.index + word.length });
    }
  }
  return out;
}

export function wordAtIndex(text: string, index: number): WordRange | null {
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    if (index >= start && index <= end) {
      return { word: m[0], start, end };
    }
  }
  return null;
}

export function replaceRange(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end);
}

/** Программно меняет value у controlled input так, чтобы React увидел событие. */
export function setNativeInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function isSpellcheckTarget(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el.disabled || el.readOnly) return false;
  if (el.dataset.nospellcheck === 'true') return false;
  if (el instanceof HTMLTextAreaElement) return true;
  const type = (el.type || 'text').toLowerCase();
  if (['password', 'number', 'email', 'tel', 'date', 'time', 'datetime-local', 'month', 'week', 'color', 'range', 'file', 'hidden', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(type)) {
    return false;
  }
  return true;
}
