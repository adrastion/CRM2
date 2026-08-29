/**
 * Конфигурация Jest для тестов клиента (CRA подхватывает файл автоматически).
 */

// React 18 требует явного флага, иначе act() печатает предупреждение
// «The current testing environment is not configured to support act(...)».
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export {};
