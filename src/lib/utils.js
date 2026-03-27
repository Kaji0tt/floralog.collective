import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/**
 * Returns a dynamic font-size (in rem) so that a display name fits on a single line.
 * The formula scales the size down proportionally with the name length,
 * bounded between 0.75 rem (minimum readable size) and 2.25 rem (max heading size).
 *
 * The scaling factor (20) is derived from the available container width on mobile
 * (~215 px) divided by the average bold-character width at 1 rem (~10.75 px):
 *   fontSize (rem) = min(2.25, max(0.75, 20 / nameLength))
 */
export function getNameFontSize(name) {
  const len = (name || '').length;
  if (!len) return '2.25rem';
  return `${Math.max(0.75, Math.min(2.25, 20 / len)).toFixed(2)}rem`;
}
