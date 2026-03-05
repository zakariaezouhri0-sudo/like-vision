import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Arrondit un nombre à 2 décimales pour la précision financière.
 * Utilise EPSILON pour éviter les erreurs d'arrondi binaire.
 */
export function roundAmount(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Formate un montant en format monétaire strict : 000,00
 * Par défaut, n'affiche plus "DH" pour épurer l'interface selon la demande utilisateur.
 */
export function formatCurrency(amount: number, includeSymbol: boolean = false): string {
  const rounded = roundAmount(amount || 0);
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  
  // Utilisation de \u00A0 (espace insécable) pour un rendu professionnel
  const value = formatted.replace(/\s/g, '\u00A0');
  return includeSymbol ? value + '\u00A0DH' : value;
}

/**
 * Formate un numéro de téléphone sous la forme : 06 00 00 00 00
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.toString().replace(/\D/g, '');
  const formatted = cleaned.replace(/(\d{2})(?=\d)/g, '$1 ');
  return formatted.substring(0, 14);
}
