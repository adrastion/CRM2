import { scrollToId } from './LandingShared';

/** Единые якоря главной для шапки на всех вариантах лендинга. */
export const landingPageAnchors = () => [
  { label: 'Школам', onClick: () => scrollToId('schools') },
  { label: 'Ученикам', onClick: () => scrollToId('clients') },
  { label: 'Мнение', onClick: () => scrollToId('feedback') },
];
