export type ReaderSettings = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  pagePadding: number;
};

export type ChromeSettings = {
  headerHeight: number;
  footerHeight: number;
  headerGap: number;
  headerPadLeft: number;
  headerPadRight: number;
  headerMenuButtonSize: number;
  headerTitleFontSize: number;
  headerPageFontSize: number;
  footerChapterButtonWidth: number;
  footerChapterButtonMaxWidth: number;
  footerChapterButtonPadX: number;
  footerPageFontSize: number;
  footerPageCellPadX: number;
  footerPageButtonPadY: number;
  footerPageButtonPadX: number;
  iconMenuSize: number;
  iconChapterSize: number;
  iconPageSize: number;
  iconTableOfContentsSize: number;
};

export type ChromePreset = 'mobile' | 'tablet' | 'desktop';

export const readerSettings: ReaderSettings = {
  fontFamily: '"Noto Serif CJK TC", "Source Han Serif TC", PMingLiU, serif',
  fontSize: 26,
  lineHeight: 1.8,
  paragraphSpacing: 18,
  pagePadding: 24,
};

export const chromeSettingsMobile: ChromeSettings = {
  headerHeight: 48,
  footerHeight: 46,
  headerGap: 8,
  headerPadLeft: 6,
  headerPadRight: 8,
  headerMenuButtonSize: 38,
  headerTitleFontSize: 16,
  headerPageFontSize: 12,
  footerChapterButtonWidth: 48,
  footerChapterButtonMaxWidth: 56,
  footerChapterButtonPadX: 2,
  footerPageFontSize: 14,
  footerPageCellPadX: 4,
  footerPageButtonPadY: 4,
  footerPageButtonPadX: 8,
  iconMenuSize: 20,
  iconChapterSize: 18,
  iconPageSize: 20,
  iconTableOfContentsSize: 20,
};

export const chromeSettingsTablet: ChromeSettings = {
  headerHeight: 56,
  footerHeight: 52,
  headerGap: 12,
  headerPadLeft: 8,
  headerPadRight: 12,
  headerMenuButtonSize: 44,
  headerTitleFontSize: 18,
  headerPageFontSize: 13,
  footerChapterButtonWidth: 56,
  footerChapterButtonMaxWidth: 72,
  footerChapterButtonPadX: 4,
  footerPageFontSize: 16,
  footerPageCellPadX: 6,
  footerPageButtonPadY: 6,
  footerPageButtonPadX: 10,
  iconMenuSize: 22,
  iconChapterSize: 20,
  iconPageSize: 22,
  iconTableOfContentsSize: 22,
};

export const chromeSettingsDesktop: ChromeSettings = {
  headerHeight: 60,
  footerHeight: 56,
  headerGap: 14,
  headerPadLeft: 10,
  headerPadRight: 14,
  headerMenuButtonSize: 46,
  headerTitleFontSize: 19,
  headerPageFontSize: 14,
  footerChapterButtonWidth: 60,
  footerChapterButtonMaxWidth: 76,
  footerChapterButtonPadX: 6,
  footerPageFontSize: 17,
  footerPageCellPadX: 8,
  footerPageButtonPadY: 7,
  footerPageButtonPadX: 12,
  iconMenuSize: 24,
  iconChapterSize: 22,
  iconPageSize: 24,
  iconTableOfContentsSize: 24,
};

export function getChromePreset(width: number): ChromePreset {
  if (width <= 640) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

export function getChromeSettingsForPreset(preset: ChromePreset): ChromeSettings {
  if (preset === 'mobile') return chromeSettingsMobile;
  if (preset === 'desktop') return chromeSettingsDesktop;
  return chromeSettingsTablet;
}
