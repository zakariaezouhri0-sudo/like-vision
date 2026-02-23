import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formate un montant en DH selon les spécifications : 1 500,00 DH
 * (Espace pour les milliers, virgule pour les décimales)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/\s/g, ' ') // Assure un espace insécable standard
    .replace(',', ',')   // Garde la virgule
    + ' DH';
}
