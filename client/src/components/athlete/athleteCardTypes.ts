import { Client, ClientStandard, Parent } from '../../types';

export type AthleteCardMode = 'staff' | 'client';

export type AthleteStatus = 'active' | 'pause' | 'injury' | 'left';

export type ParentRelationType = 'mother' | 'father' | 'guardian' | 'other';

export interface AthleteCompetitionResultRow {
  id: string;
  result?: string | null;
  resultValue?: number | null;
  category?: string | null;
  performanceTime?: string | null;
  competition?: {
    id: string;
    name: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    date?: string;
  };
}

export interface AthleteCalendarEvent {
  id: string;
  title?: string;
  name?: string;
  startTime?: string;
  startDate?: string;
  endTime?: string;
  endDate?: string;
  type: 'training' | 'competition';
  groupName?: string | null;
  location?: string | null;
}

export interface AthleteCardData extends Client {
  standards?: ClientStandard[];
  clientStandards?: ClientStandard[];
  competitionResults?: AthleteCompetitionResultRow[];
  calendar?: {
    trainings?: any[];
    competitions?: any[];
  };
  parents?: Parent[];
}

export interface AthleteCardProps {
  mode: AthleteCardMode;
  /** Staff: id клиента. Client: id выбранного спортсмена (опционально). */
  clientId?: string;
  /** Готовые данные — если переданы, отдельная загрузка не нужна. */
  initialData?: AthleteCardData | null;
  /** После сохранения (staff). */
  onSaved?: (client: AthleteCardData) => void;
  /** Закрытие хоста (staff dialog). */
  onClose?: () => void;
  /** Документы закрыты (задел RBAC). */
  docsAccess?: 'full' | 'denied';
  compact?: boolean;
}

export const ATHLETE_STATUS_LABELS: Record<string, string> = {
  active: 'Активный',
  pause: 'Пауза',
  injury: 'Травма',
  left: 'Выбыл',
};

export const RELATION_LABELS: Record<string, string> = {
  mother: 'Мать',
  father: 'Отец',
  guardian: 'Опекун',
  other: 'Другой',
};

export const GENDER_LABELS: Record<string, string> = {
  male: 'Мужской',
  female: 'Женский',
  other: 'Другой',
};
