/** Validation utilities. Pure functions — fully unit-testable. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export interface FieldErrors {
  [field: string]: string | undefined;
}

export function validateLoginForm(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Email is required";
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address";
  if (!password) errors.password = "Password is required";
  else if (password.length < 6) errors.password = "Password must be at least 6 characters";
  return errors;
}

export function validateBatchForm(name: string, existingNames: string[], currentId?: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = "Batch name is required";
  else if (trimmed.length > 50) errors.name = "Batch name must be 50 characters or fewer";
  else if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== currentId))
    errors.name = "A batch with this name already exists";
  return errors;
}

export function validateRecipientForm(
  name: string,
  email: string,
  existingEmails: string[]
): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Name is required";
  if (!email.trim()) errors.email = "Email is required";
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address";
  else if (existingEmails.some((e) => e.toLowerCase() === email.trim().toLowerCase()))
    errors.email = "This email already exists in this batch";
  return errors;
}

export function validateCcEmail(value: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!value.trim()) errors.ccEmail = "CC email is required";
  else if (!isValidEmail(value)) errors.ccEmail = "Enter a valid email address";
  return errors;
}

export function validateChangePassword(current: string, next: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!current) errors.currentPassword = "Current password is required";
  if (!next) errors.newPassword = "New password is required";
  else if (next.length < 8) errors.newPassword = "New password must be at least 8 characters";
  else if (next === current) errors.newPassword = "New password must be different from the current password";
  if (!confirm) errors.confirmPassword = "Please confirm your new password";
  else if (confirm !== next) errors.confirmPassword = "Passwords do not match";
  return errors;
}
