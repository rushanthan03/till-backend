import { AuditParser } from './../audit/audit.parser';
import { Restaurant } from './restaurant';
import { IRestaurantResponseDTO } from './restaurant-response.dto';
export class RestaurantParser {
  static createRestaurantResponse(restaurant: Restaurant | any): IRestaurantResponseDTO {
    const { audit } = restaurant;
    const auditResponse = audit ? { ...AuditParser.createAuditResponse(audit) } : undefined;




    const restaurantResponse: IRestaurantResponseDTO = {
      id: restaurant.id,
      tenantId: restaurant.tenantId || (restaurant as any).tenantId,
      name: restaurant.name,
      logo: (restaurant as any).logo || restaurant.logoUrl,
      logoUrl: restaurant.logoUrl || (restaurant as any).logo,
      address: (restaurant as any).address || undefined,
      contactEmail: (restaurant as any).contactEmail || restaurant.email,
      contactPhoneNumber: (restaurant as any).contactPhoneNumber || restaurant.phoneNumber,
      openTime: (restaurant as any).openTime,
      closeTime: (restaurant as any).closeTime,
      openHours: (restaurant as any).openHours,
      // Legacy fields for backward compatibility
      email: restaurant.email || (restaurant as any).contactEmail,
      isActive: restaurant.isActive,
      webUrl: restaurant.webUrl,
      timeZone: restaurant.timeZone,
      primaryColor: (restaurant as any).primaryColor,
      secondaryColor: (restaurant as any).secondaryColor,
      tertiaryColor: (restaurant as any).tertiaryColor,
      ...auditResponse,
    };

    return restaurantResponse;
  }

  static createRestaurantsParser(restaurants: Restaurant[]): IRestaurantResponseDTO[] {
    return restaurants.length ? restaurants.map((restaurant) => this.createRestaurantResponse(restaurant)) : [];
  }
}
