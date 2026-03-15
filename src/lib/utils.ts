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
 * MÉTHODE DE SÉCURITÉ : Utilisation de encodeURIComponent sur l'intégralité du bloc UTF-8.
 */
export function sendWhatsAppMessage(clientName: string, phoneNumber: string) {
  if (!phoneNumber) return;
  
  const darija = `السلام عليكم ${clientName} 👋، فريق Like Vision كيشكرك بزاف على الثقة ديالك فينا 👓✨. الطلب ديالك تسجل بنجاح ✅. غادي نعلموك غير يوجدو النظارات ديالك 📲. شكراً ليك ونهار مبروك! 🌟😎`;
  
  const french = `Bonjour ${clientName} 👋, Toute l'équipe Like Vision vous remercie pour votre visite ✨👓. Votre commande a été enregistrée avec succès ✅. Nous vous contacterons dès qu'elle sera prête 📲. Merci pour votre confiance ! 😊🌟`;

  // Construction du message bilingue
  const fullMessage = darija + "\n\n---\n\n" + french;

  // THE FIX: Encode the message properly for URL support
  const encodedMsg = encodeURIComponent(fullMessage);
  
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('0') 
    ? '212' + cleanPhone.substring(1) 
    : cleanPhone;

  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMsg}`;

  // Ouverture de la fenêtre WhatsApp
  window.open(whatsappUrl, '_blank');
}
