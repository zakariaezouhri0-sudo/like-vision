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
 * Envoie un message WhatsApp professionnel en utilisant des templates personnalisables.
 */
export function sendWhatsAppMessage(clientName: string, phoneNumber: string, templateDarija?: string, templateFrench?: string) {
  if (!phoneNumber) return;
  
  // Templates par défaut si non fournis
  const defDarija = `السلام عليكم [Nom] \uD83D\uDC4B، فريق Like Vision كيشكرك بزاف على الثقة ديالك فينا \u2728. الطلب ديالك تسجل بنجاح \u2705. غادي نعلموك غير يوجدو النظارات ديالك \uD83D\uDC53. شكراً ليك ونهار مبروك! \uD83C\uDF1F\uD83D\uDE0E`;
  const defFrench = `Bonjour [Nom] \uD83D\uDC4B, Toute l'équipe Like Vision vous remercie pour votre visite \u2728. Votre commande a été enregistrée avec succès \u2705. Nous vous contacterons dès qu'elle sera prête \uD83D\uDC53. Merci pour votre confiance ! \uD83D\uDE0A\uD83C\uDF1F`;

  const msgDarija = (templateDarija || defDarija).replace('[Nom]', clientName);
  const msgFrench = (templateFrench || defFrench).replace('[Nom]', clientName);

  const fullMessage = msgDarija + "\n\n---\n\n" + msgFrench;

  // Formatage du numéro et encodage URL
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('0') 
    ? '212' + cleanPhone.substring(1) 
    : cleanPhone;

  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(fullMessage)}`;

  window.open(url, '_blank');
}
