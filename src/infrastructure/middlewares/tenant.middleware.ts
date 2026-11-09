import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Tenant, TenantStatus, UserRole, Restaurant } from '../database/entities';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Restaurant)
    private restaurantRepository: Repository<Restaurant>,
    private jwtService: JwtService,
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    const subdomain = this.extractSubdomain(req);
    // Use originalUrl to get the full path including /api prefix
    const path = req.originalUrl || req.path;

    // Public invoice, receipt, health, and docs routes - completely exempt from tenant/subdomain validation
    const isPublicReceiptRoute =
      path.startsWith('/invoice') ||
      path.startsWith('/receipt') ||
      path.startsWith('/invoices/view') ||
      path.startsWith('/v1/invoices/view') ||
      path.startsWith('/api/invoices/view') ||
      path === '/' ||
      path === '/health' ||
      path.startsWith('/api/docs');

    if (isPublicReceiptRoute) {
      return next();
    }

    // Check if this is an auth route (login, register, etc.) - these don't require strict tenant validation
    const isAuthRoute = path.startsWith('/auth') || path.startsWith('/api/auth') || path.startsWith('/api/subscription');

    // Check if this is a menu admin route (export, import, template) - these use restaurantId from authenticated user
    const isMenuAdminRoute =
      path.includes('/api/menus/export/') ||
      path.includes('/api/menus/import/') ||
      path.includes('/api/menus/template/');

    // Check if this is a QR code route - these are public and derive tenant from QR code's restaurant
    const isQRCodeRoute =
      path.startsWith('/customer-portal/qr/') || path.startsWith('/api/customer-portal/qr/');

    // Check if this is a customer portal route - these are public and can derive tenant from context
    const isCustomerPortalRoute =
      path.startsWith('/customer-portal') || path.startsWith('/api/customer-portal');

    // Check if this is an addon public route - these are public for customer menu viewing
    const isAddonPublicRoute =
      path.startsWith('/addons/public') || path.startsWith('/api/addons/public');

    // Check if this is a dashboard or reports route - these work with restaurantId and don't need subdomain
    const isDashboardRoute =
      path.startsWith('/dashboard') || path.startsWith('/api/dashboard') ||
      path.startsWith('/reports') || path.startsWith('/api/reports');

    // Check if this is a super-admin route - these are for platform administration
    const isSuperAdminRoute =
      path.startsWith('/super-admin') || path.startsWith('/api/super-admin') ||
      path.startsWith('/tenants') || path.startsWith('/api/tenants');

    // Check if this is a customer-related route (excluding customer-portal) - these need tenant validation
    const isCustomerRoute =
      path.startsWith('/customer-ratings') || path.startsWith('/api/customer-ratings') ||
      path.startsWith('/customers') || path.startsWith('/api/customers');

    // Check if user is super admin by decoding JWT token
    const isSuperAdmin = await this.checkIfSuperAdmin(req);

    // If user is super admin, skip tenant validation entirely
    if (isSuperAdmin) {
      // Still try to set tenant if provided/available, but don't enforce it
      if (tenantId) {
        const tenant = await this.tenantRepository.findOne({
          where: { id: tenantId, status: TenantStatus.ACTIVE },
        });
        if (tenant) {
          req['tenant'] = tenant;
        }
      } else if (subdomain) {
        const tenant = await this.tenantRepository.findOne({
          where: { subdomain, status: TenantStatus.ACTIVE },
        });
        if (tenant) {
          req['tenant'] = tenant;
          req.headers['x-tenant-id'] = tenant.id;
        }
      }
      // Super admin can proceed without tenant validation
      return next();
    }

    // For super-admin routes, allow through if user is authenticated (will be checked by guards)
    if (isSuperAdminRoute) {
      return next();
    }

    // For auth routes (login/register), allow through without strict tenant validation
    // This is critical for super admin login which happens without a token
    // The auth service will handle super admin validation
    if (isAuthRoute) {
      // Allow auth routes to proceed - they'll handle authentication internally
      return next();
    }

    // For menu admin routes (export/import/template), allow through without tenant validation
    // These routes are protected by JWT auth and use restaurantId from the authenticated user
    if (isMenuAdminRoute) {
      return next();
    }

    // For QR code routes, allow through without tenant validation
    // The service will look up the QR code and derive tenant from the restaurant
    if (isQRCodeRoute) {
      // Try to set tenant if available, but don't enforce it
      // The QR code service will handle tenant resolution from the QR code's restaurant
      if (tenantId) {
        const tenant = await this.tenantRepository.findOne({
          where: { id: tenantId, status: TenantStatus.ACTIVE },
        });
        if (tenant) {
          req['tenant'] = tenant;
        }
      } else if (subdomain) {
        const tenant = await this.tenantRepository.findOne({
          where: { subdomain, status: TenantStatus.ACTIVE },
        });
        if (tenant) {
          req['tenant'] = tenant;
          req.headers['x-tenant-id'] = tenant.id;
        }
      }
      // Allow QR code routes to proceed - they derive tenant from QR code's restaurant
      return next();
    }

    // For addon public routes, allow through without tenant validation
    // These are used by customers to view available addons for menu items
    if (isAddonPublicRoute) {
      // Allow addon public routes to proceed - they work with restaurantId or menuId from query params
      return next();
    }

    // For customer portal routes (public endpoints), allow through without strict tenant validation
    // These endpoints can derive tenant from restaurant ID, QR code, or order context
    // Some endpoints (like customer verify) don't need tenant at all
    if (isCustomerPortalRoute) {
      // Try to set tenant if available, but don't enforce it
      // Endpoints can derive tenant from restaurantId in body/params/query, QR codes, or orders
      let resolvedTenant: Tenant | null = null;

      if (tenantId) {
        resolvedTenant = await this.tenantRepository.findOne({
          where: { id: tenantId, status: TenantStatus.ACTIVE },
        });
        if (resolvedTenant) {
          req['tenant'] = resolvedTenant;
        }
      } else if (subdomain) {
        resolvedTenant = await this.tenantRepository.findOne({
          where: { subdomain, status: TenantStatus.ACTIVE },
        });
        if (resolvedTenant) {
          req['tenant'] = resolvedTenant;
          req.headers['x-tenant-id'] = resolvedTenant.id;
        }
      } else {
        // Try to derive from restaurant ID if available (for order creation, menu fetching, etc.)
        const restaurantId = this.extractRestaurantId(req);
        if (restaurantId) {
          const restaurant = await this.restaurantRepository.findOne({
            where: { id: restaurantId },
            relations: ['tenant'],
          });

          if (restaurant) {
            if (restaurant.tenant) {
              resolvedTenant = restaurant.tenant;
            } else if (restaurant.tenantId) {
              resolvedTenant = await this.tenantRepository.findOne({
                where: { id: restaurant.tenantId, status: TenantStatus.ACTIVE },
              });
            }

            if (resolvedTenant) {
              req['tenant'] = resolvedTenant;
              req.headers['x-tenant-id'] = resolvedTenant.id;
            }
          }
        }
      }

      // Allow customer portal routes to proceed - tenant is optional, endpoints handle their own tenant needs
      return next();
    }

    // For dashboard routes, allow through without strict tenant validation
    // Dashboard endpoints work with restaurantId and derive tenant from the user's restaurant
    if (isDashboardRoute) {
      // Try to set tenant if available, but don't enforce it
      // Dashboard service will handle tenant resolution from user's restaurant
      let resolvedTenant: Tenant | null = null;

      if (tenantId) {
        resolvedTenant = await this.tenantRepository.findOne({
          where: { id: tenantId, status: TenantStatus.ACTIVE },
        });
        if (resolvedTenant) {
          req['tenant'] = resolvedTenant;
        }
      } else if (subdomain) {
        resolvedTenant = await this.tenantRepository.findOne({
          where: { subdomain, status: TenantStatus.ACTIVE },
        });
        if (resolvedTenant) {
          req['tenant'] = resolvedTenant;
          req.headers['x-tenant-id'] = resolvedTenant.id;
        }
      } else {
        // Try to derive from restaurant ID if available
        const restaurantId = this.extractRestaurantId(req);
        if (restaurantId) {
          const restaurant = await this.restaurantRepository.findOne({
            where: { id: restaurantId },
            relations: ['tenant'],
          });

          if (restaurant) {
            if (restaurant.tenant) {
              resolvedTenant = restaurant.tenant;
            } else if (restaurant.tenantId) {
              resolvedTenant = await this.tenantRepository.findOne({
                where: { id: restaurant.tenantId, status: TenantStatus.ACTIVE },
              });
            }

            if (resolvedTenant) {
              req['tenant'] = resolvedTenant;
              req.headers['x-tenant-id'] = resolvedTenant.id;
            }
          }
        }
      }

      // Allow dashboard routes to proceed - tenant is optional, endpoints handle their own tenant needs
      return next();
    }

    // For customer-related routes (customer-ratings, customers), validate tenant but allow deriving it from restaurant ID
    if (isCustomerRoute) {
      let resolvedTenant: Tenant | null = null;

      // First, try to get tenant from header or subdomain
      if (tenantId) {
        resolvedTenant = await this.tenantRepository.findOne({
          where: { id: tenantId, status: TenantStatus.ACTIVE },
        });
      } else if (subdomain) {
        resolvedTenant = await this.tenantRepository.findOne({
          where: { subdomain, status: TenantStatus.ACTIVE },
        });
      }

      // If no tenant found yet, try to derive it from restaurant ID
      if (!resolvedTenant) {
        const restaurantId = this.extractRestaurantId(req);
        if (restaurantId) {
          const restaurant = await this.restaurantRepository.findOne({
            where: { id: restaurantId },
            relations: ['tenant'],
          });

          if (restaurant) {
            // Try to get tenant from relation first
            if (restaurant.tenant) {
              resolvedTenant = restaurant.tenant;
            } else if (restaurant.tenantId) {
              // Fallback to direct tenantId lookup
              resolvedTenant = await this.tenantRepository.findOne({
                where: { id: restaurant.tenantId, status: TenantStatus.ACTIVE },
              });
            }
          }
        }
      }

      // Validate that tenant was found and is active
      if (!resolvedTenant) {
        throw new BadRequestException('Tenant identification required. Provide tenant via X-Tenant-ID header, subdomain, or restaurant ID.');
      }

      if (resolvedTenant.status !== TenantStatus.ACTIVE) {
        throw new BadRequestException('Tenant is not active');
      }

      req['tenant'] = resolvedTenant;
      req.headers['x-tenant-id'] = resolvedTenant.id;
      return next();
    }

    // For authenticated non-super-admin users on protected routes, enforce tenant validation
    if (tenantId) {
      // Validate tenant exists and is active
      const tenant = await this.tenantRepository.findOne({
        where: { id: tenantId, status: TenantStatus.ACTIVE },
      });

      if (!tenant) {
        throw new BadRequestException('Invalid or inactive tenant');
      }

      req['tenant'] = tenant;
    } else if (subdomain) {
      // Find tenant by subdomain
      const tenant = await this.tenantRepository.findOne({
        where: { subdomain, status: TenantStatus.ACTIVE },
      });

      if (!tenant) {
        throw new BadRequestException('Invalid subdomain');
      }

      req['tenant'] = tenant;
      req.headers['x-tenant-id'] = tenant.id;
    } else {
      // No tenant ID or subdomain provided for protected route
      throw new BadRequestException('Tenant identification required');
    }

    next();
  }

  private async checkIfSuperAdmin(req: Request): Promise<boolean> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
      }

      const token = authHeader.substring(7);
      const payload = this.jwtService.decode(token) as any;

      if (payload && payload.role === UserRole.SUPER_ADMIN) {
        return true;
      }

      return false;
    } catch (error) {
      // If token decode fails, user is not authenticated yet (e.g., login route)
      // Return false to maintain tenant isolation for unauthenticated requests
      return false;
    }
  }

  private extractSubdomain(req: Request): string | null {
    const host = req.get('host');
    if (!host) return null;

    const parts = host.split('.');
    if (parts.length > 2) {
      return parts[0];
    }

    return null;
  }

  private extractRestaurantId(req: Request): string | null {
    // Try to get restaurantId from request body (for POST/PUT/PATCH)
    if (req.body && typeof req.body === 'object') {
      if (req.body.restaurantId) {
        return req.body.restaurantId;
      }
    }

    // Try to get restaurantId from query params
    if (req.query && typeof req.query === 'object') {
      if (req.query.restaurantId) {
        return req.query.restaurantId as string;
      }
    }

    // Try to get restaurantId from route params (e.g., /restaurant/:restaurantId)
    if (req.params && typeof req.params === 'object') {
      if (req.params.restaurantId) {
        return req.params.restaurantId;
      }
    }

    return null;
  }
}
