
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
  theme?: string;
  whatsappDarija?: string;
  whatsappFrench?: string;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: '',
  address: '',
  phone: '',
  icePatent: '',
  logoUrl: '',
  theme: 'light',
  whatsappDarija: "السلام عليكم [Nom] \uD83D\uDC4B\u060C \u0641\u0631\u064a\u0642 Like Vision \u0643\u064a\u0634\u0643\u0631\u0643 \u0628\u0632\u0627\u0641 \u0639\u0644\u0649 \u0627\u0644\u062b\u0642\u0629 \u062f\u064a\u0627\u0644\u0643 \u0641\u064a\u0646\u0627 \u2728. \u0627\u0644\u0637\u0644\u0628 \u062f\u064a\u0627\u0644\u0643 \u062a\u0633\u062c\u0644 \u0628\u0646\u062c\u0627\u062d \u2705. \u063a\u0627\u062f\u064a \u0646\u0639\u0644\u0645\u0648\u0643 \u063a\u064a\u0631 \u064a\u0648\u062c\u062f\u0648 \u0627\u0644\u0646\u0638\u0627\u0631\u0627\u062a \u062f\u064a\u0627\u0644\u0643 \uD83D\uDC53. \u0634\u0643\u0631\u0627\u064b \u0644\u064a\u0643 \u0648\u0646\u0647\u0627\u0631 \u0645\u0628\u0631\u0648\u0643! \uD83C\uDF1F\uD83D\uDE0E",
  whatsappFrench: "Bonjour [Nom] \uD83D\uDC4B, Toute l'équipe Like Vision vous remercie pour votre visite \u2728. Votre commande a été enregistrée avec succès \u2705. Nous vous contacterons dès qu'elle sera prête \uD83D\uDC53. Merci pour votre confiance ! \uD83D\uDE0A\uD83C\uDF1F",
};
