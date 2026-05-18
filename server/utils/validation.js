export const nameRegex = /^[A-Za-z ]+$/;
export const phoneRegex = /^[0-9]{10}$/;
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const consecutiveSpaceRegex = /\s{2,}/;

export const normalizeName = (value = "") => {
  const trimmed = value.trim();
  return trimmed.replace(/\s+/g, " ");
};

export const isValidName = (value = "") => {
  if (!value) return false;
  const trimmed = value.trim();
  if (consecutiveSpaceRegex.test(trimmed)) return false;
  const normalized = normalizeName(value);
  if (normalized.length < 2 || normalized.length > 50) return false;
  return nameRegex.test(normalized);
};

export const normalizePhone = (value = "") => value.replace(/[^0-9]/g, "");

export const isValidPhone = (value = "") => {
  if (!value) return false;
  return phoneRegex.test(value);
};

export const isValidEmail = (value = "") => {
  if (!value) return false;
  return emailRegex.test(value.trim().toLowerCase());
};
