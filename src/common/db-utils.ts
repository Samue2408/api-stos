import { QueryFailedError } from 'typeorm';

/** Error 23505. `hint` filtra por el nombre de la constraint (p. ej. 'slug', 'email', 'code'). */
export function isUniqueViolation(e: unknown, hint?: string): boolean {
  if (!(e instanceof QueryFailedError)) return false;
  const d = e.driverError as { code?: string; constraint?: string };
  return d?.code === '23505' && (!hint || d.constraint?.includes(hint) === true);
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/** Construye WHERE con parámetros posicionales ($1, $2...) sin concatenar valores. */
export class WhereBuilder {
  private readonly clauses: string[] = [];
  readonly params: unknown[] = [];

  push(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
  add(clause: (placeholder: string) => string, value: unknown): void {
    this.clauses.push(clause(this.push(value)));
  }
  get sql(): string {
    return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }
}