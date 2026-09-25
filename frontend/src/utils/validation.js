export function isValidEmail(email) {
  if (!email) return true; // optional unless required
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7;
}

export function extractErrorMessage(error, defaultMessage = 'An unexpected error occurred') {
  if (!error) return defaultMessage;
  if (error.response?.data) {
    const data = error.response.data;
    if (data.message) return data.message;
    if (data.detail) return data.detail;
    if (data.errors) {
      const firstKey = Object.keys(data.errors)[0];
      const errVal = data.errors[firstKey];
      if (Array.isArray(errVal) && errVal.length > 0) {
        return `${firstKey}: ${errVal[0]}`;
      }
      return `${firstKey}: ${errVal}`;
    }
  }
  return error.message || defaultMessage;
}

// Split a DRF error payload into per-field messages plus a form-level
// summary for keys that belong to no rendered field (non_field_errors…).
export function normalizeServerErrors(errors) {
  const fieldErrors = {};
  const summary = [];
  if (!errors || typeof errors !== 'object') return { fieldErrors, summary };
  for (const [key, value] of Object.entries(errors)) {
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    if (['non_field_errors', 'detail', 'message'].includes(key)) {
      summary.push(text);
    } else {
      fieldErrors[key] = text;
    }
  }
  return { fieldErrors, summary };
}
// Blob-aware variant for endpoints requested with responseType: 'blob'
// (e.g. CSV exports) where error payloads also arrive as Blobs.
export async function extractBlobErrorMessage(error, defaultMessage = 'An unexpected error occurred') {
  try {
    const data = error?.response?.data;
    if (data instanceof Blob) {
      const text = await data.text();
      try {
        const parsed = JSON.parse(text);
        return parsed.message || parsed.detail || parsed.error || defaultMessage;
      } catch {
        return text.slice(0, 200) || defaultMessage;
      }
    }
  } catch {
    // fall through to the standard extractor below
  }
  return extractErrorMessage(error, defaultMessage);
}
