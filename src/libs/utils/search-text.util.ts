export function normalizeSearchText(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildUserSearchText(input: { email?: string | null; fullName?: string | null; phone?: string | null }): string {
  return normalizeSearchText([input.email, input.fullName, input.phone].filter(Boolean).join(' '));
}

export function buildCustomerSearchText(input: {
  code?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  identityNumber?: string | null;
  socialContact?: string | null;
}): string {
  return normalizeSearchText([input.code, input.name, input.phone, input.email, input.identityNumber, input.socialContact].filter(Boolean).join(' '));
}
