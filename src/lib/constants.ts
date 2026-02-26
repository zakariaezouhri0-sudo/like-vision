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
  name: '',
  address: '',
  phone: '',
  icePatent: '',
  logoUrl: '',
};
