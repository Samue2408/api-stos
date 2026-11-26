import { BadRequestException } from '@nestjs/common';

const COMMON = new Set([
  'password', 'password1', 'contrasena', 'contraseña', 'contrasena1', 'qwertyuiop', 'asdfghjkl',
  'admin12345', 'welcome123', 'letmein123', 'iloveyou12', '1234567890', '12345678910',
]);

export type PolicyError = 'too_short' | 'too_long' | 'too_common' | 'only_digits' | 'contains_email' | 'same_as_current';

export function checkPasswordPolicy(password: string, email: string): PolicyError[] {
  const errors: PolicyError[] = [];
  const lower = password.toLowerCase();
  const local = email.split('@')[0].toLowerCase();

  if (password.length < 10) errors.push('too_short');
  if (password.length > 128) errors.push('too_long');
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) errors.push('too_common'); // comun o caracter repetido
  if (/^\d+$/.test(password)) errors.push('only_digits');
  if (local.length >= 3 && lower.includes(local)) errors.push('contains_email');
  return errors;
}

export function assertPasswordPolicy(errors: PolicyError[]): void {
  if (errors.length) {
    throw new BadRequestException({ message: 'La contraseña no cumple la política', code: 'WEAK_PASSWORD', errors });
  }
}