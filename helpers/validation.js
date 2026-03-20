// helpers/validation.js

export function isObject(value) {
  return value !== null && typeof value === 'object';
}

export function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

export function isSafeSearchToken(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._/-]+$/.test(value);
}

export function requireObject(value, label) {
  if (!isObject(value)) {
    throw new Error(`Bot context invalid: missing or invalid ${label}`);
  }
}

export function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Bot context invalid: missing or invalid ${label}`);
  }
}

export function requirePositiveInt(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Bot context invalid: missing or invalid ${label}`);
  }
}

export function requireSafeUsername(value, label) {
  requireNonEmptyString(value, label);
  if (!isSafeSearchToken(value)) {
    throw new Error(`Bot context invalid: ${label} contains invalid characters`);
  }
}