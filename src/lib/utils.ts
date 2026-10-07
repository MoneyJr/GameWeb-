import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Объединяет классы Tailwind, разрешая конфликты. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Форматирует сумму в долларах: 5074 → "$ 5,074". */
export function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$ ${Math.abs(value).toLocaleString('en-US')}`
}
