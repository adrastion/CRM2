/**
 * Публичный API офлайн-слоя для страниц (календарь / посещаемость / контакты).
 */
export {
  getCachedAttendances,
  getCachedContacts,
  getCachedTrainings,
  initOfflineLayer,
  pullOfflineSnapshots,
  queueAttendanceMark,
  flushOutbox,
  getOfflineStatus,
  subscribeOfflineStatus,
} from './sync';
