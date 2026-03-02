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
 * Formate un montant en DH selon les spécifications : 1 500,00 DH
 */
export function formatCurrency(amount: number): string {
  const rounded = roundAmount(amount || 0);
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  
  // Utilisation de \u00A0 (espace insécable) pour un rendu professionnel
  return formatted.replace(/\s/g, '\u00A0') + '\u00A0DH';
}

/**
 * Formate un numéro de téléphone sous la forme : 06 00 00 00 00
 * Fonction flexible qui groupe par 2 chiffres au fur et à mesure.
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  // Nettoyer tous les caractères non numériques
  const cleaned = phone.toString().replace(/\D/g, '');
  // Grouper par 2 avec des espaces
  const formatted = cleaned.replace(/(\d{2})(?=\d)/g, '$1 ');
  // Limiter à 10 chiffres (5 groupes de 2)
  return formatted.substring(0, 14);
}
