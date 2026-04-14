import type { WebFontConfig } from './readerState';

export type LocalFontOption = {
  label: string;
  value: string;
  detectFamilies?: string[];
};

export const LOCAL_FONT_OPTIONS: LocalFontOption[] = [
  { label: '系統預設', value: 'serif' },
  {
    label: '思源宋體',
    value: '"Source Han Serif TC", "Source Han Serif", "Noto Serif CJK TC", "Noto Serif TC", "思源宋體", serif',
    detectFamilies: ['Source Han Serif TC', 'Source Han Serif', 'Noto Serif CJK TC', 'Noto Serif TC', '思源宋體'],
  },
  {
    label: '思源黑體',
    value: '"Source Han Sans TC", "Source Han Sans", "Noto Sans CJK TC", "Noto Sans TC", "思源黑體", sans-serif',
    detectFamilies: ['Source Han Sans TC', 'Source Han Sans', 'Noto Sans CJK TC', 'Noto Sans TC', '思源黑體'],
  },
  {
    label: '微軟正黑體',
    value: '"Microsoft JhengHei", sans-serif',
    detectFamilies: ['Microsoft JhengHei'],
  },
  {
    label: '新細明體',
    value: '"PMingLiU", serif',
    detectFamilies: ['PMingLiU'],
  },
];

const fontDetectCanvas = document.createElement('canvas');
const fontDetectCtx = fontDetectCanvas.getContext('2d');

export function isFontFamilyLikelyAvailable(family: string): boolean {
  if (!fontDetectCtx) return false;
  const text = 'abcdefghijklmnopqrstuvwxyz0123456789一二三四五六七八九十';
  const baseFamilies = ['monospace', 'serif', 'sans-serif'] as const;
  const baseWidths = baseFamilies.map((base) => {
    fontDetectCtx.font = `72px ${base}`;
    return fontDetectCtx.measureText(text).width;
  });
  fontDetectCtx.font = `72px "${family}", monospace`;
  const testWidth = fontDetectCtx.measureText(text).width;
  return !baseWidths.some((w) => Math.abs(testWidth - w) < 0.01);
}

export function isAnyFontFamilyAvailable(families: string[]): boolean {
  return families.some((family) => isFontFamilyLikelyAvailable(family));
}

export function getPresetWebFontConfig(presetId: string, weight: number): WebFontConfig | null {
  const clampedWeight = Math.max(100, Math.min(900, Math.round(weight / 100) * 100));
  if (presetId === 'noto-serif-tc') {
    return {
      cssUrl: `https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@${clampedWeight}&display=swap`,
      family: 'Noto Serif TC',
    };
  }
  if (presetId === 'noto-sans-tc') {
    return {
      cssUrl: `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@${clampedWeight}&display=swap`,
      family: 'Noto Sans TC',
    };
  }
  return null;
}

export function ensureWebFontStylesheet(
  cssUrl: string,
  currentLinkEl: HTMLLinkElement | null,
): HTMLLinkElement {
  if (currentLinkEl && currentLinkEl.href === cssUrl) return currentLinkEl;
  if (currentLinkEl) currentLinkEl.remove();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  document.head.appendChild(link);
  return link;
}

export async function loadWebFont(cssUrl: string, family: string): Promise<void> {
  const familyExpr = family.includes(',') ? family : `"${family}"`;
  await Promise.race([
    document.fonts.load(`16px ${familyExpr}`),
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);
}
