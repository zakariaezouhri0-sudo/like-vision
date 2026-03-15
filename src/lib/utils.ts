
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Arrondit un nombre à 2 décimales pour la précision financière.
 */
export function roundAmount(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Convertit une chaîne de caractères en nombre propre.
 */
export function parseAmount(val: string | number): number {
  if (typeof val === 'number') return roundAmount(val);
  if (!val || val === "") return 0;
  const cleaned = val.toString().replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : roundAmount(parsed);
}

/**
 * Formate un montant en format monétaire strict : 000,00
 */
export function formatCurrency(amount: number | string, includeSymbol: boolean = false): string {
  const num = typeof amount === 'string' ? parseAmount(amount) : (amount || 0);
  const rounded = roundAmount(num);
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  
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

/**
 * STRATÉGIE ROBUSTE : Copie le message dans le presse-papier et ouvre WhatsApp.
 * Cela évite TOUS les problèmes d'encodage URL avec l'arabe et les emojis.
 */
export async function copyAndOpenWhatsApp(clientName: string, phoneNumber: string, templateDarija?: string, templateFrench?: string) {
  if (!phoneNumber) return;
  
  // Templates par défaut avec séquences Unicode
  const defDarija = "السلام عليكم [Nom] \uD83D\uDC4B\u060C \u0641\u0631\u064a\u0642 Like Vision \u0643\u064a\u0634\u0643\u0631\u0643 \u0628\u0632\u0627\u0641 \u0639\u0644\u0649 \u0627\u0644\u062b\u0642\u0629 \u062f\u064a\u0627\u0644\u0643 \u0641\u064a\u0646\u0627 \u2728. \u0627\u0644\u0637\u0644\u0628 \u062f\u064a\u0627\u0644\u0643 \u062a\u0633\u062c\u0644 \u0628\u0646\u062c\u0627\u062d \u2705. \u063a\u0627\u062f\u064a \u0646\u0639\u0644\u0645\u0648\u0643 \u063a\u064a\u0631 \u064a\u0648\u062c\u062f\u0648 \u0627\u0644\u0646\u0638\u0627\u0631\u0627\u062a \u062f\u064a\u0627\u0644\u0643 \uD83D\uDC53. \u0634\u0643\u0631\u0627\u064b \u0644\u064a\u0643 \u0648\u0646\u0647\u0627\u0631 \u0645\u0628\u0631\u0648\u0643! \uD83C\uDF1F\uD83D\uDE0E";
  const defFrench = "Bonjour [Nom] \uD83D\uDC4B, Toute l'équipe Like Vision vous remercie pour votre visite \u2728. Votre commande a été enregistrée avec succès \u2705. Nous vous contacterons dès qu'elle sera prête \uD83D\uDC53. Merci pour votre confiance ! \uD83D\uDE0A\uD83C\uDF1F";

  const msgDarija = (templateDarija || defDarija).replace(/\[Nom\]/g, clientName);
  const msgFrench = (templateFrench || defFrench).replace(/\[Nom\]/g, clientName);

  const fullMessage = `${msgDarija}\n\n---\n\n${msgFrench}`;

  // 1. Copie dans le presse-papier
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(fullMessage);
      alert("\u2705 Message copié !\n\nCollez le message (Ctrl+V) dans la discussion WhatsApp qui va s'ouvrir.");
    }
  } catch (err) {
    console.error("Erreur clipboard:", err);
  }

  // 2. Ouverture de WhatsApp (discussion vide pour éviter les bugs d'encodage URL)
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '212' + cleanPhone.substring(1) : cleanPhone;
  window.open(`https://wa.me/${formattedPhone}`, '_blank');
}
