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
 * Envoie un message WhatsApp professionnel (Arabe & Français).
 * MÉTHODE DE SÉCURITÉ ABSOLUE : Utilisation des paires Unicode pour garantir l'affichage des emojis.
 */
export function sendWhatsAppMessage(clientName: string, phoneNumber: string) {
  if (!phoneNumber) return;
  
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('0') 
    ? '212' + cleanPhone.substring(1) 
    : cleanPhone;

  // Définition des symboles via codes Unicode robustes (UTF-16)
  const wave = "\uD83D\uDC4B";      // 👋
  const glasses = "\uD83D\uDC53";   // 👓
  const sparkles = "\u2728";        // ✨
  const check = "\u2705";           // ✅
  const mobile = "\uD83D\uDCF2";    // 📲
  const star = "\uD83C\uDF1F";      // 🌟
  const cool = "\uD83D\uDE0E";      // 😎
  const smile = "\uD83D\uDE0A";     // 😊

  // Construction des messages avec les textes exacts demandés
  const msgAr = "السلام عليكم " + clientName + " " + wave + "، فريق Like Vision كيشكرك بزاف على الثقة ديالك فينا " + glasses + sparkles + ". الطلب ديالك تسجل بنجاح " + check + ". غادي نعلموك غير يوجدو النظارات ديالك " + mobile + ". شكراً ليك ونهار مبروك! " + star + cool;
  const msgFr = "Bonjour " + clientName + " " + wave + ", Toute l'équipe Like Vision vous remercie pour votre visite " + sparkles + glasses + ". Votre commande a été enregistrée avec succès " + check + ". Nous vous contacterons dès qu'elle sera prête " + mobile + ". Merci pour votre confiance ! " + smile + star;

  // Encodage complet du bloc bilingue
  const fullText = msgAr + "\n\n---\n\n" + msgFr;
  const encodedText = encodeURIComponent(fullText);
  
  const whatsappUrl = "https://wa.me/" + formattedPhone + "?text=" + encodedText;

  // Ouverture sécurisée
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}
