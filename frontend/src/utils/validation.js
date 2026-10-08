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
    const errObj = data.errors || (typeof data === 'object' && !Array.isArray(data) ? data : null);
    if (errObj && typeof errObj === 'object') {
      const ignoredKeys = new Set(['missing', 'missing_messages', 'missing_details', 'target_stage_id', 'target_stage_name', 'success']);
      const keys = Object.keys(errObj).filter((k) => !ignoredKeys.has(k));
      if (keys.length > 0) {
        const firstKey = keys[0];
        const errVal = errObj[firstKey];
        if (Array.isArray(errVal) && errVal.length > 0) {
          const valStr = String(errVal[0]);
          return firstKey === 'non_field_errors' || firstKey === 'stage' || valStr.toLowerCase().startsWith(firstKey.toLowerCase())
            ? valStr
            : `${firstKey}: ${valStr}`;
        }
        if (typeof errVal === 'string') {
          return firstKey === 'non_field_errors' || firstKey === 'stage' || errVal.toLowerCase().startsWith(firstKey.toLowerCase())
            ? errVal
            : `${firstKey}: ${errVal}`;
        }
      }
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
