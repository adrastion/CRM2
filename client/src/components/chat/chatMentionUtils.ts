import React from 'react';

/** Маркер упоминания в тексте: @[TYPE:id|Имя] */
export const MENTION_TOKEN_RE = /@\[([A-Z_]+):([^\]|]+)\|([^\]]+)\]/g;

export type MentionRef = { type: string; id: string; name: string };

export function buildMentionToken(type: string, id: string, name: string): string {
  const safeName = String(name || 'Участник').replace(/[\[\]]/g, '');
  return `@[${type}:${id}|${safeName}]`;
}

export function extractMentionsFromText(text: string): MentionRef[] {
  const out: MentionRef[] = [];
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ type: m[1], id: m[2], name: m[3] });
  }
  return out;
}

/** Для поля ввода: токены → только имя (без @ и без @[TYPE:id|…]). */
export function renderMentionPlain(text: string): string {
  return String(text || '').replace(MENTION_TOKEN_RE, (_full, _t, _id, name) => String(name));
}

/** Для превью в списке чатов и подписей: токены → @Имя */
export function formatMentionsForDisplay(text: string): string {
  return String(text || '').replace(MENTION_TOKEN_RE, (_full, _t, _id, name) => `@${name}`);
}

type MentionHit = { start: number; end: number; mention: MentionRef };

function matchMentionsInDisplay(displayText: string, mentions: MentionRef[]): MentionHit[] {
  const hits: MentionHit[] = [];
  for (const mention of mentions) {
    const name = String(mention.name || '');
    if (!name) continue;
    let from = 0;
    while (from <= displayText.length) {
      const start = displayText.indexOf(name, from);
      if (start === -1) break;
      const end = start + name.length;
      const overlap = hits.some((h) => start < h.end && end > h.start);
      if (!overlap) {
        hits.push({ start, end, mention });
        break;
      }
      from = start + 1;
    }
  }
  return hits;
}

/** Оставляет только те упоминания, чьё имя ещё есть в display-тексте. */
export function pruneMentionsToDisplay(displayText: string, mentions: MentionRef[]): MentionRef[] {
  return matchMentionsInDisplay(displayText, mentions).map((h) => h.mention);
}

/**
 * Display-текст (имена) → storage body с токенами @[TYPE:id|Имя]
 * и список mentions для API.
 */
export function encodeMentionsForSend(
  displayText: string,
  mentions: MentionRef[]
): { body: string; mentions: MentionRef[] } {
  const hits = matchMentionsInDisplay(displayText, mentions);
  hits.sort((a, b) => b.start - a.start);
  let body = displayText;
  for (const h of hits) {
    const token = buildMentionToken(h.mention.type, h.mention.id, h.mention.name);
    body = body.slice(0, h.start) + token + body.slice(h.end);
  }
  hits.sort((a, b) => a.start - b.start);
  return {
    body,
    mentions: hits.map((h) => h.mention),
  };
}

/** Разбивает текст на фрагменты с подсветкой @[TYPE:id|Имя] → @Имя (цвет primary). */
export function renderMentionNodes(
  text: string,
  keyPrefix = 'm',
  mentionColor = '#4880FF'
): React.ReactNode[] {
  const src = String(text || '');
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g');
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) nodes.push(src.slice(last, m.index));
    nodes.push(
      React.createElement(
        'strong',
        {
          key: `${keyPrefix}-${i++}`,
          style: { fontWeight: 700, color: mentionColor },
        },
        `@${m[3]}`
      )
    );
    last = m.index + m[0].length;
  }
  if (last < src.length) nodes.push(src.slice(last));
  return nodes.length ? nodes : [src];
}
