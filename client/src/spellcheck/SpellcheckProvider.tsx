import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Divider, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import {
  addPersonalWord,
  findMisspellings,
  ignoreWord,
  isSpellcheckReady,
  isSpellcheckTarget,
  loadRuSpell,
  replaceRange,
  setNativeInputValue,
  suggestWords,
  wordAtIndex,
  WordRange,
} from './ruSpellEngine';

const DEBOUNCE_MS = 160;

const STYLE_ID = 'crm-spellcheck-style';

function ensureSpellStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-spell-underline="1"] {
      position: absolute;
      pointer-events: none;
      z-index: 2;
      height: 3px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3' viewBox='0 0 6 3'%3E%3Cpath d='M0 2 Q1.5 0 3 2 Q4.5 4 6 2' fill='none' stroke='%23e53935' stroke-width='1'/%3E%3C/svg%3E");
      background-repeat: repeat-x;
      background-position: left bottom;
      background-size: 6px 3px;
    }
  `;
  document.head.appendChild(style);
}

type MenuState = {
  anchorPosition: { top: number; left: number };
  field: HTMLInputElement | HTMLTextAreaElement;
  range: WordRange;
  suggestions: string[];
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Зеркало поверх поля (невидимо) — только для измерения координат слов. */
function createMeasureMirror(field: HTMLInputElement | HTMLTextAreaElement): HTMLDivElement {
  const cs = window.getComputedStyle(field);
  const fr = field.getBoundingClientRect();
  const mirror = document.createElement('div');
  const isArea = field instanceof HTMLTextAreaElement;

  Object.assign(mirror.style, {
    position: 'fixed',
    left: `${fr.left}px`,
    top: `${fr.top}px`,
    width: `${fr.width}px`,
    height: `${fr.height}px`,
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
    overflow: 'auto',
    whiteSpace: isArea ? 'pre-wrap' : 'pre',
    wordWrap: 'break-word',
    overflowWrap: 'anywhere',
    boxSizing: 'border-box',
    font: cs.font,
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    letterSpacing: cs.letterSpacing,
    lineHeight: cs.lineHeight,
    textAlign: cs.textAlign,
    textTransform: cs.textTransform,
    textIndent: cs.textIndent,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    borderTopWidth: cs.borderTopWidth,
    borderRightWidth: cs.borderRightWidth,
    borderBottomWidth: cs.borderBottomWidth,
    borderLeftWidth: cs.borderLeftWidth,
    borderStyle: 'solid',
    borderColor: 'transparent',
    margin: '0',
  } as CSSStyleDeclaration);

  document.body.appendChild(mirror);
  return mirror;
}

function measureMissRects(
  field: HTMLInputElement | HTMLTextAreaElement,
  misses: WordRange[]
): Array<{ left: number; top: number; width: number }> {
  if (!misses.length) return [];

  const fieldRect = field.getBoundingClientRect();
  const mirror = createMeasureMirror(field);
  const text = field.value;
  let html = '';
  let cursor = 0;
  for (let i = 0; i < misses.length; i += 1) {
    const m = misses[i];
    html += escapeHtml(text.slice(cursor, m.start));
    html += `<span data-m="${i}">${escapeHtml(m.word)}</span>`;
    cursor = m.end;
  }
  html += escapeHtml(text.slice(cursor));
  mirror.innerHTML = html || '&nbsp;';
  mirror.scrollTop = field.scrollTop;
  mirror.scrollLeft = field.scrollLeft;

  const out: Array<{ left: number; top: number; width: number }> = [];
  for (let i = 0; i < misses.length; i += 1) {
    const span = mirror.querySelector(`[data-m="${i}"]`) as HTMLElement | null;
    if (!span) continue;
    const rects = span.getClientRects();
    for (let r = 0; r < rects.length; r += 1) {
      const rect = rects[r];
      if (rect.width < 1) continue;
      // Координаты относительно видимой области поля (слой совпадает с field)
      out.push({
        left: rect.left - fieldRect.left,
        top: rect.bottom - fieldRect.top - 3,
        width: rect.width,
      });
    }
  }

  mirror.remove();
  return out;
}

/**
 * Проверка правописания как в Telegram: красные волны под ошибками
 * (текст и каретка в поле не трогаем) + ПКМ с заменами.
 */
const SpellcheckProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuOpenRef = useRef(false);
  const activeRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const missesRef = useRef<WordRange[]>([]);
  const debounceRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  menuOpenRef.current = Boolean(menu);

  const clearUnderlines = useCallback(() => {
    const layer = layerRef.current;
    if (layer) layer.innerHTML = '';
  }, []);

  const detachLayer = useCallback(() => {
    const field = activeRef.current;
    if (field) {
      field.spellcheck = true;
    }
    layerRef.current?.remove();
    layerRef.current = null;
    activeRef.current = null;
    missesRef.current = [];
  }, []);

  const paintUnderlines = useCallback(() => {
    const field = activeRef.current;
    const layer = layerRef.current;
    if (!field || !layer || !isSpellcheckReady()) return;

    const misses = findMisspellings(field.value);
    missesRef.current = misses;
    clearUnderlines();

    const marks = measureMissRects(field, misses);
    for (const mark of marks) {
      if (mark.top < -4 || mark.top > field.clientHeight + 4) continue;
      if (mark.left + mark.width < 0 || mark.left > field.clientWidth) continue;
      const el = document.createElement('div');
      el.dataset.spellUnderline = '1';
      el.style.left = `${mark.left}px`;
      el.style.top = `${mark.top}px`;
      el.style.width = `${mark.width}px`;
      layer.appendChild(el);
    }
  }, [clearUnderlines]);

  const schedulePaint = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(paintUnderlines);
    }, DEBOUNCE_MS);
  }, [paintUnderlines]);

  const syncLayerBox = useCallback(() => {
    const field = activeRef.current;
    const layer = layerRef.current;
    if (!field || !layer) return;
    const parent = field.parentElement;
    if (!parent) return;
    const fr = field.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    layer.style.left = `${fr.left - pr.left + parent.scrollLeft}px`;
    layer.style.top = `${fr.top - pr.top + parent.scrollTop}px`;
    layer.style.width = `${fr.width}px`;
    layer.style.height = `${fr.height}px`;
  }, []);

  const attachToField = useCallback(
    async (field: HTMLInputElement | HTMLTextAreaElement) => {
      if (activeRef.current === field && layerRef.current) {
        syncLayerBox();
        schedulePaint();
        return;
      }
      detachLayer();
      activeRef.current = field;

      try {
        await loadRuSpell();
      } catch {
        return;
      }
      if (activeRef.current !== field) return;

      field.spellcheck = false;

      const parent = field.parentElement;
      if (!parent) return;
      if (window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }

      const layer = document.createElement('div');
      layer.dataset.spellLayer = '1';
      Object.assign(layer.style, {
        position: 'absolute',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: '2',
      } as CSSStyleDeclaration);

      parent.appendChild(layer);
      layerRef.current = layer;
      syncLayerBox();
      paintUnderlines();
    },
    [detachLayer, paintUnderlines, schedulePaint, syncLayerBox]
  );

  useEffect(() => {
    // На телефонах оставляем нативную проверку орфографии браузера —
    // словарь и слой подчёркиваний сильно грузят слабые устройства.
    const mobileSpellOff = (() => {
      try {
        return (
          window.matchMedia('(pointer: coarse)').matches ||
          window.matchMedia('(max-width: 900px)').matches
        );
      } catch {
        return false;
      }
    })();
    if (mobileSpellOff) return;

    ensureSpellStyles();
    const idle = window.setTimeout(() => {
      void loadRuSpell().catch(() => undefined);
    }, 1200);

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (!isSpellcheckTarget(t)) return;
      void attachToField(t);
    };

    const onFocusOut = (e: FocusEvent) => {
      if (e.target !== activeRef.current) return;
      window.setTimeout(() => {
        if (document.activeElement !== activeRef.current && !menuOpenRef.current) {
          detachLayer();
        }
      }, 0);
    };

    const onInput = (e: Event) => {
      if (e.target === activeRef.current) schedulePaint();
    };

    const onScroll = (e: Event) => {
      if (e.target === activeRef.current) {
        syncLayerBox();
        paintUnderlines();
      }
    };

    const onResize = () => {
      if (!activeRef.current) return;
      syncLayerBox();
      schedulePaint();
    };

    const onContextMenu = (e: MouseEvent) => {
      const t = e.target;
      if (!isSpellcheckTarget(t) || !isSpellcheckReady()) return;
      const field = t;
      const idx = field.selectionStart ?? 0;
      const at = wordAtIndex(field.value, idx);
      if (!at) return;
      const misses = findMisspellings(field.value);
      const hit = misses.find((m) => m.start === at.start && m.end === at.end);
      if (!hit) return;

      e.preventDefault();
      e.stopPropagation();
      setMenu({
        anchorPosition: { top: e.clientY, left: e.clientX },
        field,
        range: hit,
        suggestions: suggestWords(hit.word),
      });
    };

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('resize', onResize);

    return () => {
      window.clearTimeout(idle);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('resize', onResize);
      detachLayer();
    };
  }, [attachToField, detachLayer, paintUnderlines, schedulePaint, syncLayerBox]);

  const closeMenu = () => setMenu(null);

  const applyReplacement = (replacement: string) => {
    if (!menu) return;
    const { field, range } = menu;
    const next = replaceRange(field.value, range.start, range.end, replacement);
    setNativeInputValue(field, next);
    field.focus();
    const caret = range.start + replacement.length;
    try {
      field.setSelectionRange(caret, caret);
    } catch {
      /* ignore */
    }
    closeMenu();
    schedulePaint();
  };

  return (
    <>
      {children}
      <Menu
        open={Boolean(menu)}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={menu?.anchorPosition}
        slotProps={{
          paper: { sx: { minWidth: 200 } },
        }}
      >
        {menu?.suggestions.length ? (
          menu.suggestions.map((s) => (
            <MenuItem key={s} onClick={() => applyReplacement(s)}>
              <ListItemText primary={s} primaryTypographyProps={{ fontWeight: 600 }} />
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              Нет вариантов
            </Typography>
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            if (!menu) return;
            ignoreWord(menu.range.word);
            closeMenu();
            schedulePaint();
          }}
        >
          <ListItemText primary="Пропустить" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!menu) return;
            addPersonalWord(menu.range.word);
            closeMenu();
            schedulePaint();
          }}
        >
          <ListItemText primary="Добавить в словарь" />
        </MenuItem>
      </Menu>
    </>
  );
};

export default SpellcheckProvider;
