export interface ClientNameParts {
  firstName: string;
  lastName: string;
  middleName?: string | null;
}

/** ФИО клиента в формате «Фамилия Имя Отчество». */
export function formatClientFullName(client: ClientNameParts): string {
  const full = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
  return full || `${client.firstName} ${client.lastName}`.trim();
}
