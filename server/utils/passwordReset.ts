import { createHash, randomBytes } from 'node:crypto'

/** Час життя токена відновлення паролю — 1 година */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

/** Мінімальна довжина паролю */
export const MIN_PASSWORD_LENGTH = 8

/** Генерує криптостійкий токен (повертається користувачу в посиланні). */
export function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}

/** Хешує токен для зберігання в БД (у базі ніколи не лежить сам токен). */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Перевіряє пароль на мінімальні вимоги.
 * Кидає 400, якщо пароль закороткий.
 */
export function assertPasswordStrong(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів`,
    })
  }
}
