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
