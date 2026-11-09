import { Audit } from './../domain/audit/audit';

export interface IRestaurant {
  name: string;
  email: string;
  isActive: boolean;
  phoneNumber: string;
  webUrl?: string;
  logoUrl?: string;
  timeZone?: string;
  opened: boolean;
  imageUrl: string;
  audit: Audit;
  openingHour: number;
  closingHour: number;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
}
