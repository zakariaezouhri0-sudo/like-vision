
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
 * Convertit une chaîne de caractères en nombre propre (gère virgules et espaces).
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
 * Par défaut, n'affiche plus "DH" pour épurer l'interface selon la demande utilisateur.
 */
export function formatCurrency(amount: number | string, includeSymbol: boolean = false): string {
  const num = typeof amount === 'string' ? parseAmount(amount) : (amount || 0);
  const rounded = roundAmount(num);
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

/**
 * Envoie un message WhatsApp professionnel (Arabe & Français) avec emojis.
 */
export function sendWhatsAppMessage(clientName: string, phoneNumber: string) {
  if (!phoneNumber) return;
  
  // Formatage international : 06... -> 2126...
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('0') 
    ? '212' + cleanPhone.substring(1) 
    : cleanPhone;

  // Modèles avec emojis UTF-8
  const msgAr = `السلام عليكم ${clientName} 👋، فريق Like Vision كيشكرك بزاف على الثقة ديالك فينا 👓✨. الطلبية ديالك تسجلات بنجاح ✅. غادي نعلموك غير توجد النظارات ديالك 📲. شكراً ليك ونهار مبروك! 🌟😎`;
  const msgFr = `Bonjour ${clientName} 👋, Toute l'équipe Like Vision vous remercie pour votre visite ✨👓. Votre commande a été enregistrée avec succès ✅. Nous vous contacterons dès qu'elle sera prête 📲. Merci pour votre confiance ! 😊🌟`;

  // Combinaison des deux messages pour un rendu bilingue professionnel
  const fullMessage = `${msgAr}\n\n---\n\n${msgFr}`;
  
  const encodedMsg = encodeURIComponent(fullMessage);
  const url = `https://wa.me/${formattedPhone}?text=${encodedMsg}`;

  window.open(url, '_blank');
}
