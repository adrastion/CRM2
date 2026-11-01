/**
 * Реквизиты оператора платформы (как на странице «Контакты»).
 * Должны совпадать с client/src/constants/platformOperator.ts.
 */
export const PLATFORM_OPERATOR = {
  fullName: 'Индивидуальный предприниматель Карась Сергей Сергеевич',
  shortName: 'ИП Карась Сергей Сергеевич',
  inn: '331104002146',
  ogrnip: '323330000033789',
  email: 'profsportcrm@yandex.ru',
  legalAddress: 'Владимирская область, Александровский район город Струнино, ул. Заречная, д. 10',
  bankName: 'ПАО Сбербанк',
  bankBik: '044525225',
  bankAccount: '40802810338000045634',
  bankCorrAccount: '30101810400000000225',
} as const;

export type PlatformOperator = typeof PLATFORM_OPERATOR;
