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
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: 'Like Vision Optique',
  address: '123 Rue de la Lumière, Paris, France',
  phone: '+33 1 23 45 67 89',
  icePatent: 'ICE-987654321',
  logoUrl: 'https://picsum.photos/seed/likevision-logo/200/200',
};
