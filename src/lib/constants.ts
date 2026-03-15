export const ROLES = {
  ADMIN: 'ADMIN',
  OPTICIENNE: 'OPTICIENNE',
};

export const MUTUELLES = [
  'Aucun',
  'CNOPS',
  'CNSS',
  'FAR',
  'AXA',
  'Autre',
];

export const APP_NAME = 'Like Vision';

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  icePatent: string;
  logoUrl?: string;
  whatsappDarija?: string;
  whatsappFrench?: string;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: '',
  address: '',
  phone: '',
  icePatent: '',
  logoUrl: '',
  whatsappDarija: "السلام عليكم [Nom] \uD83D\uDC4B، فريق Like Vision كيشكرك بزاف على الثقة ديالك فينا \u2728. الطلب ديالك تسجل بنجاح \u2705. غادي نعلموك غير يوجدو النظارات ديالك \uD83D\uDC53. شكراً ليك ونهار مبروك! \uD83C\uDF1F\uD83D\uDE0E",
  whatsappFrench: "Bonjour [Nom] \uD83D\uDC4B, Toute l'équipe Like Vision vous remercie pour votre visite \u2728. Votre commande a été enregistrée avec succès \u2705. Nous vous contacterons dès qu'elle sera prête \uD83D\uDC53. Merci pour votre confiance ! \uD83D\uDE0A\uD83C\uDF1F",
};
