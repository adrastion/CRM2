/** JSON-профиль ADMIN / PROMOTER в User.profileMeta */

export type AdminProfileMeta = {
  responsibilityZone?: string;
  position?: string;
  experience?: string | number;
  comment?: string;
  permissions?: string[];
  branchId?: string;
};

export type PromoterProfileMeta = {
  dateOfBirth?: string;
  workArea?: string;
  workRadiusKm?: string | number;
  pricePerShift?: string | number;
  pricePerClient?: string | number;
  transport?: string;
  socialLink?: string;
  notes?: string;
  branchId?: string;
};

export type StaffProfileMeta = AdminProfileMeta & PromoterProfileMeta;

export function parseStaffProfileMeta(raw?: string | null | object): StaffProfileMeta {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as StaffProfileMeta;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? (parsed as StaffProfileMeta) : {};
  } catch {
    return {};
  }
}

export function buildAdminProfileMeta(input: AdminProfileMeta): string {
  const meta: AdminProfileMeta = {};
  if (input.responsibilityZone != null && String(input.responsibilityZone).trim()) {
    meta.responsibilityZone = String(input.responsibilityZone).trim();
  }
  if (input.position != null && String(input.position).trim()) {
    meta.position = String(input.position).trim();
  }
  if (input.experience != null && String(input.experience).trim() !== '') {
    meta.experience = input.experience;
  }
  if (input.comment != null && String(input.comment).trim()) {
    meta.comment = String(input.comment).trim();
  }
  if (Array.isArray(input.permissions)) {
    meta.permissions = input.permissions;
  }
  if (input.branchId) meta.branchId = input.branchId;
  return JSON.stringify(meta);
}

export function buildPromoterProfileMeta(input: PromoterProfileMeta): string {
  const meta: PromoterProfileMeta = {};
  if (input.dateOfBirth) meta.dateOfBirth = String(input.dateOfBirth);
  if (input.workArea != null && String(input.workArea).trim()) {
    meta.workArea = String(input.workArea).trim();
  }
  if (input.workRadiusKm != null && String(input.workRadiusKm).trim() !== '') {
    meta.workRadiusKm = input.workRadiusKm;
  }
  if (input.pricePerShift != null && String(input.pricePerShift).trim() !== '') {
    meta.pricePerShift = input.pricePerShift;
  }
  if (input.pricePerClient != null && String(input.pricePerClient).trim() !== '') {
    meta.pricePerClient = input.pricePerClient;
  }
  if (input.transport != null && String(input.transport).trim()) {
    meta.transport = String(input.transport).trim();
  }
  if (input.socialLink != null && String(input.socialLink).trim()) {
    meta.socialLink = String(input.socialLink).trim();
  }
  if (input.notes != null && String(input.notes).trim()) {
    meta.notes = String(input.notes).trim();
  }
  if (input.branchId) meta.branchId = input.branchId;
  return JSON.stringify(meta);
}

export function getEmployeeProfileMeta(employee: any): StaffProfileMeta {
  const u = employee?.user || employee;
  return parseStaffProfileMeta(u?.profileMeta || employee?.profileMeta);
}
