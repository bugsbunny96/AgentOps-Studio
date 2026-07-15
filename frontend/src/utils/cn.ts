import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes safely — resolves conflicts, removes duplicates. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
