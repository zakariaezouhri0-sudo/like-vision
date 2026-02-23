export const ROLES = {
  ADMIN: 'ADMIN',
  CAISSIER: 'CAISSIER',
};

export const MUTUELLES = [
  'Aucun',
  'CNOPS',
  'CNSS',
  'FAR',
  'AXA',
  'Autre',
];

export const APP_NAME = 'VisionGere';

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  icePatent: string;
  logoUrl?: string;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: 'VisionGere Optique',
  address: '123 Rue de la Lumière, Paris, France',
  phone: '+33 1 23 45 67 89',
  icePatent: 'ICE-987654321',
  logoUrl: 'https://picsum.photos/seed/visiongere-logo/200/200',
};
