import React from 'react';

/**
 * Inline form-field error message.
 * Accepts a string or an array of strings (DRF renders `{field: ["msg"]}`),
 * and announces itself to assistive technology.
 */
export const FieldError = ({ id, message }) => {
  if (!message) return null;
  const text = Array.isArray(message) ? message.join(', ') : message;
  return (
    <span className="form-error-msg" role="alert" id={id}>
      {text}
    </span>
  );
};
