import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function roundAmount(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function parseAmount(val: string | number): number {
  if (typeof val === 'number') return roundAmount(val);
  if (!val || val === "") return 0;
  const cleaned = val.toString().replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : roundAmount(parsed);
}

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
 * Formate un montant avec le suffixe MAD (utilisé dans les rapports et Excel)
 */
export function formatMAD(amount: number | string): string {
  const num = typeof amount === 'string' ? parseAmount(amount) : (amount || 0);
  const rounded = roundAmount(num);
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  
  return formatted.replace(/\s/g, '\u00A0') + '\u00A0MAD';
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.toString().replace(/\D/g, '');
  const formatted = cleaned.replace(/(\d{2})(?=\d)/g, '$1 ');
  return formatted.substring(0, 14);
}

/**
 * Fonction de secours pour WhatsApp utilisant Unicode Escape Sequences.
 * Copie dans le presse-papier et ouvre la discussion.
 */
export async function sendWhatsApp(phone: string, name: string) {
  if (!phone) return;
  
  // Message utilisant exclusivement des séquences Unicode pour les emojis
  const message = `السلام عليكم ${name} \uD83D\uDC4B، فريق Like Vision كيشكرك بزاف على الثقة ديالك فينا \uD83D\uDC53\u2728. الطلب ديالك تسجل بنجاح \u2705. غادي نعلموك غير يوجدو النظارات ديالك \uD83D\uDCF2. شكراً ليك ونهار مبروك! \uD83C\uDF1F\uD83D\uDE0E`;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(message);
    }
  } catch (err) {
    console.error("Erreur clipboard:", err);
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '212' + cleanPhone.substring(1) : cleanPhone;
  window.open(`https://wa.me/${formattedPhone}`, '_blank');
}

export const copyAndOpenWhatsApp = sendWhatsApp;
