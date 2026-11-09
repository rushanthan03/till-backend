import { IAudit } from './../infrastructure/database/mongoDB/base-document.interface';

export interface IRestaurantAddressResponse {
  lane?: string;
  city?: string;
  district?: string;
  country?: string;
}

export interface IRestaurantResponseDTO extends IAudit {
  id: string;
  tenantId?: string;
  name: string;
  logo?: string;
  address?: IRestaurantAddressResponse;
  contactEmail?: string;
  contactPhoneNumber?: string;
  openTime?: string; // e.g., "09:00"
  closeTime?: string; // e.g., "22:00"
  openHours?: Record<string, string>; // e.g., { "mon-fri": "10:00-22:00", "sat-sun": "09:00-23:00" }
  // Legacy fields for backward compatibility
  email?: string;
  logoUrl?: string;
  isActive?: boolean;
  webUrl?: string;
  timeZone?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
}

