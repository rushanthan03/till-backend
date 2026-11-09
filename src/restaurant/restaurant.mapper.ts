// Note: This mapper needs to be refactored to match the new Restaurant entity structure
// The new Restaurant entity has: id, tenantId, name, logo, address, openHours, createdAt, updatedAt
// Old structure referenced: email, isActive, webUrl, logoUrl, timeZone, phoneNumber, opened, imageUrl, paymentMethod, openingHour, closingHour, location, singleclient

import { Injectable } from '@nestjs/common';
import { AuditMapper } from './../audit/audit.mapper';
import { IMapper } from './../domain/mapper/mapper';
import { Restaurant as RestaurantEntity } from './../infrastructure/database/entities/restaurant.entity';
import { Restaurant } from './restaurant';

@Injectable()
export class RestaurantMapper implements IMapper<Restaurant, RestaurantEntity> {
  constructor(
    private readonly auditMapper: AuditMapper,
  ) { }

  toPersistence(entity: Restaurant): RestaurantEntity {
    // Map domain entity to database entity
    const restaurantEntity = new RestaurantEntity();
    restaurantEntity.id = entity.id;
    restaurantEntity.name = entity.name;
    restaurantEntity.logo = (entity as any).logo || entity.logoUrl || null;
    restaurantEntity.address = (entity as any).address || null;
    restaurantEntity.contactEmail = (entity as any).contactEmail || entity.email || null;
    restaurantEntity.contactPhoneNumber = (entity as any).contactPhoneNumber || entity.phoneNumber || null;
    restaurantEntity.openTime = (entity as any).openTime || null;
    restaurantEntity.closeTime = (entity as any).closeTime || null;
    restaurantEntity.openHours = (entity as any).openHours || null;
    restaurantEntity.tenantId = (entity as any).tenantId || null;
    restaurantEntity.isActive = entity.isActive;
    restaurantEntity.primaryColor = entity.primaryColor || null;
    restaurantEntity.secondaryColor = entity.secondaryColor || null;
    restaurantEntity.tertiaryColor = entity.tertiaryColor || null;
    // Note: createdAt and updatedAt are handled by TypeORM automatically
    return restaurantEntity;
  }

  toDomain(document: RestaurantEntity): Restaurant {
    // Map the new Restaurant entity structure to domain entity
    const entity: Restaurant = Restaurant.create(
      {
        name: document.name,
        email: document.contactEmail || '',
        isActive: document.isActive ?? true,
        webUrl: '',
        logoUrl: document.logo || '',
        phoneNumber: document.contactPhoneNumber || '',
        timeZone: '',
        opened: true,
        imageUrl: '',
        openingHour: 0,
        closingHour: 0,
        audit: this.auditMapper.toDomain({
          auditCreatedDateTime: document.createdAt,
          auditCreatedBy: '',
          auditModifiedBy: '',
          auditModifiedDateTime: document.updatedAt,
        } as any),
        primaryColor: document.primaryColor,
        secondaryColor: document.secondaryColor,
        tertiaryColor: document.tertiaryColor,
      },
      document.id,
    ).getValue();

    // Store additional fields from new entity structure as properties on the domain entity
    // These will be accessed directly from the entity document in the parser
    (entity as any).tenantId = document.tenantId;
    (entity as any).logo = document.logo;
    (entity as any).address = document.address;
    (entity as any).contactEmail = document.contactEmail;
    (entity as any).contactPhoneNumber = document.contactPhoneNumber;
    (entity as any).openTime = document.openTime;
    (entity as any).closeTime = document.closeTime;
    (entity as any).openHours = document.openHours;
    (entity as any).primaryColor = document.primaryColor;
    (entity as any).secondaryColor = document.secondaryColor;
    (entity as any).tertiaryColor = document.tertiaryColor;

    return entity;
  }
}