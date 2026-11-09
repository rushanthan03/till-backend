# DineFlow API Documentation

## Overview
DineFlow is a comprehensive SaaS platform for restaurant and food court management with real-time order tracking, multi-tenant architecture, and contactless ordering capabilities.

## Base URL
```
http://localhost:4001/api
```

## Multi-Tenant Architecture

### Tenant Context Resolution
The API supports multi-tenancy through two mechanisms:

1. **Subdomain-based routing**: Extract tenant from subdomain (e.g., `mytenant.dineflow.com`)
2. **Header-based routing**: Use `X-Tenant-ID` header

The tenant middleware automatically:
- Extracts tenant from subdomain or header
- Validates tenant exists and is active
- Attaches tenant context to the request object

**Headers**:
```http
X-Tenant-ID: tenant-uuid
```

### Tenant Status Enum
```typescript
enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}
```

### Tenant Type Enum
```typescript
enum TenantType {
  RESTAURANT = 'restaurant',
  FOOD_COURT = 'food_court'
}
```

### Subscription Plan Enum
```typescript
enum SubscriptionPlan {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}
```

## Authentication
The API uses JWT-based authentication with role-based access control (RBAC).

### Authentication Flow
1. **Staff/Admin**: Email/password login → JWT access token + refresh token
2. **Customers**: Phone number → OTP sent → OTP verification → JWT tokens
3. **Token Management**: Access tokens (15min expiry) + Refresh tokens (7 days expiry)

### Authentication Endpoints

#### Login (Staff/Admin)
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@dineflow.com",
  "password": "SuperAdmin@123"
}
```

**Response**:
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@dineflow.com",
    "phoneNumber": null,
    "name": "Admin User",
    "role": "super_admin",
    "status": "active",
    "avatar": null,
    "tenantId": null,
    "lastLoginAt": "2025-01-11T21:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-11T21:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

#### Register (Staff/Admin)
```http
POST /auth/register
Content-Type: application/json

{
  "email": "manager@restaurant.com",
  "password": "password123",
  "name": "John Doe",
  "role": "manager",
  "tenantId": "tenant-uuid"
}
```

**Role Enum Values**:
- `super_admin` - Platform administrator
- `tenant_admin` - Tenant administrator
- `manager` - Restaurant/Outlet manager
- `waiter` - Service staff
- `kitchen_staff` - Kitchen operations staff

**Response**: Same as Login response

#### Phone Login (Customer - Send OTP)
```http
POST /auth/phone-login
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

**Response**:
```json
{
  "message": "OTP sent successfully",
  "expiresIn": 300000
}
```

**Note**: Phone number must be in E.164 format (e.g., `+1234567890`)

#### Verify OTP (Customer)
```http
POST /auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

**Response**: Same as Login response (AuthResponseDto)

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer your-access-token
```

**Response**:
```json
{
  "message": "Logged out successfully"
}
```

#### Get User Profile
```http
GET /auth/profile
Authorization: Bearer your-access-token
```

**Response**: User object (same as in login response)

## User Roles and Permissions

### User Role Enum
```typescript
enum UserRole {
  SUPER_ADMIN = 'super_admin',      // Platform administrator - Full system access
  TENANT_ADMIN = 'tenant_admin',    // Tenant administrator - Tenant-level management
  MANAGER = 'manager',              // Restaurant/Outlet manager - Operations management
  WAITER = 'waiter',                // Service staff - Order management and service
  KITCHEN_STAFF = 'kitchen_staff'   // Kitchen staff - Kitchen operations
}
```

### User Status Enum
```typescript
enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}
```

### Role-Based Access Control (RBAC)

The API implements RBAC using guards:

1. **JwtAuthGuard**: Validates JWT token and extracts user from request
2. **RolesGuard**: Checks if user has required role(s)
3. **TenantGuard**: Ensures user can only access their tenant's resources (unless SUPER_ADMIN)

**Usage in Controllers**:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('tenants')
```

### Role Permissions Matrix

#### 1. SUPER_ADMIN (`super_admin`)
**Tenant Access**: 
- ✅ Can access **ANY tenant** (bypasses TenantGuard)
- ✅ No tenant isolation restrictions

**Permissions**:
- ✅ **Tenant Management**: Full CRUD (Create, Read, Update, Delete/Archive)
- ✅ **User Management**: Create, read, update users across all tenants
- ✅ **Outlet/Restaurant Management**: Full access to all outlets
- ✅ **Menu Management**: Full CRUD access
- ✅ **Category Management**: Full CRUD access
- ✅ **Order Management**: Full access to all orders (view, create, update, delete, confirm, process payment)
- ✅ **Order Analytics**: Full access to analytics and reports
- ✅ **Kitchen Display**: Full access to kitchen operations
- ✅ **QR Code Management**: Full CRUD access
- ✅ **Order Status Management**: Full access to all status operations
- ✅ **Customer Management**: Full access to view all customers across all tenants and restaurants

**Endpoints Access**:
- All endpoints are accessible
- Can perform all operations across all tenants

---

#### 2. TENANT_ADMIN (`tenant_admin`)
**Tenant Access**: 
- ✅ Can access **only their own tenant** (enforced by TenantGuard)
- ❌ Cannot access other tenants' resources
- ✅ Tenant context automatically enforced via middleware

**Permissions**:
- ❌ **Tenant Management**: No access (only SUPER_ADMIN)
- ✅ **User Management**: Create, read, update users within their tenant (manager, waiter, kitchen_staff only)
- ✅ **Outlet/Restaurant Management**: Full CRUD access to outlets within their tenant
- ✅ **Menu Management**: Full CRUD access within tenant
- ✅ **Category Management**: Full CRUD access within tenant
- ✅ **Order Management**: Full access to orders within tenant (view, create, update, delete, confirm, process payment)
- ✅ **Order Analytics**: Full access to analytics for their tenant
- ✅ **Kitchen Display**: Full access to kitchen operations within tenant
- ✅ **QR Code Management**: Full CRUD access within tenant
- ✅ **Order Status Management**: Full access to all status operations within tenant
- ✅ **Customer Management**: View customers who have placed orders in their tenant's restaurants

**Endpoints Access**:
- Can access most operational endpoints
- Tenant isolation enforced automatically
- Cannot manage other tenants or super admin users

---

#### 3. MANAGER (`manager`)
**Tenant Access**: 
- ✅ Can access **only their own tenant** (enforced by TenantGuard)
- ❌ Cannot access other tenants' resources

**Permissions**:
- ❌ **Tenant Management**: No access
- ❌ **User Management**: No access (only TENANT_ADMIN and SUPER_ADMIN)
- ✅ **Outlet/Restaurant Management**: Read access to outlets
- ✅ **Menu Management**: Full CRUD access within tenant
- ✅ **Category Management**: Full CRUD access within tenant
- ✅ **Order Management**: Full access to orders (view, create, update, delete, confirm, process payment)
- ✅ **Order Analytics**: Full access to analytics
- ✅ **Kitchen Display**: Full access to kitchen operations
- ✅ **QR Code Management**: Full CRUD access
- ✅ **Order Status Management**: Full access to status operations (except cancellation requires MANAGER or higher)
- ✅ **Customer Management**: View customers who have placed orders in their restaurant

**Endpoints Access**:
- Operational endpoints within tenant scope
- Cannot manage users or tenants
- Full access to menu, orders, and kitchen operations

---

#### 4. WAITER (`waiter`)
**Tenant Access**: 
- ✅ Can access **only their own tenant** (enforced by TenantGuard)
- ❌ Cannot access other tenants' resources

**Permissions**:
- ❌ **Tenant Management**: No access
- ❌ **User Management**: No access
- ❌ **Outlet/Restaurant Management**: No access
- ❌ **Menu Management**: Read-only access (cannot create/update/delete menu details)
- ✅ **Menu Availability**: Can update menu item availability status
- ✅ **Category Management**: Read-only access (cannot create/update/delete)
- ✅ **Order Management**: Full access to orders (view, create, update, confirm, process payment)
- ❌ **Order Analytics**: No access (only MANAGER and above)
- ❌ **Kitchen Display**: Limited access (cannot view statistics)
- ❌ **QR Code Management**: No access (only MANAGER and above)
- ✅ **Order Status Management**: Can update order status (mark ready, completed), cancel orders
- ✅ **Customer Management**: Can create/find customers and view customers who have placed orders in their restaurant

**Endpoints Access**:
- Read access to menu and categories
- Full access to order operations
- Customer management (create/find by phone, view by phone)
- Cannot manage settings or analytics

---

#### 5. KITCHEN_STAFF (`kitchen_staff`)
**Tenant Access**: 
- ✅ Can access **only their own tenant** (enforced by TenantGuard)
- ❌ Cannot access other tenants' resources

**Permissions**:
- ❌ **Tenant Management**: No access
- ❌ **User Management**: No access
- ❌ **Outlet/Restaurant Management**: No access
- ❌ **Menu Management**: Read-only access (cannot create/update/delete menu details)
- ✅ **Menu Availability**: Can update menu item availability status
- ✅ **Category Management**: Read-only access
- ✅ **Order Management**: Read access to orders and order items
- ❌ **Order Analytics**: No access
- ✅ **Kitchen Display**: Full access to kitchen operations (view orders, start items, mark ready, extend time)
- ❌ **QR Code Management**: No access
- ✅ **Order Status Management**: Can update order item status (start, ready), cannot cancel orders

**Endpoints Access**:
- Read access to menu and orders
- Full access to kitchen display operations
- Limited to kitchen-specific operations
- Cannot manage settings, analytics, or cancel orders

---

### Tenant Access Control

#### TenantGuard Implementation
- **SUPER_ADMIN**: Bypasses tenant restrictions, can access any tenant
- **All other roles**: Must have `tenantId` matching the requested tenant
- Tenant ID is extracted from:
  - `X-Tenant-ID` header
  - URL parameter (`:tenantId`)
  - Subdomain (via TenantMiddleware)

#### Access Level Summary Table

| Feature | SUPER_ADMIN | TENANT_ADMIN | MANAGER | WAITER | KITCHEN_STAFF |
|---------|-------------|--------------|---------|--------|---------------|
| **Tenant Access** | All Tenants | Own Tenant | Own Tenant | Own Tenant | Own Tenant |
| **Tenant CRUD** | ✅ Full | ❌ No | ❌ No | ❌ No | ❌ No |
| **User Management** | ✅ Full | ✅ Own Tenant | ❌ No | ❌ No | ❌ No |
| **Outlet Management** | ✅ Full | ✅ Own Tenant | 👁️ Read | ❌ No | ❌ No |
| **Menu CRUD** | ✅ Full | ✅ Full | ✅ Full | 👁️ Read + Availability | 👁️ Read + Availability |
| **Category CRUD** | ✅ Full | ✅ Full | ✅ Full | 👁️ Read | 👁️ Read |
| **Order Create/Update** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 👁️ Read |
| **Order Delete** | ✅ Full | ✅ Full | ✅ Full | ❌ No | ❌ No |
| **Order Confirm** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ No |
| **Order Payment** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ No |
| **Order Analytics** | ✅ Full | ✅ Full | ✅ Full | ❌ No | ❌ No |
| **Kitchen Display** | ✅ Full | ✅ Full | ✅ Full | ❌ Limited | ✅ Full |
| **Kitchen Statistics** | ✅ Full | ✅ Full | ✅ Full | ❌ No | ❌ No |
| **QR Code Management** | ✅ Full | ✅ Full | ✅ Full | ❌ No | ❌ No |
| **Order Status Update** | ✅ Full | ✅ Full | ✅ Full | ✅ Limited | ✅ Item Only |
| **Order Cancel** | ✅ Full | ✅ Full | ✅ Full | ✅ Yes | ❌ No |
| **Customer Management** | ✅ Full | ✅ Tenant Only | ✅ Restaurant Only | ✅ Restaurant Only | ❌ No |

**Legend**:
- ✅ Full: Complete access (Create, Read, Update, Delete)
- 👁️ Read: Read-only access
- ❌ No: No access
- ✅ Limited: Partial access (specific operations only)

## Tenant Management

### Create Tenant
```http
POST /tenants
Authorization: Bearer your-access-token
Content-Type: application/json
X-Tenant-ID: (optional, for subdomain-based)

{
  "name": "My Restaurant Chain",
  "type": "restaurant",
  "contactEmail": "contact@restaurant.com",
  "contactPhoneNumber": "+1234567890",
  "description": "A premium restaurant chain serving Italian cuisine"
}
```

**Required Role**: `SUPER_ADMIN`

**Request Body**:
- `name` (string, required): Tenant name (subdomain auto-generated from name)
- `type` (enum, required): `restaurant` or `food_court`
- `contactEmail` (string, optional): Contact email address
- `contactPhoneNumber` (string, optional): Contact phone number
- `description` (string, optional): Tenant description

**Response**: Tenant object with generated `id`, `subdomain`, `status`, etc.

### Get All Tenants
```http
GET /tenants?page=1&limit=10&search=restaurant&status=active&type=restaurant&sortBy=name&sortOrder=ASC
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `search` (string, optional): Search term to filter by name, subdomain, contactEmail, or description (case-insensitive)
- `sortBy` (string, optional): Field to sort by. Allowed values: `name`, `subdomain`, `status`, `type`, `subscriptionPlan`, `createdAt`, `updatedAt` (default: `createdAt`)
- `sortOrder` (enum, optional): Sort order. Values: `ASC` or `DESC` (default: `DESC`)
- `status` (enum, optional): Filter by tenant status. Values: `active`, `inactive`, `suspended`
  - **Note**: By default, only `active` tenants are returned. Use `status=inactive` to view archived tenants.
- `type` (enum, optional): Filter by tenant type. Values: `restaurant`, `food_court`
- `subscriptionPlan` (enum, optional): Filter by subscription plan. Values: `basic`, `pro`, `enterprise`

**Searchable Fields**: 
- `name` - Tenant name
- `subdomain` - Tenant subdomain
- `contactEmail` - Contact email address
- `description` - Tenant description

**Sortable Fields**: 
- `name`, `subdomain`, `status`, `type`, `subscriptionPlan`, `createdAt`, `updatedAt`

**Filterable Fields**: 
- `status` - Tenant status (active, inactive, suspended)
  - **Default Behavior**: Only `active` tenants are returned by default. Use `status=inactive` to view archived tenants.
- `type` - Tenant type (restaurant, food_court)
- `subscriptionPlan` - Subscription plan (basic, pro, enterprise)

**Note**: Archived tenants (status: `inactive`) are filtered out by default. To view archived tenants, explicitly set `status=inactive` in the query parameters.

**Response**:
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15
}
```

**Example Requests**:
```http
# Search for tenants with "restaurant" in name or description
GET /tenants?search=restaurant

# Filter active restaurants and sort by name
GET /tenants?status=active&type=restaurant&sortBy=name&sortOrder=ASC

# Combined search, filter, and sort
GET /tenants?search=italian&status=active&sortBy=createdAt&sortOrder=DESC&page=1&limit=20
```

### Get Tenants List (Simple - ID and Name Only)
```http
GET /tenants/list
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`

**Description**: Returns a simple list of all tenants with only `id` and `name` fields. No pagination, no relations, no filters. Perfect for dropdown menus or selection lists.

**Response**: Array of tenant objects with only id and name
```json
[
  {
    "id": "tenant-uuid-1",
    "name": "Restaurant Chain A"
  },
  {
    "id": "tenant-uuid-2",
    "name": "Food Court Downtown"
  },
  {
    "id": "tenant-uuid-3",
    "name": "Restaurant Chain B"
  }
]
```

**Note**: 
- Returns all tenants sorted alphabetically by name (ASC)
- No pagination - returns all tenants in the system
- Only includes `id` and `name` fields for lightweight response
- Useful for dropdown menus, selection lists, or when you just need tenant identifiers

### Get Tenant by ID
```http
GET /tenants/{tenantId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`

**Response**: Tenant object

### Update Tenant
```http
PATCH /tenants/{tenantId}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Restaurant Chain",
  "type": "food_court",
  "contactEmail": "newemail@restaurant.com",
  "contactPhoneNumber": "+9876543210",
  "description": "Updated description for the restaurant"
}
```

**Required Role**: `SUPER_ADMIN`

**Request Body** (all fields optional):
- `name` (string): Updated tenant name
- `type` (enum): Updated tenant type
- `contactEmail` (string): Updated contact email
- `contactPhoneNumber` (string): Updated contact phone number
- `description` (string): Updated tenant description

**Response**: Updated tenant object

### Delete (Archive) Tenant
```http
DELETE /tenants/{tenantId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`

**Note**: This archives the tenant (soft delete), setting status to `INACTIVE`. Archived tenants are filtered out by default in list endpoints.

### Unarchive/Reactivate Tenant
```http
POST /tenants/{tenantId}/unarchive
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`

**Note**: Unarchives a tenant by setting status back to `ACTIVE`. Only archived (inactive) tenants can be unarchived.

**Alternative Endpoint**:
```http
POST /tenants/{tenantId}/reactivate
Authorization: Bearer your-access-token
```

**Response**: Updated tenant object with status `ACTIVE`

**Error Responses**:
- `400 Bad Request`: Tenant is not archived. Only archived tenants can be unarchived.
- `404 Not Found`: Tenant not found

## User Management

### Get All Users (Super Admin Only)
```http
GET /users?page=1&limit=10&search=john&role=manager&status=active&tenantId=xxx&sortBy=name&sortOrder=ASC
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN` only

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `search` (string, optional): Search term to filter by name, email, or phoneNumber (case-insensitive)
- `sortBy` (string, optional): Field to sort by. Allowed values: `name`, `email`, `phoneNumber`, `role`, `status`, `createdAt`, `updatedAt`, `lastLoginAt` (default: `createdAt`)
- `sortOrder` (enum, optional): Sort order. Values: `ASC` or `DESC` (default: `DESC`)
- `role` (enum, optional): Filter by user role. Values: `tenant_admin`, `manager`, `waiter`, `kitchen_staff`
- `status` (enum, optional): Filter by user status. Values: `active`, `inactive`, `suspended`
  - **Note**: By default, only `active` users are returned. Use `status=inactive` to view archived users.
- `tenantId` (uuid, optional): Filter by tenant ID
- `restaurantId` (uuid, optional): Filter by restaurant ID

**Searchable Fields**: 
- `name` - User full name
- `email` - User email address
- `phoneNumber` - User phone number

**Sortable Fields**: 
- `name`, `email`, `phoneNumber`, `role`, `status`, `createdAt`, `updatedAt`, `lastLoginAt`

**Filterable Fields**: 
- `role` - User role (tenant_admin, manager, waiter, kitchen_staff)
- `status` - User status (active, inactive, suspended)
  - **Default Behavior**: Only `active` users are returned by default. Use `status=inactive` to view archived users.
- `tenantId` - Tenant ID
- `restaurantId` - Restaurant ID

**Note**: Archived users (status: `inactive`) are filtered out by default. To view archived users, explicitly set `status=inactive` in the query parameters.

**Response**:
```json
{
  "data": [
    {
      "id": "173b7bb0-1808-418a-8cd3-6d8d9b6366fd",
      "email": "user@restaurant.com",
      "phoneNumber": "+1 (975) 554-4479",
      "name": "John Doe",
      "role": "manager",
      "status": "active",
      "avatar": null,
      "permissions": null,
      "lastLoginAt": null,
      "emailVerifiedAt": null,
      "phoneVerifiedAt": null,
      "tenantId": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
      "tenant": {
        "id": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
        "name": "Test 1",
        "subdomain": "test-1",
        "type": "restaurant",
        "status": "active"
      },
      "restaurantId": "59519187-c9d9-4cfa-a85c-e642ffb89f1d",
      "restaurant": {
        "id": "59519187-c9d9-4cfa-a85c-e642ffb89f1d",
        "tenantId": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
        "name": "BurgerKing Palace Downtown",
        "logo": null,
        "address": "123 Main St, New York, NY 10003"
      },
      "createdAt": "2025-11-05T11:27:38.956Z",
      "updatedAt": "2025-11-05T11:27:38.956Z"
    }
  ],
  "total": 1250,
  "page": 1,
  "limit": 10,
  "totalPages": 125
}
```

**Note**: 
- This endpoint returns all users across all tenants **except SUPER_ADMIN users**. Only SUPER_ADMIN has access.
- Password field is **never** included in responses

**Example Requests**:
```http
# Search for users by name or email
GET /users?search=john@restaurant.com

# Filter active managers and sort by name
GET /users?role=manager&status=active&sortBy=name&sortOrder=ASC

# Filter users by tenant and restaurant
GET /users?tenantId=xxx&restaurantId=yyy&page=1&limit=20

# Combined search, filter, and sort
GET /users?search=john&role=manager&status=active&sortBy=lastLoginAt&sortOrder=DESC
```

### Create User
```http
POST /tenants/{tenantId}/users
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "John Doe",
  "email": "user@restaurant.com",
  "password": "securePassword123",
  "role": "manager",
  "phone": "+1234567890",
  "restaurantId": "restaurant-uuid"
}
```

**Required Role**: `TENANT_ADMIN` or `SUPER_ADMIN`

**Request Body**:
- `name` (string, required): User full name
- `email` (string, required): Unique email address
- `password` (string, required): User password
- `role` (enum, required): User role (`super_admin`, `tenant_admin`, `manager`, `waiter`, `kitchen_staff`)
- `phone` (string, optional): Phone number
- `restaurantId` (string, optional): Associated restaurant ID

**Response**: Created user object (without password field)
```json
{
  "id": "173b7bb0-1808-418a-8cd3-6d8d9b6366fd",
  "email": "user@restaurant.com",
  "phoneNumber": "+1234567890",
  "name": "John Doe",
  "role": "manager",
  "status": "active",
  "avatar": null,
  "permissions": null,
  "lastLoginAt": null,
  "emailVerifiedAt": null,
  "phoneVerifiedAt": null,
  "tenantId": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
  "tenant": {
    "id": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
    "name": "Test 1",
    "subdomain": "test-1"
  },
  "restaurantId": "59519187-c9d9-4cfa-a85c-e642ffb89f1d",
  "restaurant": {
    "id": "59519187-c9d9-4cfa-a85c-e642ffb89f1d",
    "name": "BurgerKing Palace Downtown"
  },
  "createdAt": "2025-11-05T11:27:38.956Z",
  "updatedAt": "2025-11-05T11:27:38.956Z"
}
```

**Note**: Password is never returned in the response

### Get All Users (by Tenant)
```http
GET /tenants/{tenantId}/users?page=1&limit=10&search=john&role=manager&status=active&restaurantId=xxx&sortBy=name&sortOrder=ASC
Authorization: Bearer your-access-token
```

**Required Role**: `TENANT_ADMIN` or `SUPER_ADMIN`

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `search` (string, optional): Search term to filter by name, email, or phoneNumber (case-insensitive)
- `sortBy` (string, optional): Field to sort by. Allowed values: `name`, `email`, `phoneNumber`, `role`, `status`, `createdAt`, `updatedAt`, `lastLoginAt` (default: `createdAt`)
- `sortOrder` (enum, optional): Sort order. Values: `ASC` or `DESC` (default: `DESC`)
- `role` (enum, optional): Filter by user role. Values: `tenant_admin`, `manager`, `waiter`, `kitchen_staff`
- `status` (enum, optional): Filter by user status. Values: `active`, `inactive`, `suspended`
- `restaurantId` (uuid, optional): Filter by restaurant ID

**Searchable Fields**: 
- `name` - User full name
- `email` - User email address
- `phoneNumber` - User phone number

**Sortable Fields**: 
- `name`, `email`, `phoneNumber`, `role`, `status`, `createdAt`, `updatedAt`, `lastLoginAt`

**Filterable Fields**: 
- `role` - User role (tenant_admin, manager, waiter, kitchen_staff)
- `status` - User status (active, inactive, suspended)
- `restaurantId` - Restaurant ID (users are automatically filtered by tenantId from URL parameter)

**Response**:
```json
{
  "data": [
    {
      "id": "173b7bb0-1808-418a-8cd3-6d8d9b6366fd",
      "email": "user@restaurant.com",
      "phoneNumber": "+1 (975) 554-4479",
      "name": "John Doe",
      "role": "waiter",
      "status": "active",
      "avatar": null,
      "permissions": null,
      "lastLoginAt": null,
      "emailVerifiedAt": null,
      "phoneVerifiedAt": null,
      "tenantId": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
      "restaurantId": "59519187-c9d9-4cfa-a85c-e642ffb89f1d",
      "restaurant": {
        "id": "59519187-c9d9-4cfa-a85c-e642ffb89f1d",
        "tenantId": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
        "name": "BurgerKing Palace Downtown"
      },
      "createdAt": "2025-11-05T11:27:38.956Z",
      "updatedAt": "2025-11-05T11:27:38.956Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

**Note**: 
- This endpoint returns users for a specific tenant. TENANT_ADMIN can only access their own tenant's users.
- Password field is **never** included in responses

**Example Requests**:
```http
# Search for users in a tenant
GET /tenants/{tenantId}/users?search=john

# Filter active waiters in a tenant
GET /tenants/{tenantId}/users?role=waiter&status=active&sortBy=name&sortOrder=ASC

# Filter users by restaurant within a tenant
GET /tenants/{tenantId}/users?restaurantId=xxx&page=1&limit=20
```

### Get User by ID
```http
GET /tenants/{tenantId}/users/{userId}
Authorization: Bearer your-access-token
```

**Required Role**: `TENANT_ADMIN` or `SUPER_ADMIN`

**Response**: User object (without password field)
```json
{
  "id": "173b7bb0-1808-418a-8cd3-6d8d9b6366fd",
  "email": "user@restaurant.com",
  "phoneNumber": "+1 (975) 554-4479",
  "name": "John Doe",
  "role": "manager",
  "status": "active",
  "avatar": null,
  "permissions": null,
  "lastLoginAt": null,
  "emailVerifiedAt": null,
  "phoneVerifiedAt": null,
  "tenantId": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
  "tenant": {
    "id": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
    "name": "Test 1",
    "subdomain": "test-1",
    "type": "restaurant",
    "status": "active"
  },
  "restaurantId": "59519187-c9d9-4cfa-a85c-e642ffb89f1d",
  "restaurant": {
    "id": "59519187-c9d9-4cfa-a85c-e642ffb89f1d",
    "tenantId": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
    "name": "BurgerKing Palace Downtown",
    "logo": null,
    "address": "123 Main St, New York, NY 10003"
  },
  "createdAt": "2025-11-05T11:27:38.956Z",
  "updatedAt": "2025-11-05T11:27:38.956Z"
}
```

**Note**: Password is never returned in the response

### Update User
```http
PATCH /tenants/{tenantId}/users/{userId}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john.doe@restaurant.com",
  "phoneNumber": "+1234567890",
  "restaurantId": "restaurant-uuid",
  "avatar": "https://example.com/avatar.jpg",
  "role": "manager",
  "status": "active"
}
```

**Required Role**: `TENANT_ADMIN` or `SUPER_ADMIN`

**Request Body** (all fields optional):
- `name` (string): User full name
- `email` (string): Updated email address
- `phoneNumber` (string): Updated phone number
- `restaurantId` (string): Associated restaurant ID
- `avatar` (string): Avatar image URL
- `role` (enum): User role (**SUPER_ADMIN only**)
- `status` (enum): User status (**SUPER_ADMIN only**)

**Role-Based Access Control**:
- **SUPER_ADMIN**: Can update any user, including role and status changes
- **TENANT_ADMIN**: Can only update users within their tenant with roles: `manager`, `waiter`, `kitchen_staff`
  - Cannot update other tenant admins or super admins
  - Cannot change roles or status

**Response**: Updated user object (without password field)
```json
{
  "id": "173b7bb0-1808-418a-8cd3-6d8d9b6366fd",
  "email": "john.doe@restaurant.com",
  "phoneNumber": "+1234567890",
  "name": "John Doe",
  "role": "manager",
  "status": "active",
  "avatar": "https://example.com/avatar.jpg",
  "permissions": null,
  "lastLoginAt": null,
  "emailVerifiedAt": null,
  "phoneVerifiedAt": null,
  "tenantId": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
  "tenant": {
    "id": "9abac963-c1c8-4f92-b65f-e92d3714b1a5",
    "name": "Test 1",
    "subdomain": "test-1"
  },
  "restaurantId": "restaurant-uuid",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "BurgerKing Palace Downtown"
  },
  "createdAt": "2025-11-05T11:27:38.956Z",
  "updatedAt": "2025-11-05T11:27:38.956Z"
}
```

**Note**: Password is never returned in the response

**Error Responses**:
- `400 Bad Request`: Validation error
- `403 Forbidden`: Insufficient permissions
  - "Tenant admin can only update managers, waiters, and kitchen staff"
  - "Cannot update user from different tenant"
  - "Only super admin can change user roles"
  - "Only super admin can change user status"
- `404 Not Found`: User not found
- `409 Conflict`: Email already exists

### Archive User
```http
POST /tenants/{tenantId}/users/{userId}/archive
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`

**Note**: Archives a user by setting status to `INACTIVE`. Archived users are filtered out by default in list endpoints.

**OTP Details**:
- **Length**: 6 digits
- **Expiry**: 5 minutes
- **Format**: Numeric only (e.g., 123456)
- **Delivery**: Via SMS (Notify.lk in production)
- **Multiple Sends**: You can send OTP multiple times to the same phone number with different names - only phone number is validated, name can be updated

**Important**: 
- Sending OTP again to the same phone number will generate a **new OTP** and **overwrite** the previous one
- You can change the name with each OTP request - the latest name will be used
- Example: First send with name "John", then send again with name "John Doe" - both are valid, latest name is used

**Response**: Updated user object with status `inactive`

**Error Responses**:
- `400 Bad Request`: User is already archived
- `404 Not Found`: User not found

### Unarchive/Reactivate User
```http
POST /tenants/{tenantId}/users/{userId}/unarchive
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`

**Note**: Unarchives a user by setting status back to `ACTIVE`. Only archived (inactive) users can be unarchived.

**Alternative Endpoint**:
```http
POST /tenants/{tenantId}/users/{userId}/reactivate
Authorization: Bearer your-access-token
```

**Response**: Updated user object with status `active`

**Error Responses**:
- `400 Bad Request`: User is not archived. Only archived users can be unarchived.
- `404 Not Found`: User not found

**Note**: The same endpoints are also available at `/users/{userId}/archive`, `/users/{userId}/unarchive`, and `/users/{userId}/reactivate` for SUPER_ADMIN access across all tenants.

### Reset Password (Send Temporary Password via Email)
```http
POST /tenants/{tenantId}/users/{userId}/reset-password
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN` or `TENANT_ADMIN`

**Description**: Resets a staff user's password and sends a temporary password via email. This endpoint generates a secure 8-character temporary password, hashes it, updates the user's password in the database, and sends an email to the user with the temporary password.

**Allowed User Roles** (can have password reset):
- `super_admin`
- `tenant_admin`
- `manager`
- `waiter`
- `kitchen_staff`

**Permission Rules**:
- **SUPER_ADMIN**: Can reset anyone's password
- **TENANT_ADMIN**: Can reset passwords for users in their tenant (except SUPER_ADMIN and other TENANT_ADMIN)

**Email Configuration Required**:
Before using this endpoint, configure SMTP settings in `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Response** (Success):
```json
{
  "message": "Password reset successfully. A temporary password has been sent to manager@restaurant.com",
  "email": "manager@restaurant.com"
}
```

**Email Sent to User**:
```
Subject: Password Reset - DineFlow

Hello [User Name],

Your temporary password: Xy9Kp2Lm

⚠️ Important Security Notice:
• This is a temporary password
• Please change it immediately after logging in
• Do not share this password with anyone
• This email should be deleted after use

How to use your temporary password:
1. Go to the DineFlow login page
2. Enter your email address
3. Use the temporary password above
4. You will be prompted to change your password
```

**Temporary Password Format**:
- 8 characters long
- Contains at least 1 uppercase letter (A-Z)
- Contains at least 1 lowercase letter (a-z)
- Contains at least 1 number (0-9)
- Randomly shuffled for security
- Example: `Xy9Kp2Lm`, `T5nWq8Rj`, `M3vBx7Yz`

**Error Responses**:

**404 Not Found** - User doesn't exist:
```json
{
  "statusCode": 404,
  "message": "User not found"
}
```

**400 Bad Request** - Not a staff user:
```json
{
  "statusCode": 400,
  "message": "Password reset is only available for staff users"
}
```

**403 Forbidden** - Insufficient permissions:
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions to reset this user's password"
}
```

**403 Forbidden** - Different tenant:
```json
{
  "statusCode": 403,
  "message": "Cannot reset password for user from different tenant"
}
```

**400 Bad Request** - Email send failed:
```json
{
  "statusCode": 400,
  "message": "Password was reset but failed to send email. Please contact support."
}
```

**Usage Example**:
```bash
# Get admin token
TOKEN=$(curl -s -X POST http://localhost:4001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.accessToken')

# Reset password for a user
curl -X POST http://localhost:4001/api/tenants/tenant-123/users/user-456/reset-password \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "message": "Password reset successfully. A temporary password has been sent to manager@restaurant.com",
#   "email": "manager@restaurant.com"
# }

# User receives email with temporary password
# User logs in with temporary password:
curl -X POST http://localhost:4001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@restaurant.com","password":"Xy9Kp2Lm"}'
```

**Security Features**:
- ✅ Passwords are hashed with bcrypt before storage
- ✅ Only staff roles can have passwords reset
- ✅ Role-based access control enforced
- ✅ Temporary passwords are cryptographically random
- ✅ Email sent via secure SMTP (TLS/SSL)
- ✅ All password resets are logged
- ✅ Users are prompted to change password after login

**Notes**:
- The password is immediately updated in the database
- The temporary password is only sent via email (not returned in API response for security)
- Users should change the temporary password immediately after logging in
- If email sending fails, the password is still reset (user should contact support)
- Server logs contain detailed information about password resets for audit purposes

## Restaurant/Outlet Management (Tenant-Scoped)

**⚠️ IMPORTANT**: This is the **recommended** approach for multi-tenant architecture. Use these endpoints instead of the legacy `/restaurants` endpoint.

Restaurants (also called "Outlets") are tenant-scoped and can only be managed by tenant administrators and super admins. The Restaurant entity uses the following fields:

**Restaurant Entity Fields**:
- `id` (uuid): Auto-generated unique identifier
- `tenantId` (uuid, required): Tenant this restaurant belongs to
- `name` (string, required): Restaurant/Outlet name
- `logo` (string, optional): Logo URL
- `address` (string, optional): Physical address
- `contactEmail` (string, optional): Contact email address
- `contactPhoneNumber` (string, optional): Contact phone number
- `openTime` (string, optional): Opening time in HH:mm format (e.g., "09:00")
- `closeTime` (string, optional): Closing time in HH:mm format (e.g., "22:00")
- `openHours` (object, optional): Opening hours by day range (e.g., `{"mon-fri": "10:00-22:00", "sat-sun": "09:00-23:00"}`)
- `createdAt`, `updatedAt`: Auto-managed timestamps

**Note**: The entity uses `contactEmail` and `contactPhoneNumber` as the primary fields. The legacy `email` and `phoneNumber` fields are not used in the tenant-scoped endpoints.

### Create Outlet/Restaurant
```http
POST /tenants/{tenantId}/outlets
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Pizza Palace Downtown",
  "address": "123 Main St, New York, NY 10001",
  "logo": "https://example.com/logo.png",
  "contactEmail": "downtown@pizzapalace.com",
  "contactPhoneNumber": "+1234567890",
  "openTime": "09:00",
  "closeTime": "22:00",
  "openHours": {
    "mon-fri": "10:00-22:00",
    "sat-sun": "09:00-23:00"
  }
}
```

**Required Role**: `SUPER_ADMIN` or `TENANT_ADMIN`

**Request Body**:
- `name` (string, required): Restaurant/Outlet name
- `address` (string, optional): Physical address
- `logo` (string, optional): Logo URL (currently accepts URL string - S3 upload not yet implemented)
- `contactEmail` (string, optional): Contact email address (validated as email)
- `contactPhoneNumber` (string, optional): Contact phone number (validated as phone number)
- `openTime` (string, optional): Opening time in HH:mm format (e.g., "09:00")
- `closeTime` (string, optional): Closing time in HH:mm format (e.g., "22:00")
- `openHours` (object, optional): Opening hours by day range

**Note**: 
- File upload to S3 is not yet implemented. Currently accepts `logo` as a URL string. You need to upload files separately and provide the URL.
- The `tenantId` is automatically set from the URL parameter - you don't need to include it in the request body.

**Response**: Created outlet/restaurant object with `id`, `tenantId`, and relations

### Get All Outlets (by Tenant)
```http
GET /tenants/{tenantId}/outlets?page=1&limit=10
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN` or `TENANT_ADMIN`

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)

**Note**: By default, only `active` outlets are returned. Archived outlets are filtered out.

**Response**:
```json
{
  "data": [...],
  "total": 8,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

### Get Outlet by ID
```http
GET /outlets/{outletId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Response**: Outlet/restaurant object with menus and users relations

### Update Outlet/Restaurant
```http
PATCH /tenants/{tenantId}/outlets/{outletId}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Restaurant Name",
  "address": "456 New Address",
  "logo": "https://example.com/new-logo.png",
  "contactEmail": "updated@pizzapalace.com",
  "contactPhoneNumber": "+9876543210",
  "openTime": "10:00",
  "closeTime": "23:00",
  "openHours": {
    "mon-fri": "11:00-21:00"
  }
}
```

**Required Role**: `SUPER_ADMIN` or `TENANT_ADMIN`

**Request Body** (all fields optional):
- `name` (string): Updated restaurant name
- `address` (string): Updated address
- `logo` (string): Updated logo URL
- `contactEmail` (string): Updated contact email address
- `contactPhoneNumber` (string): Updated contact phone number
- `openTime` (string): Updated opening time in HH:mm format
- `closeTime` (string): Updated closing time in HH:mm format
- `openHours` (object): Updated opening hours

**Response**: Updated outlet/restaurant object

### Delete (Archive) Outlet
```http
DELETE /tenants/{tenantId}/outlets/{outletId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN` or `TENANT_ADMIN`

**Note**: This archives the outlet (soft delete), setting status to `inactive`. Archived outlets are filtered out by default in list endpoints.

**Response**: 204 No Content

### Unarchive/Reactivate Outlet
```http
POST /tenants/{tenantId}/outlets/{outletId}/unarchive
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`

**Note**: Unarchives an outlet by setting status back to `active`. Only archived (inactive) outlets can be unarchived.

**Alternative Endpoint**:
```http
POST /tenants/{tenantId}/outlets/{outletId}/reactivate
Authorization: Bearer your-access-token
```

**Response**: Updated outlet object with status `active`

**Error Responses**:
- `400 Bad Request`: Outlet is not archived. Only archived outlets can be unarchived.
- `404 Not Found`: Outlet not found

### Restaurant Entity (Legacy - SingleClient Based)

**⚠️ LEGACY ENDPOINT**: This endpoint uses the **legacy SingleClient** approach and is maintained for backward compatibility only. **For new implementations, use `/tenants/:tenantId/outlets` instead.**

**Key Differences**:
- **Legacy endpoint** (`/restaurants`): Uses `singleclientId` and legacy domain model with `email`/`phoneNumber`
- **New endpoint** (`/tenants/:tenantId/outlets`): Uses `tenantId` and entity fields `contactEmail`/`contactPhoneNumber`

**SingleClient**: SingleClient is a legacy system used only in the `/restaurants` endpoint. The new multi-tenant architecture uses `tenantId` directly. SingleClient endpoints are available at `/singleclients/*` but are not part of the main restaurant management flow.

#### Get All Restaurants (Legacy)
```http
GET /restaurants?page=1&limit=10&search=pizza&tenantId=xxx&sortBy=name&sortOrder=ASC
Authorization: Bearer your-access-token
```

**Required Role**: Authenticated users (AccessAuthGuard)

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `search` (string, optional): Search term to filter by name, address, contactEmail, or contactPhoneNumber (case-insensitive)
- `sortBy` (string, optional): Field to sort by. Allowed values: `name`, `address`, `contactEmail`, `contactPhoneNumber`, `createdAt`, `updatedAt` (default: `createdAt`)
- `sortOrder` (enum, optional): Sort order. Values: `ASC` or `DESC` (default: `DESC`)
- `tenantId` (uuid, optional): Filter by tenant ID

**Searchable Fields**: 
- `name` - Restaurant name
- `address` - Restaurant address
- `contactEmail` - Contact email address
- `contactPhoneNumber` - Contact phone number

**Sortable Fields**: 
- `name`, `address`, `contactEmail`, `contactPhoneNumber`, `createdAt`, `updatedAt`

**Filterable Fields**: 
- `tenantId` - Tenant ID

**Response** (with filters):
```json
{
  "data": [...],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

**Response** (without filters - backward compatible):
```json
{
  "isSuccess": true,
  "value": [...],
  "message": "Restaurants retrieved successfully"
}
```

**Note**: 
- If any filter parameters (`search`, `sortBy`, `sortOrder`, `page`, `limit`, `tenantId`) are provided, the endpoint returns paginated results with enhanced filtering
- If no filter parameters are provided, the endpoint returns all restaurants in the legacy format for backward compatibility
- This endpoint uses SingleClient context, not tenant-scoped. **Prefer using `/tenants/:tenantId/outlets` for multi-tenant architecture**
- The response includes both `contactEmail`/`contactPhoneNumber` (from entity) and legacy `email`/`phoneNumber` fields for backward compatibility

**Example Requests**:
```http
# Search for restaurants by name or address
GET /restaurants?search=pizza

# Filter restaurants by tenant and sort by name
GET /restaurants?tenantId=xxx&sortBy=name&sortOrder=ASC

# Combined search, filter, and pagination
GET /restaurants?search=italian&tenantId=xxx&sortBy=createdAt&sortOrder=DESC&page=1&limit=20
```

#### Create Restaurant (Legacy)
```http
POST /restaurants
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Pizza Palace",
  "contactEmail": "info@pizzapalace.com",
  "contactPhoneNumber": "+1234567890",
  "tenantId": "tenant-uuid",
  "address": "123 Main St, New York, NY 10001",
  "logo": "https://example.com/logo.png",
  "openTime": "09:00",
  "closeTime": "22:00",
  "openHours": {
    "mon-fri": "10:00-22:00",
    "sat-sun": "09:00-23:00"
  },
  "email": "info@pizzapalace.com",
  "phoneNumber": "+1234567890",
  "isActive": true,
  "imageUrl": "https://example.com/restaurant.jpg",
  "logoUrl": "https://example.com/logo.png",
  "openingHour": 8,
  "closingHour": 22,
  "timeZone": "America/New_York",
  "webUrl": "https://pizzapalace.com",
  "paymentMethod": ["cash", "card_online"],
  "paymentTiming": "pay_at_last",
  "location": {
    "address": "123 Main St",
    "city": "New York",
    "country": "USA",
    "postCode": "10001",
    "state": "NY"
  },
  "singleclientId": "singleclient-uuid",
  "primaryColor": "#FFFFFF",
  "secondaryColor": "#000000",
  "tertiaryColor": "#F0F0F0"
}
```

**Request Body Fields**:

**Primary Fields** (recommended - matches entity structure):
- `name` (string, required): Restaurant name
- `tenantId` (uuid, optional): Tenant ID (recommended for multi-tenant architecture)
- `contactEmail` (string, optional): Contact email address (primary field)
- `contactPhoneNumber` (string, optional): Contact phone number (primary field)
- `address` (string, optional): Physical address
- `logo` (string, optional): Logo URL
- `openTime` (string, optional): Opening time in HH:mm format
- `closeTime` (string, optional): Closing time in HH:mm format
- `openHours` (object, optional): Opening hours by day range
- `primaryColor` (string, optional): Primary brand color (e.g. Hex code)
- `secondaryColor` (string, optional): Secondary brand color
- `tertiaryColor` (string, optional): Tertiary brand color

**Legacy Fields** (for backward compatibility):
- `email` (string, optional): Legacy email field (falls back to `contactEmail` if not provided)
- `phoneNumber` (string, optional): Legacy phone field (falls back to `contactPhoneNumber` if not provided)
- `singleclientId` (string, optional): Legacy SingleClient ID (auto-set from userId in controller)
- `isActive`, `imageUrl`, `logoUrl`, `openingHour`, `closingHour`, `timeZone`, `webUrl`, `paymentMethod`, `paymentTiming`, `location`: Legacy domain model fields

**Note**: 
- **For new implementations**: Use `/tenants/:tenantId/outlets` with `tenantId`, `contactEmail`, and `contactPhoneNumber`
- This legacy endpoint accepts both new entity fields (`contactEmail`, `contactPhoneNumber`, `tenantId`) and legacy fields (`email`, `phoneNumber`, `singleclientId`) for backward compatibility
- The endpoint uses SingleClient context when `singleclientId` is provided, but also supports `tenantId` for multi-tenant architecture
- Response includes all fields from the entity (including `contactEmail`, `contactPhoneNumber`, `openTime`, `closeTime`, `openHours`, and brand colors)

#### Update Restaurant
```http
PATCH /restaurants/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Pizza Palace",
  "primaryColor": "#FF5733",
  "secondaryColor": "#C70039",
  "tertiaryColor": "#900C3F",
  "paymentTiming": "pay_at_first"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Description**:
Partially update restaurant information. All fields from the Create Restaurant endpoint are supported.

**Response**:
Returns the updated restaurant object.

**Note**: For managing restaurant active status specifically, prefer the `/restaurants/{id}/status/toggle` endpoint.

## QR Code Management

### Generate QR Code
```http
POST /qr-codes
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "type": "TABLE",
  "restaurantId": "restaurant-uuid",
  "name": "Table 1",
  "description": "Main dining table"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**QR Code Type Enum**:
- `TABLE` - Restaurant table QR code (for table-based ordering)
- `FOOD_COURT` - Food court QR code (for food court ordering)
- `TAKE_AWAY` - Takeaway QR code (for takeaway/pickup orders)

**QR Code Status Enum**:
- `active` - QR code is active
- `inactive` - QR code is inactive

**Request Body**:
- `type` (enum, required): QR code type (`TABLE`, `FOOD_COURT`, or `TAKE_AWAY`)
- `restaurantId` (uuid, optional): Associated restaurant ID
- `name` (string, optional): QR code name/identifier
- `description` (string, optional): Description of the QR code

**QR Code Generation**:
- QR code is automatically generated using `qrcode` library
- QR code contains URL: `{QR_CODE_BASE_URL}/customer-portal/qr/{qrCodeId}/menu`
- When scanned, this URL returns the full restaurant menu immediately
- QR code image is stored as base64 data URL in `qrUrl` field
- Size is configurable via `QR_CODE_SIZE` environment variable (default: 200px)

**Response**:
```json
{
  "id": "uuid",
  "qrUrl": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "type": "TABLE",
  "status": "active",
  "name": "Table 1",
  "description": "Main dining table",
  "restaurantId": "restaurant-uuid",
  "restaurant": { ... },
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

### Get QR Code by Code/ID
```http
GET /qr-codes/code/{code}
```

**Public Endpoint** (no authentication required)

**Note**: Currently searches by ID, not by a separate code field. The `code` parameter is treated as the QR code ID.

**Response**: QR code details with associated restaurant info

### Get All QR Codes
```http
GET /qr-codes?page=1&limit=10
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)

**Response**:
```json
{
  "data": [...],
  "total": 45,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

### Get QR Code by ID
```http
GET /qr-codes/{id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Response**: QR code object with restaurant relation

### Update QR Code Status
```http
PATCH /qr-codes/{id}/status
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "status": "inactive"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Request Body**:
- `status` (enum, required): New status (`active` or `inactive`)

**Response**: Updated QR code object

### Delete QR Code
```http
DELETE /qr-codes/{id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN` or `TENANT_ADMIN`

**Response**: 204 No Content

## Customer Portal

The Customer Portal provides public endpoints for customers to browse menus and place orders. The order flow requires customer verification (name + phone) before order creation.

### Customer Access & Tenant Context

**Important Notes:**
- **Customers do NOT have tenantId** - They access restaurants directly via QR codes or restaurantId
- **Public Menu Access** - Customers can browse menus without authentication (via QR code or restaurantId)
- **Customer Verification Required** - Customers must provide name and phone number before creating orders (stored in DB)
- **No OTP Authentication Initially** - Customers can place orders without OTP verification initially
- **Order Status Tracking** - Customers can view their order status and history by phone number

### Customer Order Flow Overview

1. **View Menu** (Public) → Browse available menu items via QR code or restaurantId (no authentication required)
2. **Select Items** (Client-Side) → Add items to cart with quantity and customizations
3. **Review Order** (Client-Side) → Review selected items and total
4. **Customer Verification** (Public) → Enter name and phone number on verification page (customer details stored in DB)
5. **View Final Order and Total** (Public) → View complete order breakdown with total amount
6. **Create Order** (Public) → Submit order (no authentication required)
7. **Payment** (Public) → Process payment for the order
8. **View Order Status** (Public) → Track order status and view order history by phone number

See [Customer Order Flow](#customer-order-flow) section below for detailed step-by-step instructions.

### Customer Authentication (OTP + JWT Tokens)

**Required for Customer Portal orders only**. Customers verify their phone number via OTP and receive JWT access & refresh tokens for authenticated API calls.

**Note**: Restaurant staff do NOT need customer OTP - they use their own email/password login and can create orders on behalf of customers without OTP verification.

#### Send OTP
```http
POST /customer-portal/auth/send-otp
Content-Type: application/json

{
  "phoneNumber": "+94771234567",
  "name": "John Doe"
}
```

**Public Endpoint** (no authentication required)

**Request Body**:
- `phoneNumber` (string, required): Sri Lankan phone number in format +94XXXXXXXXX or 0XXXXXXXXX
- `name` (string, optional): Customer name

**Supported Phone Formats**:
- `+94771234567` (International format)
- `0771234567` (Local format)
- `94771234567` (Without + sign)

**Response (Success)**:
```json
{
  "message": "OTP sent to +94771234567. Valid for 5 minutes.",
  "expiresIn": 300,
  "otp": "123456"
}
```

**Note**: In production, `otp` field should be removed - OTP should only be sent via SMS.

**OTP Details**:
- **Length**: 6 digits
- **Expiry**: 5 minutes
- **Format**: Numeric only (e.g., 123456)
- **Delivery**: Via SMS (Notify.lk in production)

**Error Responses**:
```json
{
  "statusCode": 400,
  "message": "Invalid phone number format. Use format: +94771234567 or 0771234567"
}
```

#### Verify OTP and Get JWT Tokens
```http
POST /customer-portal/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+94771234567",
  "otp": "123456",
  "name": "John Doe"
}
```

**Public Endpoint** (no authentication required)

**Request Body**:
- `phoneNumber` (string, required): Same phone number used to request OTP
- `otp` (string, required): 6-digit OTP received via SMS
- `name` (string, optional): Customer name (will create/update customer record)

**Response (Success)**:
```json
{
  "verified": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "customer-uuid",
    "phone": "+94771234567",
    "name": "John Doe",
    "createdAt": "2025-12-16T08:00:00.000Z"
  }
}
```

**JWT Token Details**:
- **Access Token**: Valid for 1 hour, use for API authentication
- **Refresh Token**: Valid for 7 days, use to get new access token
- **Payload**: `{ sub: customerId, phone, name, type: 'customer' }`

**Customer Record**:
- If customer with phone number exists: Returns existing customer
- If customer doesn't exist: Creates new customer record
- Name is updated if provided

**Response (Failed - Invalid OTP)**:
```json
{
  "statusCode": 400,
  "message": "Invalid OTP. 2 attempt(s) remaining."
}
```

**Error Responses**:
```json
{
  "statusCode": 400,
  "message": "No OTP found for this phone number. Please request a new OTP."
}
```

```json
{
  "statusCode": 400,
  "message": "OTP has expired. Please request a new OTP."
}
```

```json
{
  "statusCode": 400,
  "message": "Maximum verification attempts exceeded. Please request a new OTP."
}
```

**Verification Rules**:
- **Maximum Attempts**: 3 attempts per OTP
- **After 3 Failed Attempts**: Must request new OTP
- **After Successful Verification**: OTP is deleted (one-time use)
- **Auto-Cleanup**: Expired OTPs are automatically removed

#### Refresh Access Token
```http
POST /customer-portal/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Public Endpoint** (no authentication required)

**Request Body**:
- `refreshToken` (string, required): Refresh token received from OTP verification

**Response (Success)**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Use Case**: When access token expires (after 1 hour), use refresh token to get a new access token without requiring OTP verification again.

**Error Responses**:
```json
{
  "statusCode": 400,
  "message": "Invalid or expired refresh token"
}
```

```json
{
  "statusCode": 400,
  "message": "Customer not found"
}
```

**Customer Authentication Flow**:
```
1. Customer enters phone number & name
   ↓
2. POST /customer-portal/auth/send-otp
   ↓
3. Customer receives SMS with 6-digit OTP
   ↓
4. Customer enters OTP in app
   ↓
5. POST /customer-portal/auth/verify-otp
   ↓
6. If verified ✅:
   - Customer record created/updated in database
   - JWT access & refresh tokens generated
   - Refresh token hashed and stored
   - Tokens returned to frontend
   ↓
7. Frontend stores tokens (localStorage/sessionStorage)
   ↓
8. Use access token for authenticated API calls:
   POST /customer-portal/order
   Headers: { Authorization: 'Bearer <accessToken>' }
   ↓
9. When access token expires (1 hour):
   POST /customer-portal/auth/refresh
   Get new access token
```

**Frontend Integration Example**:
```javascript
// 1. Send OTP
const { otp } = await axios.post('/api/customer-portal/auth/send-otp', {
  phoneNumber: '+94771234567',
  name: 'John Doe'
});

// 2. Verify OTP and get tokens
const { accessToken, refreshToken, customer } = await axios.post(
  '/api/customer-portal/auth/verify-otp',
  {
    phoneNumber: '+94771234567',
    otp: '123456',
    name: 'John Doe'
  }
);

// 3. Store tokens
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
localStorage.setItem('customer', JSON.stringify(customer));

// 4. Use access token for orders
await axios.post('/api/customer-portal/order', orderData, {
  headers: { Authorization: `Bearer ${accessToken}` }
});

// 5. Refresh token when expired
const { accessToken: newToken } = await axios.post(
  '/api/customer-portal/auth/refresh',
  { refreshToken }
);
localStorage.setItem('accessToken', newToken);
```

**Security Features**:
- ✅ OTP expires after 5 minutes
- ✅ Maximum 3 verification attempts per OTP
- ✅ JWT tokens signed with secret keys
- ✅ Refresh tokens hashed with bcrypt before storage
- ✅ Access tokens expire after 1 hour
- ✅ Refresh tokens expire after 7 days
- ✅ Customer records automatically created/updated
- ✅ Phone number uniqueness enforced

**Important Notes**:
- **Customer Portal Only**: OTP verification is ONLY required for customers creating orders themselves
- **Restaurant Staff**: Do NOT need customer OTP - staff use their own email/password login
- **Token Storage**: Store tokens securely in frontend (httpOnly cookies recommended for production)
- **Token Refresh**: Implement automatic token refresh on 401 errors
- **SMS Integration**: In production, integrate with Notify.lk or similar SMS service
- **Database**: Customer entity includes `refreshTokenHash` field for token validation

### Get QR Code Information
```http
GET /customer-portal/qr/{qrCode}
```

**Public Endpoint**

**Response**: QR code details and restaurant information

### Get Restaurant Menu via QR Code
```http
GET /customer-portal/qr/{qrCodeId}/menu
X-Tenant-ID: tenant-uuid (optional)
```

**Public Endpoint** (no authentication required)

This is the endpoint that customers land on when they scan a QR code. It returns the full restaurant menu immediately along with the table ID from the QR code.

**Tenant Identification** (optional):
- `X-Tenant-ID` header: Tenant ID (set by TenantMiddleware if subdomain is used)
- Subdomain: Extract tenant from subdomain (e.g., `restaurant.example.com`)
- Note: Customer portal endpoints work with restaurant IDs directly, so tenant ID is optional but recommended for multi-tenant isolation

**Note**: 
- All menu items are returned with the `isAvailable` flag. The frontend should handle filtering based on this flag.
- The `availableFrom` and `availableTo` fields are returned for informational/display purposes only and do not affect filtering.
- The `tableId` from the QR code is returned and should be used when creating orders (either via `qrCodeId` or `tableNo` field).
- **Category Details**: Each menu item includes full category information (id, name, code, description, image) instead of just the category name. If a menu item has no category, the `category` field will be `null`.

**Response**:
```json
{
  "qrCode": {
    "id": "qr-code-uuid",
    "tableId": "Table 5",
    "type": "TABLE"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "tenantId": "tenant-uuid",
    "name": "Italian Bistro",
    "logo": "https://example.com/logo.png",
    "address": "123 Main St, City",
    "contactEmail": "info@italianbistro.com",
    "contactPhoneNumber": "+1234567890",
    "openTime": "09:00",
    "closeTime": "22:00",
    "openHours": {
      "monday": "09:00-22:00",
      "tuesday": "09:00-22:00",
      ...
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "menus": [
    {
      "id": "menu-uuid",
      "category": {
        "id": "category-uuid",
        "name": "Appetizers",
        "code": "APPETIZERS",
        "description": "Starter dishes and small plates",
        "image": "https://example.com/appetizers.jpg"
      },
      "name": "Bruschetta",
      "price": "8.99",
      "image": "https://example.com/bruschetta.jpg",
      "description": "Toasted bread with tomatoes and basil",
      "note": "Classic Italian starter",
      "discount": 0,
      "quantityAvailable": 50,
      "preparationTime": 15,
      "isAvailable": true,
      "availableFrom": "12:00",
      "availableTo": "22:00",
      "variantOptions": null
    },
    ...
  ]
}
```

### Get Restaurant Information
```http
GET /customer-portal/restaurant/{slug}
```

**Public Endpoint**

**Response**: Restaurant details, menu availability, etc.

### Get Restaurant Menu
```http
GET /customer-portal/restaurant/{slug}/menu
```

**Public Endpoint**

**Note**: 
- All menu items are returned with the `isAvailable` flag. The frontend should handle filtering based on this flag.
- **Category Details**: Each menu item includes full category information (id, name, code, description, image) instead of just the category name. If a menu item has no category, the `category` field will be `null`.

**Response**: Full restaurant menu with categories (all items, including unavailable ones with `isAvailable: false`). Each menu item includes complete category details.

### Get Food Court Information
```http
GET /customer-portal/food-court/{slug}
```

**Public Endpoint**

**Response**: Food court details and vendor list

### Get Food Court Vendors
```http
GET /customer-portal/food-court/{slug}/vendors
```

**Public Endpoint**

**Response**: Array of vendor objects with menu information

### Get Vendor Menu
```http
GET /customer-portal/vendor/{vendorId}/menu
```

**Public Endpoint**

**Note**: All menu items are returned with the `isAvailable` flag. The frontend should handle filtering based on this flag.

**Response**: Vendor-specific menu (all items, including unavailable ones with `isAvailable: false`)

### Check Table Availability
```http
GET /customer-portal/table/{tableId}/availability?restaurantId={restaurantId}
```

**Public Endpoint** (No authentication required)

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant identifier

**Response**:
```json
{
  "available": true,
  "table": {
    "id": "table-uuid",
    "name": "Window Table 1",
    "tableNumber": "T-01",
    "capacity": 4,
    "status": "available",
    "restaurantId": "restaurant-uuid"
  }
}
```

**Response when table is not available**:
```json
{
  "available": false,
  "table": {
    "id": "table-uuid",
    "name": "Window Table 1",
    "status": "maintenance"
  },
  "message": "This table is currently under maintenance and is not available for orders."
}
```

**Table Status Values**:
- `available` - Table is available for orders
- `occupied` - Table is occupied (can still accept orders - multiple orders per table allowed)
- `reserved` - Table is reserved (cannot accept orders)
- `maintenance` - Table is under maintenance (cannot accept orders)

**Note**:
- This endpoint allows customers to check if a table is available before placing an order
- Tables with status `available` or `occupied` can accept orders (multiple orders per table allowed)
- Tables with status `reserved` or `maintenance` cannot be used for orders
- If the table is not found for the specified restaurant, `available` will be `false` with an appropriate message
- **Multiple Orders Per Table**: Customers can place multiple orders from the same table

**Error Responses**:
- `400 Bad Request`: `restaurantId` is required

## Customer Order Flow

The customer order flow follows these steps:

1. **View Menu** → Customer scans QR code or accesses restaurant menu (public endpoint)
2. **Select Food Items** → Customer selects menu items with quantity and customization options (client-side)
3. **Review Order** → Customer reviews selected items, quantities, and total amount (client-side)
4. **Check Table Availability** (Optional) → If ordering for a specific table, check if the table is available
5. **Customer Verification** → Customer enters name and phone number on verification page (customer details stored in DB)
6. **View Final Order and Total** → Customer views final order breakdown with total amount
7. **Create Order** → Order is created (no authentication required initially)
8. **Payment** → Customer processes payment for the order

### Step-by-Step Order Flow

#### Step 1: View Menu
```http
GET /customer-portal/qr/{qrCodeId}/menu
```
**Public Endpoint** - No authentication required

Returns restaurant menu with all available items. Customer can browse and select items.

#### Step 2: Select Food Items (Client-Side)
Customer selects menu items, specifies quantities, and adds customization options (special instructions). This is handled client-side before submitting the order.

**Example Order Items Structure**:
```json
{
  "orderItems": [
    {
      "menuId": "menu-item-uuid",
      "quantity": 2,
      "specialInstructions": {
        "portion": "full",
        "rice": "full",
        "chicken": "medium",
        "spiceLevel": "medium",
        "note": "No onions"
      }
    }
  ]
}
```

#### Step 3: Review Order (Client-Side)
Customer reviews the selected items, quantities, customization options, and total amount. This is handled client-side.

#### Step 4: Check Table Availability (Optional)
If the customer wants to order for a specific table, they should check table availability first:

```http
GET /customer-portal/table/{tableId}/availability?restaurantId={restaurantId}
```

**Public Endpoint** - No authentication required

**Response**: Returns `{ available: true/false, table: {...}, message: "..." }`

**Note**: 
- Only proceed with order creation if `available: true`
- If table is not available, customer should choose a different table or proceed without table assignment

#### Step 5: Customer Verification
Customer enters name and phone number on the verification page. This stores the customer details in the database.

```http
POST /customer-portal/customer/verify
Content-Type: application/json

{
  "phone": "+1234567890",
  "customerName": "John Doe"
}
```

**Public Endpoint** - No authentication required

**Request Body**:
- `phone` (string, required): Customer phone number (E.164 format, e.g., `+1234567890`)
- `customerName` (string, required): Customer full name

**Response**:
```json
{
  "customerId": "customer-uuid",
  "phone": "+1234567890",
  "customerName": "John Doe",
  "message": "Customer details verified and stored successfully"
}
```

**Note**: 
- Customer account is created if it doesn't exist
- If customer already exists, name is updated if different
- This must be called before calculating order total

#### Step 6: View Final Order and Total
After customer verification, customer can view the final order breakdown with total amount.

```http
POST /customer-portal/order/calculate-total
Content-Type: application/json

{
  "restaurantId": "restaurant-uuid",
  "phone": "+1234567890",
  "customerName": "John Doe",
  "tableNo": "5",
  "tableId": "table-uuid",
  "qrCodeId": "qr-code-uuid",
  "orderItems": [
    {
      "menuId": "menu-item-uuid",
      "quantity": 2,
      "specialInstructions": {
        "portion": "full",
        "rice": "full",
        "chicken": "medium",
        "spiceLevel": "medium",
        "note": "No onions"
      }
    }
  ]
}
```

**Public Endpoint** - No authentication required

**Request Body**:
- `restaurantId` (uuid, required): Restaurant/outlet ID
- `phone` (string, required): Customer phone number (must match verified customer)
- `customerName` (string, required): Customer name (must match verified customer)
- `tableNo` (string, optional): Table number/ID (from QR code)
- `tableId` (uuid, optional): Table ID (UUID)
- `qrCodeId` (uuid, optional): QR code ID (used to get table ID if tableNo not provided)
- `orderItems` (array, required): Array of order items with:
  - `menuId` (uuid, required): Menu item ID
  - `quantity` (number, required): Quantity (minimum: 1)
  - `specialInstructions` (string or object, optional): Special instructions as text or JSON object

**Response**:
```json
{
  "customer": {
    "id": "customer-uuid",
    "phone": "+1234567890",
    "customerName": "John Doe"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace",
    "address": "123 Main St"
  },
  "orderItems": [
    {
      "menuId": "menu-item-uuid",
      "menuName": "Margherita Pizza",
      "category": "Main Courses",
      "quantity": 2,
      "unitPrice": 12.99,
      "totalPrice": 25.98,
      "specialInstructions": {
        "portion": "full",
        "rice": "full",
        "chicken": "medium",
        "spiceLevel": "medium",
        "note": "No onions"
      }
    }
  ],
  "totalAmount": 25.98,
  "itemsBreakdown": [
    {
      "menuId": "menu-item-uuid",
      "menuName": "Margherita Pizza",
      "category": "Main Courses",
      "quantity": 2,
      "unitPrice": 12.99,
      "totalPrice": 25.98,
      "specialInstructions": {
        "portion": "full",
        "rice": "full",
        "chicken": "medium",
        "spiceLevel": "medium",
        "note": "No onions"
      }
    }
  ]
}
```

**Note**: 
- Customer must be verified first (via Step 5)
- Shows complete order breakdown with itemized pricing
- Validates menu item availability
- Validates all items belong to the specified restaurant

#### Step 7: Create Order
```http
POST /customer-portal/order
Content-Type: application/json

{
  "restaurantId": "restaurant-uuid",
  "phone": "+1234567890",
  "customerName": "John Doe",
  "tableNo": "5",
  "tableId": "table-uuid",
  "qrCodeId": "qr-code-uuid",
  "orderType": "dine_in",
  "orderItems": [
    {
      "menuId": "menu-item-uuid",
      "quantity": 2,
      "specialInstructions": {
        "portion": "full",
        "rice": "full",
        "chicken": "medium",
        "spiceLevel": "medium",
        "note": "No onions"
      }
    }
  ],
  "paymentMethod": "cashier"
}
```

**Public Endpoint** - No authentication required

**Request Body**:
- `restaurantId` (uuid, required): Restaurant/outlet ID
- `phone` (string, required): Customer phone number (must match verified customer)
- `customerName` (string, required): Customer name (must match verified customer)
- `tableNo` (string, optional): Table number/ID (from QR code). If not provided, will be extracted from `qrCodeId`
- `tableId` (uuid, optional): Table ID (UUID). If provided, the table must be available or occupied. Tables with status `maintenance` or `reserved` cannot be used for orders.
- `qrCodeId` (uuid, optional): QR code ID (used to get table ID if `tableNo` is not provided)
- `orderType` (enum, optional): Order type - `takeaway` (customer takes food to go) or `dine_in` (customer dines at restaurant). Defaults to `dine_in` if `tableId` or `tableNo` is provided, otherwise `takeaway`.
- `orderItems` (array, required): Array of order items with:
  - `menuId` (uuid, required): Menu item ID
  - `quantity` (number, required): Quantity (minimum: 1)
  - `specialInstructions` (string or object, optional): Special instructions as text or JSON object for customization options
- `paymentMethod` (enum, required): Payment method selected by customer. Valid values: `cash`, `card`, `qr`, `cashier`

**Payment Method Values**:
- `cash` - Cash payment (payment status: `paid`)
- `card` - Card payment (payment status: `paid`)
- `qr` - QR code payment (payment status: `paid`)
- `cashier` - Payment at cashier counter (payment status: `pending`, cashier will mark as paid later)

**Auto-Confirmation for Pay-at-Last Restaurants**:
- **If restaurant has `paymentTiming: 'pay_at_last'`**: Order is automatically set to `CONFIRMED` status and sent directly to kitchen (skips `PENDING` status)
- **If restaurant has `paymentTiming: 'pay_at_first'`**: Order starts as `PENDING` and requires staff confirmation before going to kitchen
- This behavior is automatic based on the restaurant's `paymentTiming` setting

**Note**: 
- **No Authentication Required**: This endpoint is public. Customer must complete verification (Step 5) first.
- **Customer Verification**: Customer details must be verified before creating order (via `/customer-portal/customer/verify`)
- **Payment Method Required**: Customer must select a payment method when creating the order
- **Payment Status Logic**: 
  - If payment method is `cashier`: Payment status is `pending` (cashier will mark as paid when payment is received)
  - If payment method is `cash`, `card`, or `qr`: Payment status is `paid` immediately
- **Table ID Tracking**: Table ID is automatically extracted from QR code if `qrCodeId` is provided. The `tableNo` field stores the table identifier for tracking and delivery purposes.
- **Table Availability Validation**: If `tableId` is provided, the system checks table status. Tables with status `available` or `occupied` can accept orders (multiple orders per table allowed). Tables with status `maintenance` or `reserved` cannot be used for orders.
- **Table Status**: Table status is NOT automatically changed when orders are created. Staff can manage table status manually via the table management endpoints.
- **Multiple Orders Per Table**: Customers can place multiple orders from the same table
- Customer record is created/updated during verification (Step 5)
- Order status depends on restaurant payment timing (see Auto-Confirmation section above)
- Payment entity is automatically created with the selected payment method
- Order number is automatically generated in format `ORD` + 6-digit number (e.g., `ORD000001`, `ORD1234479`)
- Total amount is automatically calculated from menu prices
- Order items are created with status `pending`
- **Availability Check**: Only menu items with `isAvailable: true` can be ordered. Unavailable items will result in an error
- **Restaurant Validation**: All menu items must belong to the specified restaurant
- **Order Type Default**: If `orderType` is not provided, it defaults to `dine_in` if a table is specified, otherwise `takeaway`

#### Step 8: Payment
After order is created, customer can process payment.

```http
POST /customer-portal/order/{orderId}/payment?phone={phone}
Content-Type: application/json

{
  "paymentMethod": "card",
  "amount": 25.98
}
```

**Public Endpoint** - No authentication required

**Query Parameters**:
- `phone` (string, required): Customer phone number for verification

**Request Body**:
- `paymentMethod` (string, required): Payment method. Valid values: `cash`, `card`, `qr`, `cashier`
- `amount` (number, required): Payment amount (must exactly match order total)

**Payment Method Values**:
- `cash` - Cash payment
- `card` - Card payment (online or at counter)
- `qr` - QR code payment
- `cashier` - Payment at cashier counter (payment will be marked as pending until cashier confirms)

**Note**: 
- Customer phone number must match the order's customer
- Payment amount **must exactly match** the order total amount (validation error if mismatch)
- Payment record is created with status `paid` and linked to the order
- Invalid payment method will result in validation error

**Response**:
```json
{
  "success": true,
  "payment": {
    "id": "payment-uuid",
    "orderId": "order-uuid",
    "method": "card",
    "amount": 25.98,
    "status": "paid",
    "createdAt": "2025-01-11T21:00:00.000Z"
  },
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD000001",
    "totalAmount": 25.98,
    "status": "pending"
  }
}
```

**Response**: Created order object with order ID, status, total amount, order number, table ID, customer name, and items grouped by category

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "tableNo": "5",
  "customerName": "John Doe",
  "status": "pending",
  "totalAmount": 25.98,
  "paymentMethod": "cashier",
  "paymentStatus": "pending",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "itemsByCategory": [
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "order-item-uuid",
          "menuId": "menu-item-uuid",
          "menuName": "Margherita Pizza",
          "quantity": 2,
          "unitPrice": 12.99,
          "totalPrice": 25.98,
          "specialInstructions": {
            "portion": "full",
            "rice": "full",
            "chicken": "medium",
            "spiceLevel": "medium",
            "note": "No onions"
          },
          "status": "pending",
          "category": "Main Courses"
        }
      ]
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

### Verify Customer (Customer Portal)
```http
POST /customer-portal/customer/verify
Content-Type: application/json

{
  "phone": "+1234567890",
  "customerName": "John Doe"
}
```

**Public Endpoint** - No authentication required

**Request Body**:
- `phone` (string, required): Customer phone number (E.164 format, e.g., `+1234567890`)
- `customerName` (string, required): Customer full name

**Response**:
```json
{
  "customerId": "customer-uuid",
  "phone": "+1234567890",
  "customerName": "John Doe",
  "message": "Customer details verified and stored successfully"
}
```

**Note**: 
- Customer account is created if it doesn't exist
- If customer already exists, name is updated if different
- This must be called before calculating order total or creating order
- Customer details are stored in the database for order processing

### Calculate Order Total (Customer Portal)
```http
POST /customer-portal/order/calculate-total
Content-Type: application/json

{
  "restaurantId": "restaurant-uuid",
  "phone": "+1234567890",
  "customerName": "John Doe",
  "orderItems": [
    {
      "menuId": "menu-item-uuid",
      "quantity": 2,
      "specialInstructions": {
        "portion": "full",
        "spiceLevel": "medium"
      }
    }
  ]
}
```

**Public Endpoint** - No authentication required

**Request Body**:
- `restaurantId` (uuid, required): Restaurant/outlet ID
- `phone` (string, required): Customer phone number (must match verified customer)
- `customerName` (string, required): Customer name (must match verified customer)
- `tableNo` (string, optional): Table number/ID (from QR code)
- `tableId` (uuid, optional): Table ID (UUID)
- `qrCodeId` (uuid, optional): QR code ID (used to get table ID if tableNo not provided)
- `orderItems` (array, required): Array of order items with:
  - `menuId` (uuid, required): Menu item ID
  - `quantity` (number, required): Quantity (minimum: 1)
  - `specialInstructions` (string or object, optional): Special instructions as text or JSON object

**Response**:
```json
{
  "customer": {
    "id": "customer-uuid",
    "phone": "+1234567890",
    "customerName": "John Doe"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace",
    "address": "123 Main St"
  },
  "orderItems": [
    {
      "menuId": "menu-item-uuid",
      "menuName": "Margherita Pizza",
      "category": "Main Courses",
      "quantity": 2,
      "unitPrice": 12.99,
      "totalPrice": 25.98,
      "specialInstructions": {
        "portion": "full",
        "spiceLevel": "medium"
      }
    }
  ],
  "totalAmount": 25.98,
  "itemsBreakdown": [
    {
      "menuId": "menu-item-uuid",
      "menuName": "Margherita Pizza",
      "category": "Main Courses",
      "quantity": 2,
      "unitPrice": 12.99,
      "totalPrice": 25.98,
      "specialInstructions": {
        "portion": "full",
        "spiceLevel": "medium"
      }
    }
  ]
}
```

**Note**: 
- Customer must be verified first (via `/customer-portal/customer/verify`)
- Shows complete order breakdown with itemized pricing
- Validates menu item availability
- Validates all items belong to the specified restaurant

### Get User Orders (Customer Portal)
```http
GET /customer-portal/orders?phone={phone}&page={page}&limit={limit}
```

**Public Endpoint** - No authentication required

**Query Parameters**:
- `phone` (string, required): Customer phone number
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)

**Note**:
- Returns all orders for the customer identified by phone number
- Orders are filtered by the customer's phone number
- Customers can only view their own orders

**Response**: Paginated response with orders grouped by order ID. Each order includes table ID, customer name, order status, and items grouped by category.

**Response Format**:
```json
{
  "data": [
    {
      "id": "order-uuid-1",
      "orderNumber": "ORD000001",
      "tableNo": "5",
      "customerName": "John Doe",
      "status": "pending",
      "totalAmount": 45.97,
      "paymentMethod": "cashier",
      "paymentStatus": "pending",
      "restaurant": {
        "id": "restaurant-uuid",
        "name": "Pizza Palace"
      },
      "itemsByCategory": [
        {
          "category": "Appetizers",
          "items": [
            {
              "id": "order-item-uuid-1",
              "menuId": "menu-item-uuid-1",
              "menuName": "Bruschetta",
              "quantity": 1,
              "unitPrice": 8.99,
              "totalPrice": 8.99,
              "specialInstructions": null,
              "status": "pending",
              "category": "Appetizers"
            }
          ]
        }
      ],
      "createdAt": "2025-01-11T21:00:00.000Z",
      "updatedAt": "2025-01-11T21:00:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

**Example Response**:
```json
[
  {
    "id": "order-uuid-1",
    "orderNumber": "ORD000001",
    "tableNo": "5",
    "customerName": "John Doe",
    "status": "pending",
    "totalAmount": 45.97,
    "restaurant": {
      "id": "restaurant-uuid",
      "name": "Pizza Palace"
    },
    "itemsByCategory": [
      {
        "category": "Appetizers",
        "items": [
          {
            "id": "order-item-uuid-1",
            "menuId": "menu-item-uuid-1",
            "menuName": "Bruschetta",
            "quantity": 1,
            "unitPrice": 8.99,
            "totalPrice": 8.99,
            "specialInstructions": null,
            "status": "pending",
            "category": "Appetizers"
          }
        ]
      },
      {
        "category": "Main Courses",
        "items": [
          {
            "id": "order-item-uuid-2",
            "menuId": "menu-item-uuid-2",
            "menuName": "Margherita Pizza",
            "quantity": 2,
            "unitPrice": 12.99,
            "totalPrice": 25.98,
            "specialInstructions": {
              "note": "Extra cheese"
            },
            "status": "pending",
            "category": "Main Courses"
          },
          {
            "id": "order-item-uuid-3",
            "menuId": "menu-item-uuid-3",
            "menuName": "Pasta Carbonara",
            "quantity": 1,
            "unitPrice": 11.00,
            "totalPrice": 11.00,
            "specialInstructions": null,
            "status": "pending",
            "category": "Main Courses"
          }
        ]
      }
    ],
    "createdAt": "2025-01-11T21:00:00.000Z",
    "updatedAt": "2025-01-11T21:00:00.000Z"
  }
]
```

**Note**: 
- Orders are returned in descending order by creation date (most recent first)
- Each order is grouped by order ID
- Items within each order are grouped by category
- Only orders belonging to the customer with the provided phone number are returned

### Get Order Details (Customer Portal)
```http
GET /customer-portal/order/{orderId}?phone={phone}
```

**Public Endpoint** - No authentication required

**Query Parameters**:
- `phone` (string, required): Customer phone number for verification

**Note**:
- Returns detailed information about a specific order
- Only orders belonging to the customer with the provided phone number can be accessed
- Order status is included in the response (pending, confirmed, preparing, ready, completed, cancelled)
- Customers can track their order status in real-time

**Response**: Detailed order object with table ID, customer name, order status, and items grouped by category.

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "tableNo": "5",
  "customerName": "John Doe",
  "status": "pending",
  "totalAmount": 45.97,
  "paymentMethod": "cashier",
  "paymentStatus": "pending",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "itemsByCategory": [
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "order-item-uuid-1",
          "menuId": "menu-item-uuid-1",
          "menuName": "Margherita Pizza",
          "quantity": 2,
          "unitPrice": 12.99,
          "totalPrice": 25.98,
          "specialInstructions": {
            "note": "Extra cheese"
          },
          "status": "pending",
          "category": "Main Courses"
        }
      ]
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

### Cancel Order (Customer Portal)
```http
PATCH /customer-portal/order/{orderId}/cancel?phone={phone}
Content-Type: application/json

{
  "reason": "Changed my mind"
}
```

**Public Endpoint** - No authentication required

**Query Parameters**:
- `phone` (string, required): Customer phone number for verification

**Request Body**:
- `reason` (string, optional): Reason for cancelling the order

**Note**:
- Customers can only cancel their own orders
- Only orders with status `pending`, `confirmed`, `preparing`, or `ready` can be cancelled
- Orders with status `completed`, `served`, or `cancelled` cannot be cancelled
- The order status will be updated to `cancelled` after successful cancellation

**Response**: Cancelled order object with updated status and all order details.

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "tableNo": "5",
  "customerName": "John Doe",
  "status": "cancelled",
  "totalAmount": 45.97,
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "itemsByCategory": [
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "order-item-uuid-1",
          "menuId": "menu-item-uuid-1",
          "menuName": "Margherita Pizza",
          "quantity": 2,
          "unitPrice": 12.99,
          "totalPrice": 25.98,
          "specialInstructions": null,
          "status": "pending",
          "category": "Main Courses"
        }
      ]
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:05:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Order cannot be cancelled (already completed, served, or cancelled)
- `403 Forbidden`: Order does not belong to the authenticated customer
- `404 Not Found`: Order not found

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "tableNo": "5",
  "customerName": "John Doe",
  "status": "pending",
  "totalAmount": 45.97,
  "paymentMethod": "cashier",
  "paymentStatus": "pending",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "itemsByCategory": [
    {
      "category": "Appetizers",
      "items": [
        {
          "id": "order-item-uuid-1",
          "menuId": "menu-item-uuid-1",
          "menuName": "Bruschetta",
          "quantity": 1,
          "unitPrice": 8.99,
          "totalPrice": 8.99,
          "specialInstructions": null,
          "status": "pending",
          "category": "Appetizers"
        }
      ]
    },
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "order-item-uuid-2",
          "menuId": "menu-item-uuid-2",
          "menuName": "Margherita Pizza",
          "quantity": 2,
          "unitPrice": 12.99,
          "totalPrice": 25.98,
          "specialInstructions": {
            "note": "Extra cheese"
          },
          "status": "pending",
          "category": "Main Courses"
        }
      ]
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

**Note**: 
- Order items are grouped by category for easier viewing
- Only orders belonging to the customer with the provided phone number can be accessed

## Customer Management

The Customer Management module provides endpoints for administrators to view and manage customers with role-based access control. Customers are automatically created when they place their first order.

### Customer Entity

**Customer Entity Fields**:
- `id` (uuid): Auto-generated unique identifier
- `phone` (string, unique): Customer phone number (E.164 format, e.g., `+1234567890`)
- `name` (string): Customer name
- `createdAt`, `updatedAt`: Auto-managed timestamps

**Note**: Customers are linked to restaurants and tenants through their orders. A customer can have orders from multiple restaurants and tenants.

### Get All Customers

```http
GET /customers?page=1&limit=10&tenantId={tenantId}&restaurantId={restaurantId}&search={search}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `page` (number, optional): Page number (default: 1, min: 1)
- `limit` (number, optional): Items per page (default: 10, min: 1, max: 100)
- `tenantId` (uuid, optional): Filter by tenant ID (**SUPER_ADMIN only**)
- `restaurantId` (uuid, optional): Filter by restaurant ID
- `search` (string, optional): Search by customer name or phone number (case-insensitive)

**Role-Based Access**:
- **SUPER_ADMIN**: Can view all customers across all tenants and restaurants. Can filter by `tenantId` or `restaurantId`.
- **TENANT_ADMIN**: Can only view customers who have placed orders in their tenant's restaurants. Can filter by `restaurantId` (must belong to their tenant).
- **MANAGER**: Can only view customers who have placed orders in their restaurant.

**Response**:
```json
{
  "data": [
    {
      "id": "customer-uuid",
      "name": "John Doe",
      "phone": "+1234567890",
      "restaurants": [
        {
          "id": "restaurant-uuid-1",
          "name": "Pizza Palace Downtown",
          "tenantId": "tenant-uuid-1"
        },
        {
          "id": "restaurant-uuid-2",
          "name": "Pizza Palace Uptown",
          "tenantId": "tenant-uuid-1"
        }
      ],
      "tenants": [
        {
          "id": "tenant-uuid-1",
          "name": "Pizza Palace Chain",
          "subdomain": "pizza-palace"
        }
      ],
      "totalOrders": 5,
      "createdAt": "2025-01-11T21:00:00.000Z",
      "updatedAt": "2025-01-11T21:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15
}
```

**Response Fields**:
- `id`: Customer unique identifier
- `name`: Customer name
- `phone`: Customer phone number
- `restaurants`: Array of restaurants where the customer has placed orders (unique restaurants)
- `tenants`: Array of tenants where the customer has placed orders (unique tenants)
- `totalOrders`: Total number of orders placed by this customer
- `createdAt`, `updatedAt`: Timestamps

**Example Requests**:
```http
# Get all customers (SUPER_ADMIN)
GET /customers?page=1&limit=10

# Filter by tenant (SUPER_ADMIN only)
GET /customers?tenantId=tenant-uuid&page=1&limit=10

# Filter by restaurant
GET /customers?restaurantId=restaurant-uuid&page=1&limit=10

# Search customers by name or phone
GET /customers?search=john&page=1&limit=10

# Combined filters
GET /customers?tenantId=tenant-uuid&restaurantId=restaurant-uuid&search=john&page=1&limit=20
```

**Error Responses**:
- `403 Forbidden`: Insufficient permissions or trying to access customers from a different tenant/restaurant
- `400 Bad Request`: Invalid query parameters

### Get Customer by ID

```http
GET /customers/{customerId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Role-Based Access**:
- **SUPER_ADMIN**: Can view any customer
- **TENANT_ADMIN**: Can only view customers who have placed orders in their tenant's restaurants
- **MANAGER**: Can only view customers who have placed orders in their restaurant

**Response**:
```json
{
  "id": "customer-uuid",
  "name": "John Doe",
  "phone": "+1234567890",
  "restaurants": [
    {
      "id": "restaurant-uuid-1",
      "name": "Pizza Palace Downtown",
      "tenantId": "tenant-uuid-1"
    }
  ],
  "tenants": [
    {
      "id": "tenant-uuid-1",
      "name": "Pizza Palace Chain",
      "subdomain": "pizza-palace"
    }
  ],
  "totalOrders": 5,
  "orders": [
    {
      "id": "order-uuid-1",
      "orderNumber": "ORD000001",
      "restaurantId": "restaurant-uuid-1",
      "restaurant": {
        "id": "restaurant-uuid-1",
        "name": "Pizza Palace Downtown"
      },
      "status": "completed",
      "totalAmount": 45.97,
      "tableNo": "5",
      "createdAt": "2025-01-11T21:00:00.000Z"
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

**Response Fields**:
- `id`: Customer unique identifier
- `name`: Customer name
- `phone`: Customer phone number
- `restaurants`: Array of restaurants where the customer has placed orders
- `tenants`: Array of tenants where the customer has placed orders
- `totalOrders`: Total number of orders placed by this customer
- `orders`: Array of all orders placed by this customer (with restaurant details)
- `createdAt`, `updatedAt`: Timestamps

**Error Responses**:
- `404 Not Found`: Customer not found
- `403 Forbidden`: Insufficient permissions or customer not accessible (customer has no orders in your tenant/restaurant)

### Create or Find Customer

```http
POST /customers
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "phone": "+1234567890",
  "name": "John Doe"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Request Body**:
- `phone` (string, required): Customer phone number (E.164 format, e.g., `+1234567890`, max 20 characters)
- `name` (string, required): Customer name (max 256 characters)

**Behavior**:
- If a customer with the provided phone number exists, returns the existing customer
- If the customer exists but the name is different, updates the customer name
- If no customer exists, creates a new customer with the provided phone and name

**Response**:
```json
{
  "id": "customer-uuid",
  "phone": "+1234567890",
  "name": "John Doe",
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

**Response Fields**:
- `id`: Customer unique identifier
- `phone`: Customer phone number
- `name`: Customer name
- `createdAt`, `updatedAt`: Timestamps

**Example Request**:
```http
POST /customers
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "phone": "+1234567890",
  "name": "John Doe"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid request body (missing required fields, invalid phone format)
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions

### Get Customer by Phone Number

```http
GET /customers/phone/{phone}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Path Parameters**:
- `phone` (string, required): Customer phone number (e.g., `+1234567890`)

**Role-Based Access**:
- **SUPER_ADMIN**: Can view any customer
- **TENANT_ADMIN**: Can only view customers who have placed orders in their tenant's restaurants
- **MANAGER/WAITER**: Can only view customers who have placed orders in their restaurant

**Response**:
```json
{
  "id": "customer-uuid",
  "name": "John Doe",
  "phone": "+1234567890",
  "restaurants": [
    {
      "id": "restaurant-uuid-1",
      "name": "Pizza Palace Downtown",
      "tenantId": "tenant-uuid-1"
    }
  ],
  "tenants": [
    {
      "id": "tenant-uuid-1",
      "name": "Pizza Palace Chain",
      "subdomain": "pizza-palace"
    }
  ],
  "totalOrders": 5,
  "orders": [
    {
      "id": "order-uuid-1",
      "orderNumber": "ORD000001",
      "restaurantId": "restaurant-uuid-1",
      "restaurant": {
        "id": "restaurant-uuid-1",
        "name": "Pizza Palace Downtown"
      },
      "status": "confirmed",
      "totalAmount": 150.00,
      "tableNo": "01",
      "createdAt": "2025-01-11T21:00:00.000Z"
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

**Response Fields**:
- `id`: Customer unique identifier
- `name`: Customer name
- `phone`: Customer phone number
- `restaurants`: Array of restaurants where the customer has placed orders
- `tenants`: Array of tenants where the customer has placed orders
- `totalOrders`: Total number of orders placed by this customer
- `orders`: Array of all orders placed by this customer (with restaurant details)
- `createdAt`, `updatedAt`: Timestamps

**Example Request**:
```http
GET /customers/phone/+1234567890
Authorization: Bearer your-access-token
```

**Error Responses**:
- `404 Not Found`: Customer not found with the provided phone number
- `403 Forbidden`: Insufficient permissions or customer not accessible (customer has no orders in your tenant/restaurant)
- `401 Unauthorized`: Missing or invalid authentication token

## Customer Ratings & Comments

The Customer Ratings & Comments API allows customers to rate and review restaurants, and enables administrators to view and manage ratings. Ratings are stored in a dedicated `customer_ratings` table linked to customers, restaurants, and optionally orders.

### Customer Rating Entity

**Customer Rating Entity Fields**:
- `id` (uuid): Auto-generated unique identifier
- `customerId` (uuid, required): Customer who submitted the rating
- `restaurantId` (uuid, required): Restaurant being rated
- `orderId` (uuid, optional): Associated order (if rating is for a specific order)
- `rating` (integer, required): Rating value from 1 to 5
- `comment` (text, optional): Review/comment text
- `metadata` (jsonb, optional): Additional metadata (e.g., detailed ratings for food quality, service, ambiance)
- `createdAt`, `updatedAt`: Auto-managed timestamps

### Create Customer Rating

```http
POST /customer-ratings
Content-Type: application/json

{
  "customerId": "customer-uuid",
  "restaurantId": "restaurant-uuid",
  "orderId": "order-uuid",
  "rating": 5,
  "comment": "Great food and excellent service! Will definitely come back.",
  "metadata": {
    "foodQuality": 5,
    "service": 4,
    "ambiance": 5,
    "valueForMoney": 4
  }
}
```

**Public Endpoint** (No authentication required) - Customers can submit ratings without authentication

**Request Body**:
- `customerId` (uuid, required): Customer ID
- `restaurantId` (uuid, required): Restaurant ID being rated
- `orderId` (uuid, optional): Order ID (if rating is for a specific order)
- `rating` (integer, required): Rating value (1-5, minimum: 1, maximum: 5)
- `comment` (string, optional): Review/comment text
- `metadata` (object, optional): Additional metadata with detailed ratings

**Validation**:
- Customer must exist
- Restaurant must exist
- If `orderId` is provided, the order must exist and belong to the specified customer and restaurant
- Rating must be between 1 and 5

**Response**:
```json
{
  "id": "rating-uuid",
  "customerId": "customer-uuid",
  "restaurantId": "restaurant-uuid",
  "orderId": "order-uuid",
  "rating": 5,
  "comment": "Great food and excellent service! Will definitely come back.",
  "metadata": {
    "foodQuality": 5,
    "service": 4,
    "ambiance": 5,
    "valueForMoney": 4
  },
  "customer": {
    "id": "customer-uuid",
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD000001"
  },
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input, rating out of range, or order validation failed
- `404 Not Found`: Customer or restaurant not found

### Get All Customer Ratings

```http
GET /customer-ratings?page=1&limit=10&customerId={customerId}&restaurantId={restaurantId}&orderId={orderId}&minRating={minRating}&maxRating={maxRating}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Query Parameters**:
- `page` (number, optional): Page number (default: 1, min: 1)
- `limit` (number, optional): Items per page (default: 10, min: 1, max: 100)
- `customerId` (uuid, optional): Filter by customer ID
- `restaurantId` (uuid, optional): Filter by restaurant ID
- `orderId` (uuid, optional): Filter by order ID
- `minRating` (number, optional): Minimum rating (1-5)
- `maxRating` (number, optional): Maximum rating (1-5)

**Response**:
```json
{
  "data": [
    {
      "id": "rating-uuid",
      "customerId": "customer-uuid",
      "restaurantId": "restaurant-uuid",
      "orderId": "order-uuid",
      "rating": 5,
      "comment": "Great food and excellent service!",
      "metadata": {
        "foodQuality": 5,
        "service": 4
      },
      "customer": {
        "id": "customer-uuid",
        "name": "John Doe",
        "phone": "+1234567890"
      },
      "restaurant": {
        "id": "restaurant-uuid",
        "name": "Pizza Palace"
      },
      "order": {
        "id": "order-uuid",
        "orderNumber": "ORD000001"
      },
      "createdAt": "2025-01-11T21:00:00.000Z",
      "updatedAt": "2025-01-11T21:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15
}
```

**Example Requests**:
```http
# Get all ratings for a restaurant
GET /customer-ratings?restaurantId=restaurant-uuid&page=1&limit=10

# Get all ratings from a customer
GET /customer-ratings?customerId=customer-uuid&page=1&limit=10

# Get ratings for a specific order
GET /customer-ratings?orderId=order-uuid

# Get only 4 and 5 star ratings
GET /customer-ratings?restaurantId=restaurant-uuid&minRating=4&maxRating=5

# Combined filters
GET /customer-ratings?restaurantId=restaurant-uuid&minRating=4&page=1&limit=20
```

### Get Customer Rating by ID

```http
GET /customer-ratings/{ratingId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Response**: Customer rating object with customer, restaurant, and order relations

**Error Responses**:
- `404 Not Found`: Rating not found
- `403 Forbidden`: Insufficient permissions

### Get Restaurant Average Rating

```http
GET /customer-ratings/restaurant/{restaurantId}/average
```

**Public Endpoint** (No authentication required) - For displaying restaurant ratings publicly

**Response**:
```json
{
  "averageRating": 4.5,
  "totalRatings": 150,
  "ratingDistribution": {
    "1": 5,
    "2": 10,
    "3": 20,
    "4": 50,
    "5": 65
  }
}
```

**Response Fields**:
- `averageRating`: Average rating (rounded to 1 decimal place)
- `totalRatings`: Total number of ratings
- `ratingDistribution`: Count of ratings for each rating value (1-5)

**Use Cases**:
- Display restaurant rating on public menu pages
- Show rating statistics in restaurant listings
- Calculate restaurant reputation scores

## Order Management

The order system is organized into multiple specialized modules with different endpoints for different use cases.

**📋 Detailed Order Flow Documentation**: For comprehensive information about what data is stored in Order and Customer tables, order creation process, and status handling (hold, cancel, payment), see [ORDER_CREATION_AND_STATUS_FLOW.md](./ORDER_CREATION_AND_STATUS_FLOW.md).

### ⚠️ IMPORTANT: Which Order Endpoints to Use

**There are THREE main sets of order endpoints for different use cases:**

#### 1. **Customer Portal Endpoints** (`/customer-portal/*`)
**Use for**: Customers placing their own orders  
**Base Path**: `/api/customer-portal`  
**Authentication**: **Public (No JWT required)**  
**Who uses**: End customers via QR code scanning or web portal

**Key Endpoints**:
- `POST /customer-portal/customer/verify` - Verify and store customer details (name + phone)
- `POST /customer-portal/order/calculate-total` - Calculate order total and show breakdown
- `POST /customer-portal/order` - Create order (customer self-service)
- `GET /customer-portal/orders?phone=...` - Get customer's orders by phone number
- `GET /customer-portal/order/:id?phone=...` - Get order details by phone verification
- `POST /customer-portal/order/:id/payment?phone=...` - Process payment
- `PATCH /customer-portal/order/:id/cancel?phone=...` - Cancel order

**Use these when**: Customer is placing their own order via QR code or web portal

---

#### 2. **Order Management Endpoints** (`/orders`)
**Use for**: Staff/Admin managing orders  
**Base Path**: `/api/orders`  
**Authentication**: **JWT Required (Staff/Admin roles)**  
**Who uses**: Restaurant staff, managers, admins

**Key Endpoints**:
- `POST /orders` - Create order (staff creating order on behalf of customer)
- `GET /orders` - Get all orders (with filters: restaurantId, status, date, paymentStatus)
- `GET /orders/:id` - Get order details
- `PATCH /orders/:id` - Update order details
- `DELETE /orders/:id` - Delete order (only if pending or cancelled)
- `POST /orders/:id/confirm` - Confirm order (staff confirms customer order)
- `POST /orders/:id/process-payment` - Process payment (staff processes payment)
- `POST /orders/:id/mark-done` - Mark order as done (cashier endpoint - changes status from pending to completed)
- `GET /orders/analytics/summary` - Get order analytics and reports

**Use these when**: Staff is managing orders (creating on behalf of customers, viewing all orders, analytics)

---

#### 3. **Order Status Endpoints** (`/order-status`)
**Use for**: Managing order status and order item status  
**Base Path**: `/api/order-status`  
**Authentication**: **JWT Required (Staff/Admin roles)**  
**Who uses**: Kitchen staff, waiters, managers

**Key Endpoints**:
- `GET /order-status/order/:id` - Get order with details
- `GET /order-status/order/:id/history` - Get order status history
- `GET /order-status/active-orders` - Get active orders
- `PATCH /order-status/order-item/:id/status` - Update order item status
- `POST /order-status/order/:id/mark-ready` - Mark order as ready
- `POST /order-status/order/:id/mark-completed` - Mark order as completed
- `POST /order-status/order/:id/cancel` - Cancel order (staff)
- `POST /order-status/order/:id/hold` - Put order on hold
- `POST /order-status/order/:id/release` - Release order from hold
- `POST /order-status` - Update order status (general)

**Use these when**: Managing order status transitions, order item status, hold/release operations

---

### Quick Reference: Endpoint Comparison

| Operation | Customer Endpoint | Staff Endpoint | Status Endpoint |
|-----------|------------------|----------------|-----------------|
| **Create Order** | `POST /customer-portal/order` (Public) | `POST /orders` (JWT) | N/A |
| **Get Orders** | `GET /customer-portal/orders?phone=...` (Public) | `GET /orders` (JWT) | `GET /order-status/active-orders` (JWT) |
| **Get Order Details** | `GET /customer-portal/order/:id?phone=...` (Public) | `GET /orders/:id` (JWT) | `GET /order-status/order/:id` (JWT) |
| **Cancel Order** | `PATCH /customer-portal/order/:id/cancel?phone=...` (Public) | N/A | `POST /order-status/order/:id/cancel` (JWT) |
| **Process Payment** | `POST /customer-portal/order/:id/payment?phone=...` (Public) | `POST /orders/:id/process-payment` (JWT) | N/A |
| **Mark Order Done** | N/A | `POST /orders/:id/mark-done` (JWT) | N/A |
| **Confirm Order** | N/A | `POST /orders/:id/confirm` (JWT) | N/A |
| **Update Order** | N/A | `PATCH /orders/:id` (JWT) | N/A |
| **Delete Order** | N/A | `DELETE /orders/:id` (JWT) | N/A |
| **Update Order Status** | N/A | N/A | `POST /order-status` (JWT) |
| **Update Order Item Status** | N/A | N/A | `PATCH /order-status/order-item/:id/status` (JWT) |
| **Mark Order Ready** | N/A | N/A | `POST /order-status/order/:id/mark-ready` (JWT) |
| **Order Analytics** | N/A | `GET /orders/analytics/summary` (JWT) | N/A |

### Decision Tree: Which Endpoint Should I Use?

#### For Customer Self-Service Orders:
1. Customer scans QR code → Views menu
2. Customer selects items → Goes to verification page
3. **Use**: `POST /customer-portal/customer/verify` - Store customer details
4. **Use**: `POST /customer-portal/order/calculate-total` - Show final order breakdown
5. **Use**: `POST /customer-portal/order` - Create order
6. **Use**: `POST /customer-portal/order/:id/payment` - Process payment
7. **Use**: `GET /customer-portal/orders?phone=...` - View orders

#### For Staff Managing Orders:
1. Staff takes order from customer at table
2. **Use**: `POST /orders` - Create order (staff creates on behalf of customer)
3. **Use**: `POST /orders/:id/confirm` - Confirm order
4. **Use**: `GET /orders` - View all orders
5. **Use**: `POST /orders/:id/process-payment` - Process payment
6. **Use**: `GET /orders/analytics/summary` - View analytics

#### For Kitchen/Status Management:
1. Kitchen staff views orders
2. **Use**: `GET /order-status/active-orders` - View active orders
3. **Use**: `PATCH /order-status/order-item/:id/status` - Update item status (start, ready)
4. **Use**: `POST /order-status/order/:id/mark-ready` - Mark order ready
5. **Use**: `POST /order-status/order/:id/mark-completed` - Mark order completed

### Module Structure

1. **OrderManagementModule** (`/orders`)
   - Order CRUD operations (create, read, update, delete) - **For Staff/Admin**
   - Order confirmation
   - Payment processing
   - Order analytics

2. **CustomerPortalModule** (`/customer-portal`)
   - Customer order creation - **For Customers (Public)**
   - Customer verification
   - Order total calculation
   - Customer order viewing and cancellation

3. **OrderStatusModule** (`/order-status`)
   - Order status management
   - Order item status updates
   - WebSocket gateway for real-time updates
   - Status history tracking
   - Hold/release operations

4. **KitchenDisplayModule**
   - Kitchen operations (view orders, start items, mark ready)
   - Kitchen statistics
   - Uses OrderStatusModule for status updates

**Real-time Updates**: All order status changes are automatically broadcast via WebSocket to subscribed clients. See [Real-time Order Status Updates (WebSocket)](#real-time-order-status-updates-websocket) section below.

---

## OrderManagementModule: Order CRUD Operations (Staff/Admin)

**⚠️ IMPORTANT**: These endpoints are for **Staff/Admin use only**. They require JWT authentication and appropriate roles.

**For customer order placement, use**: `/customer-portal/order` endpoints (see [Customer Portal](#customer-portal) section)

This module handles all order creation, updates, deletion, confirmation, payment processing, and analytics for restaurant staff.

**📱 Customer Phone Number Support**: When creating orders via `POST /orders`, you can pass a **phone number** as the `customerId` field. The system will:
- Automatically detect if `customerId` is a UUID or phone number
- If phone number: Look up customer by phone, or create new customer if not found
- If UUID: Look up customer by ID (must exist)
- This allows staff to quickly create orders for customers using just their phone number

### Create Order (Staff/Admin)
```http
POST /orders
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "restaurantId": "restaurant-uuid",
  "customerId": "+1234567890",
  "tableNo": "5",
  "tableId": "table-uuid",
  "orderType": "dine_in",
  "orderItems": [
    {
      "menuId": "menu-item-uuid",
      "quantity": 2,
      "specialInstructions": {
        "portion": "full",
        "rice": "full",
        "chicken": "medium",
        "spiceLevel": "medium",
        "note": "No onions"
      }
    }
  ],
  "notes": "Customer prefers window seating",
  "paymentMethod": "card"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Request Body**:
- `restaurantId` (uuid, required): Restaurant/outlet ID
- `customerId` (string, required): Customer identifier - can be:
  - **Phone number** (e.g., `+1234567890`) - Customer will be looked up or created by phone
  - **Customer UUID** (e.g., `d9351999-259b-47df-b56a-960c3b27a7ec`) - Existing customer ID
- `tableNo` (string, optional): Table number/identifier
- `tableId` (uuid, optional): Table ID (UUID). If provided, the table must be available or occupied. Tables with status `maintenance` or `reserved` cannot be used for orders.
- `orderType` (enum, optional): Order type - `takeaway` (customer takes food to go) or `dine_in` (customer dines at restaurant). Defaults to `dine_in` if `tableId` or `tableNo` is provided, otherwise `takeaway`.
- `orderItems` (array, required): Array of order items with:
  - `menuId` (uuid, required): Menu item ID
  - `quantity` (number, required): Quantity (minimum: 1)
  - `specialInstructions` (string or object, optional): Special instructions as text or JSON object for options like `{"portion": "full", "rice": "full", "chicken": "medium", "spiceLevel": "medium", "note": "No onions"}`
  - `addonIds` (array of UUIDs, optional): List of addon identifiers applied to the item
- `notes` (string, optional): Order notes
- `paymentMethod` (enum, **required**): Payment method selected by staff for the order. **Staff must select a payment method when creating orders from the restaurant portal.** Valid values:
  - `cash` - Cash payment
  - `card` - Card payment  
  - `qr` - QR code payment
  - `cashier` - Payment at cashier counter (payment will be marked as pending until cashier confirms)
- `customerInfo` (string, optional): Serialized customer details

**Note**:
- **Customer Phone Number Support**: You can pass a phone number as `customerId`. The system will:
  - Check if it's a valid UUID format
  - If UUID: Look up customer by ID
  - If phone number: Look up customer by phone, or create new customer if not found
- **Customer Creation**: If customer doesn't exist and phone number is provided, a new customer account is automatically created with default name "Customer"

**Payment Method Values**:
- `cash` - Cash payment (payment status: `paid`)
- `card` - Card payment (payment status: `paid`)
- `qr` - QR code payment (payment status: `paid`)
- `cashier` - Payment at cashier counter (payment status: `pending`, cashier will mark as paid later)

**Payment Method Requirement**:
- **Restaurant Portal (`POST /orders`)**: `paymentMethod` is **required** when creating orders. Staff must select a payment method during order creation.
- **Customer Portal (`POST /customer-portal/order`)**: `paymentMethod` is also required when customers create their own orders.

**Auto-Confirmation for Pay-at-Last Restaurants**:
- **If restaurant has `paymentTiming: 'pay_at_last'`**: Order is automatically set to `CONFIRMED` status and sent directly to kitchen (skips `PENDING` status)
- **If restaurant has `paymentTiming: 'pay_at_first'`**: Order starts as `PENDING` and requires staff confirmation before going to kitchen
- This behavior is automatic based on the restaurant's `paymentTiming` setting

**Note**: 
- **Payment Entity Creation**: If `paymentMethod` is provided, a Payment entity is automatically created with the selected payment method
- **Table Availability**: If `tableId` is provided, tables with status `available` or `occupied` can accept orders (multiple orders per table allowed). Tables with status `maintenance` or `reserved` cannot be used.
- **Table Status**: Table status is NOT automatically changed when orders are created. Staff can manage table status manually.
- **Multiple Orders Per Table**: Customers can place multiple orders from the same table
- **Availability Check**: Only menu items with `isAvailable: true` can be ordered. Unavailable items will result in an error
- **Restaurant Validation**: All menu items must belong to the specified restaurant
- **Order Type Default**: If `orderType` is not provided, it defaults to `dine_in` if a table is specified, otherwise `takeaway`

**Response**: Created order with full details including order items, customer, restaurant, and order items with menu details.

**Order Creator Tracking**:
Every order now tracks who created it:
- `createdBy` (string): User ID (if created by staff) or Customer ID (if created by customer)
- `createdByType` (enum): `'staff'` or `'customer'`

**Examples**:
```json
// Order created by restaurant staff
{
  "createdBy": "user-uuid-123",
  "createdByType": "staff"
}

// Order created by customer via customer portal
{
  "createdBy": "customer-uuid-456",
  "createdByType": "customer"
}
```

**Use Cases**:
- Query all customer-created orders: `WHERE createdByType = 'customer'`
- Query all staff-created orders: `WHERE createdByType = 'staff'`
- Track which staff member created an order: `WHERE createdBy = 'user-uuid'`
- Analytics: Compare customer vs staff order patterns

**SMS Notifications**:
When an order status changes to `READY` (all items marked as ready):
- System automatically sends SMS to customer
- Message format: `Hi {customerName}! 🎉 Your order {orderNumber} is ready! You can collect it now. Check live updates on DineFlow app. Thank you!`
- Requires customer phone number in database
- SMS delivery logged in server logs
- Notification does not block order status update (fails gracefully)

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "restaurantId": "restaurant-uuid",
  "customerId": "customer-uuid",
  "tableNo": "5",
  "orderType": "dine_in",
  "status": "confirmed",
  "totalAmount": 25.98,
  "customer": {
    "id": "customer-uuid",
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "orderItems": [
    {
      "id": "order-item-uuid",
      "menuId": "menu-item-uuid",
      "quantity": 2,
      "unitPrice": 12.99,
      "totalPrice": 25.98,
      "specialInstructions": {
        "portion": "full",
        "rice": "full",
        "chicken": "medium",
        "spiceLevel": "medium",
        "note": "No onions"
      },
      "status": "pending",
      "menu": {
        "id": "menu-item-uuid",
        "name": "Margherita Pizza",
        "price": "12.99",
        "category": {
          "id": "category-uuid",
          "name": "Main Courses"
        }
      }
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

**Real-time Event**: When an order is created, a `new_order` WebSocket event is broadcast to all clients subscribed to the restaurant's order room. See WebSocket section for details.

### Get All Orders
```http
GET /orders?restaurantId={id}&status={status}&date={date}&paymentStatus={status}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Query Parameters**:
- `restaurantId` (optional): Filter by restaurant
- `status` (optional): Filter by order status
- `date` (optional): Filter by date (YYYY-MM-DD)
- `paymentStatus` (optional): Filter by payment status

**Order Status Enum**:
- `pending` - Order created, awaiting confirmation
- `confirmed` - Order confirmed by staff/waiter
- `preparing` - Order being prepared in kitchen
- `ready` - Order ready for pickup/delivery
- `served` - Order served to customer
- `completed` - Order completed
- `cancelled` - Order cancelled

**Response**: Paginated response with orders. Each order includes full customer details, table ID, and items grouped by category.

**Response Format**:
```json
{
  "data": [
    {
      "id": "order-uuid-1",
      "orderNumber": "ORD000001",
      "tableNo": "5",
      "customerName": "John Doe",
      "customerPhone": "+1234567890",
      "customer": {
        "id": "customer-uuid",
        "name": "John Doe",
        "phone": "+1234567890"
      },
      "orderType": "dine_in",
      "status": "pending",
      "isOnHold": false,
      "holdReason": null,
      "totalAmount": 45.97,
      "paymentMethod": "cashier",
      "paymentStatus": "pending",
      "restaurant": {
        "id": "restaurant-uuid",
        "name": "Pizza Palace"
      },
      "itemsByCategory": [
        {
          "category": "Main Courses",
          "items": [
            {
              "id": "order-item-uuid-1",
              "menuId": "menu-item-uuid-1",
              "menuName": "Margherita Pizza",
              "quantity": 2,
              "unitPrice": 12.99,
              "totalPrice": 25.98,
              "specialInstructions": null,
              "status": "pending",
              "category": "Main Courses"
            }
          ]
        }
      ],
      "createdAt": "2025-01-11T21:00:00.000Z",
      "updatedAt": "2025-01-11T21:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

**Note**: 
- Orders are returned in descending order by creation date (most recent first)
- Each order includes full `customer` object with `id`, `name`, and `phone` for complete customer information
- Each order is grouped by order ID
- Items within each order are grouped by category
- **For SUPER_ADMIN and TENANT_ADMIN**: All orders are returned (filtered by restaurant if specified)
- **For other roles**: Only orders for their restaurant are returned
- Response is paginated with `data`, `total`, `page`, `limit`, and `totalPages` fields

### Get Order by ID
```http
GET /orders/{orderId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Response**: Detailed order object with full customer details, table ID, and items grouped by category.

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "tableNo": "5",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "customer": {
    "id": "customer-uuid",
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "orderType": "dine_in",
  "status": "pending",
  "isOnHold": false,
  "holdReason": null,
  "totalAmount": 45.97,
  "paymentMethod": "cashier",
  "paymentStatus": "pending",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "itemsByCategory": [
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "order-item-uuid-1",
          "menuId": "menu-item-uuid-1",
          "menuName": "Margherita Pizza",
          "quantity": 2,
          "unitPrice": 12.99,
          "totalPrice": 25.98,
          "specialInstructions": null,
          "status": "pending",
          "category": "Main Courses"
        }
      ]
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

**Note**: 
- Order items are grouped by category for easier viewing
- Response includes full `customer` object with `id`, `name`, and `phone` for complete customer information
- Response also includes `customerName` and `customerPhone` fields for backward compatibility
- **For SUPER_ADMIN**: Can access any order
- **For TENANT_ADMIN and MANAGER**: Can only access orders for their restaurant

### Update Order
```http
PATCH /orders/{orderId}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "orderItems": [
    {
      "menuId": "menu-item-uuid",
      "quantity": 2,
      "specialInstructions": {
        "portion": "full",
        "spiceLevel": "medium"
      },
      "addonIds": ["addon-uuid-1", "addon-uuid-2"]
    }
  ],
  "notes": "Updated notes",
  "paymentMethod": "cash",
  "customerInfo": "Serialized customer details"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Use Case**: This endpoint is particularly useful for updating orders after they are released from hold. When a waiter releases an order (via `POST /order-status/order/:orderId/release`), they can navigate to an edit screen and use this endpoint to update order items, quantities, special instructions, and other details.

**Request Body** (all fields optional):
- `orderItems` (array, optional): Updated items for the order. When provided, **replaces all existing order items** and automatically recalculates the order total. Each item should include:
  - `menuId` (uuid, required): Menu item identifier
  - `quantity` (number, required): Quantity (minimum: 1)
  - `specialInstructions` (string or object, optional): Special instructions as text or JSON object (e.g., `{"portion": "full", "spiceLevel": "medium"}`)
  - `addonIds` (array of UUIDs, optional): List of addon identifiers applied to the item
- `notes` (string, optional): Updated order notes
- `paymentMethod` (enum, optional): Updated payment method. Valid values: `cash`, `card`, `qr`, `cashier`
- `customerInfo` (string, optional): Serialized customer details

**Business Rules**:
- **Cannot update orders with status `completed` or `cancelled`** - These orders are final and cannot be modified
- **Order Items Replacement**: When `orderItems` is provided, all existing order items are removed and replaced with the new items
- **Total Recalculation**: The order `totalAmount` is automatically recalculated based on the new items and their quantities
- **Menu Validation**: All menu items must:
  - Exist in the restaurant's menu
  - Be available (`isAvailable: true`)
  - Belong to the same restaurant as the order
- **Restaurant Scoping**: Users can only update orders for their restaurant (unless `SUPER_ADMIN`)

**Response**: Updated order with full details including customer name and phone, items grouped by category, and recalculated totals.

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "tableNo": "5",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "customer": {
    "id": "customer-uuid",
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "orderType": "dine_in",
  "status": "pending",
  "isOnHold": false,
  "holdReason": null,
  "totalAmount": 45.97,
  "paymentMethod": "cashier",
  "paymentStatus": "pending",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "itemsByCategory": [
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "order-item-uuid-1",
          "menuId": "menu-item-uuid-1",
          "menuName": "Margherita Pizza",
          "quantity": 2,
          "unitPrice": 12.99,
          "totalPrice": 25.98,
          "specialInstructions": {
            "portion": "full",
            "spiceLevel": "medium"
          },
          "status": "pending",
          "category": "Main Courses"
        }
      ]
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T22:30:00.000Z"
}
```

**Response Fields**:
- `customer` (object): Full customer details including `id`, `name`, and `phone` - **This is included to support the edit screen after order release, allowing waiters to view and verify customer contact information**
- `customerName` (string): Customer's name (included for backward compatibility)
- `customerPhone` (string): Customer's phone number (included for backward compatibility)
- `itemsByCategory` (array): Order items grouped by menu category for easier viewing
- `totalAmount` (number): Recalculated total based on updated items

**Real-time Event**: When an order is updated, `order_status_update` and `order_update` WebSocket events are broadcast to all subscribed clients, ensuring all UIs stay synchronized.

**Error Responses**:
- `400 Bad Request`: Order cannot be updated (status is `completed` or `cancelled`)
- `400 Bad Request`: Menu item not found or unavailable
- `404 Not Found`: Order not found
- `403 Forbidden`: User does not have permission to update this order

### Confirm Order
```http
POST /orders/{orderId}/confirm
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Flow**: Changes order status from `pending` → `confirmed`

**Response**: Updated order with status `confirmed`

**Real-time Event**: When an order is confirmed, an `order_status_update` and `order_update` WebSocket event is broadcast to all subscribed clients.

### Process Payment
```http
POST /orders/{orderId}/process-payment
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "paymentMethod": "card_online",
  "paymentReference": "txn_123456",
  "notes": "Payment processed successfully"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Request Body**:
- `paymentMethod` (enum, required): Payment method. Valid values: `cash`, `card`, `qr`, `cashier`
- `paymentReference` (string, optional): Payment transaction reference
- `notes` (string, optional): Payment notes

**Note**: 
- Creates or updates payment record for the order
- Payment status is set to `paid` when processed
- If payment already exists, it will be updated with the new payment method

**Payment Method Enum**:
- `cash` - Cash payment
- `card` - Card payment (online or at counter)
- `qr` - QR code payment
- `cashier` - Payment at cashier counter

**Payment Status Enum**:
- `pending` - Payment not processed (used for cashier payments until cashier confirms)
- `paid` - Payment completed
- `failed` - Payment failed
- `refunded` - Payment refunded

### Delete Order
```http
DELETE /orders/{orderId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Authentication**: JWT Bearer token required

**Use Case**: Staff deleting an order (only for pending or cancelled orders)

**Note**: Only allowed if order status is `pending` or `cancelled`

**Response**: 204 No Content

### Mark Order as Done (Cashier)
```http
POST /orders/{orderId}/mark-done
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Use Case**: Cashier marks order as done after receiving payment from customer. This endpoint is used when customer selected `cashier` as payment method during order creation.

**Flow**: 
- Changes order status from `pending` → `completed`
- Updates payment status from `pending` → `paid` (if payment exists and is pending)
- Only orders with status `pending` can be marked as done

**Response**: Updated order object with status `completed` and payment status `paid`

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "tableNo": "5",
  "customerName": "John Doe",
  "status": "completed",
  "totalAmount": 25.98,
  "paymentMethod": "cashier",
  "paymentStatus": "paid",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "itemsByCategory": [
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "order-item-uuid",
          "menuId": "menu-item-uuid",
          "menuName": "Margherita Pizza",
          "quantity": 2,
          "unitPrice": 12.99,
          "totalPrice": 25.98,
          "status": "pending",
          "category": "Main Courses"
        }
      ]
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:05:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Order cannot be marked as done (order status must be `pending`)
- `404 Not Found`: Order not found
- `403 Forbidden`: User does not have permission to mark this order as done

**Real-time Event**: When an order is marked as done, an `order_status_update` and `order_update` WebSocket event is broadcast to all subscribed clients.

**Note**: 
- This endpoint is specifically designed for cashier workflow
- When customer selects `cashier` payment method, order status is `pending` and payment status is `pending`
- Cashier receives payment from customer and calls this endpoint to mark order as done
- Frontend should show success message after receiving the response

### Get Order Analytics
```http
GET /orders/analytics/summary?restaurantId={id}&startDate={date}&endDate={date}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (optional): Filter by restaurant
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)

**Response**:
```json
{
  "totalOrders": 150,
  "totalRevenue": 12500.50,
  "averageOrderValue": 83.34,
  "ordersByStatus": {
    "completed": 120,
    "pending": 10,
    "preparing": 15,
    "ready": 5
  },
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }
}
```

---

## Dashboard & Analytics

**IMPORTANT**: All dashboard and analytics endpoints **ONLY count COMPLETED orders** (paid orders). Pending, cancelled, or in-progress orders are **EXCLUDED** from all revenue and analytics calculations.

### Quick Reference

| Endpoint | Default Period | Default Filter | What It Shows |
|----------|---------------|----------------|---------------|
| `GET /dashboard` | Today | COMPLETED only | Complete dashboard with all charts |
| `GET /dashboard/summary` | Today | COMPLETED only | 4 summary cards (sales, orders, tables, top item) |
| `GET /dashboard/sales-overview` | Today (hourly) | COMPLETED only | Revenue by hour or day |
| `GET /dashboard/orders-by-category` | Today | COMPLETED only | Orders per category (only actual categories) |
| `GET /dashboard/payment-methods` | Today | COMPLETED only | Payment distribution |
| `GET /dashboard/table-occupancy` | Today | COMPLETED only | Table usage by hour |
| `GET /dashboard/recent-orders` | All time | **All statuses** | Last 10 orders (all statuses) |
| `GET /dashboard/restaurant-analytics` | Today | COMPLETED only | Top 6 analytics |
| `GET /orders/analytics/summary` | Last 7 days | COMPLETED only | Comprehensive analytics with filters |

### What is Counted vs NOT Counted

**✅ Counted (COMPLETED orders only)**:
- Orders with `status = 'completed'`
- Paid orders (payment received)
- Actual revenue received

**❌ NOT Counted**:
- Pending orders
- Cancelled orders  
- In-progress orders (preparing, ready, served)
- Unpaid orders

### Default Behaviors

If you send **NO query parameters**, here's what you get:

| Aspect | Default Value |
|--------|---------------|
| Time Period | Today (most endpoints) |
| Order Status Filter | COMPLETED only |
| Sales Period | Hourly (24-hour breakdown) |
| Recent Orders Limit | 10 orders |
| Analytics Period | Last 7 days |
| Category Display | Only categories with actual orders |
| Sorting | By count/revenue (descending) |

### Complete Dashboard
```http
GET /dashboard?restaurantId={id}&salesPeriod={period}&recentOrdersLimit={limit}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter (*Required for non-super-admin users)
- `salesPeriod` (enum, optional): `hourly` (default) or `daily` - Sales chart period
- `recentOrdersLimit` (number, optional): Number of recent orders (default: 10)

**Default Behavior**:
- Period: Today (00:00 - 23:59)
- Orders: COMPLETED only
- Sales: Hourly breakdown (24 hours)
- Recent Orders: Last 10

**Response**:
```json
{
  "summary": {
    "todaysSales": {
      "totalRevenue": 15750.00,
      "changePercent": 31.25,
      "trend": "up"
    },
    "totalOrdersToday": {
      "count": 12,
      "dineIn": 8,
      "takeaway": 4
    },
    "activeTables": {
      "occupied": 5,
      "total": 20,
      "available": 15
    },
    "topSellingItem": {
      "name": "Chicken Biryani",
      "quantity": 25
    }
  },
  "charts": {
    "salesOverview": [...],
    "ordersByCategory": [...],
    "paymentMethods": [...],
    "tableOccupancy": [...]
  },
  "recentOrders": [...]
}
```

**Examples**:
```bash
# Today's dashboard (default - hourly)
GET /dashboard?restaurantId=abc-123

# Today's dashboard (daily view)
GET /dashboard?restaurantId=abc-123&salesPeriod=daily

# With more recent orders
GET /dashboard?restaurantId=abc-123&recentOrdersLimit=20
```

---

### Dashboard Summary (4 Cards)
```http
GET /dashboard/summary?restaurantId={id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter

**Default Behavior**:
- Period: Today vs Yesterday
- Orders: COMPLETED only
- Comparison: Percentage change from yesterday

**Response**:
```json
{
  "todaysSales": {
    "totalRevenue": 15750.00,
    "changePercent": 31.25,
    "trend": "up"
  },
  "totalOrdersToday": {
    "count": 12,
    "dineIn": 8,
    "takeaway": 4
  },
  "activeTables": {
    "occupied": 5,
    "total": 20,
    "available": 15
  },
  "topSellingItem": {
    "name": "Chicken Biryani",
    "quantity": 25
  }
}
```

---

### Sales Overview Chart
```http
GET /dashboard/sales-overview?restaurantId={id}&period={period}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter
- `period` (enum, optional): `hourly` (default) or `daily`

**Default Behavior**:
- Period: `hourly` = Today's 24 hours
- Period: `daily` = Last 7 days
- Orders: COMPLETED only

**Response (Hourly)**:
```json
[
  { "time": "00:00", "hour": 0, "revenue": 0 },
  { "time": "04:00", "hour": 4, "revenue": 1550 },
  { "time": "07:00", "hour": 7, "revenue": 9100 },
  { "time": "12:00", "hour": 12, "revenue": 0 }
]
```

**Response (Daily)**:
```json
[
  { "date": "2025-12-10", "revenue": 15000 },
  { "date": "2025-12-11", "revenue": 18000 }
]
```

**Business Use**: Identify peak hours for staffing decisions

**Examples**:
```bash
# Hourly (default - today)
GET /dashboard/sales-overview?restaurantId=abc-123

# Daily (last 7 days)
GET /dashboard/sales-overview?restaurantId=abc-123&period=daily
```

---

### Orders by Category
```http
GET /dashboard/orders-by-category?restaurantId={id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter

**Default Behavior**:
- Period: Today
- Orders: COMPLETED only
- **Categories**: Only shows categories with actual orders (NO hardcoded categories)
- **Sorting**: By count (highest first)

**Response**:
```json
[
  { "category": "Spacial", "count": 8 },
  { "category": "Spicy", "count": 5 },
  { "category": "Deserts", "count": 5 }
]
```

**Important Notes**:
- ✅ Only shows categories that have orders
- ❌ Does NOT show empty categories (e.g., "Starters: 0", "Mains: 0")
- ✅ Sorted by count descending
- ✅ Only shows restaurant's actual categories

---

### Payment Methods Distribution
```http
GET /dashboard/payment-methods?restaurantId={id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter

**Default Behavior**:
- Period: Today
- Orders: COMPLETED only

**Response**:
```json
[
  {
    "method": "Cashier",
    "count": 4,
    "amount": 6200.00,
    "percentage": 57.14
  },
  {
    "method": "Cash",
    "count": 2,
    "amount": 3100.00,
    "percentage": 28.57
  },
  {
    "method": "Digital/Online",
    "count": 1,
    "amount": 1550.00,
    "percentage": 14.29
  }
]
```

---

### Table Occupancy Trend
```http
GET /dashboard/table-occupancy?restaurantId={id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter

**Default Behavior**:
- Period: Today (hourly breakdown)
- Orders: COMPLETED only

**Response**:
```json
[
  {
    "time": "00:00",
    "hour": 0,
    "occupied": 0,
    "total": 20,
    "occupancyRate": 0
  },
  {
    "time": "12:00",
    "hour": 12,
    "occupied": 15,
    "total": 20,
    "occupancyRate": 75.00
  }
]
```

---

### Recent Orders
```http
GET /dashboard/recent-orders?restaurantId={id}&limit={limit}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter
- `limit` (number, optional): Number of orders to return (default: 10)

**Default Behavior**:
- Period: All time
- Orders: **ALL statuses** (pending, completed, cancelled, etc.)
- Limit: 10 orders
- Sorting: Most recent first

**Response**:
```json
[
  {
    "orderId": "uuid",
    "orderNumber": "ORD000123",
    "tableNo": "5",
    "customerName": "John Doe",
    "customerPhone": "+94771234567",
    "orderType": "dine_in",
    "itemsCount": 3,
    "totalAmount": 1550.00,
    "paymentMethod": "cashier",
    "paymentStatus": "paid",
    "orderTime": "2025-12-16T10:30:00.000Z",
    "orderStatus": "completed",
    "isOnHold": false
  }
]
```

---

### Restaurant Analytics (Top 6)
```http
GET /dashboard/restaurant-analytics?restaurantId={id}&period={period}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN` or `TENANT_ADMIN`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter
- `period` (enum, optional): `daily` (default) or `weekly`

**Default Behavior**:
- Period: `daily` = Today vs Yesterday
- Period: `weekly` = This week vs Last week
- Orders: COMPLETED only

**Response**:
```json
{
  "salesOverview": {
    "currentRevenue": 15750.00,
    "comparisonRevenue": 12000.00,
    "trendPercent": 31.25,
    "peakRevenueDay": "2025-12-16",
    "peakRevenue": 9100.00
  },
  "topSellingItems": [
    {
      "name": "Chicken Biryani",
      "quantity": 25,
      "revenue": 3750.00,
      "revenueContribution": 23.81
    }
  ],
  "ordersByCategory": [
    { "category": "Spacial", "count": 8 },
    { "category": "Spicy", "count": 5 }
  ],
  "tableOccupancy": [...],
  "paymentMethods": [...],
  "peakHours": [...]
}
```

**Examples**:
```bash
# Today vs Yesterday (default)
GET /dashboard/restaurant-analytics?restaurantId=abc-123

# This week vs Last week
GET /dashboard/restaurant-analytics?restaurantId=abc-123&period=weekly
```

---

### Comprehensive Analytics
```http
GET /orders/analytics/summary?restaurantId={id}&period={period}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (UUID, optional*): Restaurant to filter
- `period` (enum, optional): `today`, `last7days` (default), `last30days`, `total`
- `startDate` (ISO date, optional): Custom start date (overrides period)
- `endDate` (ISO date, optional): Custom end date (overrides period)

**Default Behavior**:
- Period: Last 7 days
- Orders: COMPLETED only

**Period Options**:
| Period | Description | Date Range |
|--------|-------------|------------|
| `today` | Today only | 00:00 - 23:59 today |
| `last7days` | Last 7 days (default) | 7 days ago - now |
| `last30days` | Last 30 days | 30 days ago - now |
| `total` | All time | All completed orders |

**Response**:
```json
{
  "summary": {
    "totalOrders": 150,
    "totalRevenue": 45000.00,
    "averageOrderValue": 300.00,
    "period": "last7days"
  },
  "dateRange": {
    "startDate": "2025-12-09T00:00:00.000Z",
    "endDate": "2025-12-16T23:59:59.999Z"
  },
  "ordersByStatus": {
    "completed": 150
  },
  "categoryPerformance": [
    {
      "category": "Spacial",
      "orders": 45,
      "revenue": 15000.00,
      "items": 120
    }
  ],
  "paymentMethods": [
    {
      "method": "cashier",
      "count": 85,
      "revenue": 25500.00,
      "percentage": 56.67
    }
  ],
  "peakHours": [
    {
      "timeSlot": "07:00",
      "orders": 25,
      "items": 75,
      "revenue": 7500.00
    }
  ],
  "topSellingItems": [
    {
      "menuId": "uuid",
      "name": "Chicken Biryani",
      "quantity": 85,
      "revenue": 12750.00,
      "orders": 45
    }
  ]
}
```

**Examples**:
```bash
# Today only
GET /orders/analytics/summary?period=today&restaurantId=abc-123

# Last 7 days (default)
GET /orders/analytics/summary?restaurantId=abc-123

# Last 30 days
GET /orders/analytics/summary?period=last30days&restaurantId=abc-123

# All time
GET /orders/analytics/summary?period=total&restaurantId=abc-123

# Custom date range
GET /orders/analytics/summary?startDate=2025-12-01&endDate=2025-12-15&restaurantId=abc-123
```

---


The Dashboard module provides comprehensive analytics and insights for restaurant administrators. All dashboard endpoints are **admin-only** and require JWT authentication with appropriate roles.

**Base Path**: `/api/dashboard`  
**Authentication**: **JWT Required (Admin roles only)**  
**Required Roles**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

### Overview

The dashboard provides:
- **Summary Cards**: Today's sales, total orders, active tables, top selling item
- **Charts**: Sales overview, orders by category, payment methods distribution, table occupancy trends
- **Recent Orders Table**: Latest orders with key details

All data is filtered by restaurant (automatically based on user role, or via `restaurantId` query parameter).

### Get Complete Dashboard Data

```http
GET /dashboard?restaurantId={id}&salesPeriod={hourly|daily}&recentOrdersLimit={number}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (optional): Restaurant ID to filter data (required for non-super-admin users)
- `salesPeriod` (optional): Period for sales overview chart - `hourly` (default) or `daily`
- `recentOrdersLimit` (optional): Number of recent orders to return (default: 10)

**Response**:
```json
{
  "summary": {
    "todaysSales": {
      "totalRevenue": 1250.75,
      "changePercent": 15.5,
      "trend": "up"
    },
    "totalOrdersToday": {
      "count": 45,
      "dineIn": 32,
      "takeaway": 13
    },
    "activeTables": {
      "occupied": 8,
      "total": 20,
      "available": 12
    },
    "topSellingItem": {
      "name": "Margherita Pizza",
      "quantity": 15
    }
  },
  "charts": {
    "salesOverview": [
      {
        "time": "00:00",
        "hour": 0,
        "revenue": 0.00
      },
      {
        "time": "01:00",
        "hour": 1,
        "revenue": 0.00
      },
      {
        "time": "12:00",
        "hour": 12,
        "revenue": 125.50
      },
      {
        "time": "13:00",
        "hour": 13,
        "revenue": 185.75
      }
    ],
    "ordersByCategory": [
      {
        "category": "Starters",
        "count": 12
      },
      {
        "category": "Mains",
        "count": 28
      },
      {
        "category": "Desserts",
        "count": 8
      },
      {
        "category": "Drinks",
        "count": 15
      }
    ],
    "paymentMethods": [
      {
        "method": "Cash",
        "count": 15,
        "amount": 450.25,
        "percentage": 36.0
      },
      {
        "method": "Card",
        "count": 20,
        "amount": 600.50,
        "percentage": 48.0
      },
      {
        "method": "Digital/Online",
        "count": 8,
        "amount": 180.00,
        "percentage": 14.4
      },
      {
        "method": "Cashier",
        "count": 2,
        "amount": 20.00,
        "percentage": 1.6
      }
    ],
    "tableOccupancy": [
      {
        "time": "00:00",
        "hour": 0,
        "occupied": 0,
        "total": 20,
        "occupancyRate": 0.00
      },
      {
        "time": "12:00",
        "hour": 12,
        "occupied": 5,
        "total": 20,
        "occupancyRate": 25.00
      },
      {
        "time": "13:00",
        "hour": 13,
        "occupied": 8,
        "total": 20,
        "occupancyRate": 40.00
      }
    ]
  },
  "recentOrders": [
    {
      "orderId": "order-uuid",
      "orderNumber": "ORD000045",
      "tableNo": "Table 5",
      "itemsCount": 3,
      "totalAmount": 45.50,
      "orderTime": "2025-01-11T14:30:00.000Z",
      "orderStatus": "preparing"
    },
    {
      "orderId": "order-uuid-2",
      "orderNumber": "ORD000044",
      "tableNo": "N/A",
      "itemsCount": 2,
      "totalAmount": 28.75,
      "orderTime": "2025-01-11T14:25:00.000Z",
      "orderStatus": "ready"
    }
  ]
}
```

### Get Dashboard Summary (Summary Cards)

```http
GET /dashboard/summary?restaurantId={id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (optional): Restaurant ID to filter data (required for non-super-admin users)

**Response**: Returns the 4 summary cards:
- **Today's Sales**: Total revenue today, percentage change from yesterday, trend (up/down)
- **Total Orders Today**: Total count, dine-in count, takeaway count
- **Active Tables**: Occupied tables, total tables, available tables
- **Top Selling Item**: Item name and quantity sold today

**Response Example**:
```json
{
  "todaysSales": {
    "totalRevenue": 1250.75,
    "changePercent": 15.5,
    "trend": "up"
  },
  "totalOrdersToday": {
    "count": 45,
    "dineIn": 32,
    "takeaway": 13
  },
  "activeTables": {
    "occupied": 8,
    "total": 20,
    "available": 12
  },
  "topSellingItem": {
    "name": "Margherita Pizza",
    "quantity": 15
  }
}
```

**Notes**:
- Revenue change percentage compares today's revenue with yesterday's revenue
- Trend is `"up"` if change is positive or zero, `"down"` if negative
- Dine-in orders are identified by presence of `tableId` or `tableNo`
- Takeaway orders are orders without table information

### Get Sales Overview (Line Chart)

```http
GET /dashboard/sales-overview?restaurantId={id}&period={hourly|daily}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (optional): Restaurant ID to filter data (required for non-super-admin users)
- `period` (optional): `hourly` (default) or `daily`

**Response**:

**For hourly period** (today's hourly breakdown):
```json
[
  {
    "time": "00:00",
    "hour": 0,
    "revenue": 0.00
  },
  {
    "time": "12:00",
    "hour": 12,
    "revenue": 125.50
  },
  {
    "time": "13:00",
    "hour": 13,
    "revenue": 185.75
  }
]
```

**For daily period** (last 7 days):
```json
[
  {
    "date": "2025-01-05",
    "revenue": 1200.50
  },
  {
    "date": "2025-01-06",
    "revenue": 1350.25
  },
  {
    "date": "2025-01-11",
    "revenue": 1250.75
  }
]
```

**Notes**:
- Hourly data shows all 24 hours (00:00 to 23:00) with revenue for each hour
- Daily data shows the last 7 days including today
- Helps identify peak sales hours/days

### Get Orders by Category (Bar Chart)

```http
GET /dashboard/orders-by-category?restaurantId={id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (optional): Restaurant ID to filter data (required for non-super-admin users)

**Response**:
```json
[
  {
    "category": "Starters",
    "count": 12
  },
  {
    "category": "Mains",
    "count": 28
  },
  {
    "category": "Desserts",
    "count": 8
  },
  {
    "category": "Drinks",
    "count": 15
  },
  {
    "category": "Appetizers",
    "count": 5
  }
]
```

**Notes**:
- Count represents total quantity of items ordered in each category today
- Categories are based on menu item categories
- Default categories (Starters, Mains, Desserts, Drinks) are always included even if count is 0
- Additional categories found in orders are also included

### Get Payment Methods Distribution (Pie Chart)

```http
GET /dashboard/payment-methods?restaurantId={id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (optional): Restaurant ID to filter data (required for non-super-admin users)

**Response**:
```json
[
  {
    "method": "Cash",
    "count": 15,
    "amount": 450.25,
    "percentage": 36.0
  },
  {
    "method": "Card",
    "count": 20,
    "amount": 600.50,
    "percentage": 48.0
  },
  {
    "method": "Digital/Online",
    "count": 8,
    "amount": 180.00,
    "percentage": 14.4
  },
  {
    "method": "Cashier",
    "count": 2,
    "amount": 20.00,
    "percentage": 1.6
  }
]
```

**Payment Method Mapping**:
- `cash` → "Cash"
- `card` → "Card"
- `qr` → "Digital/Online"
- `cashier` → "Cashier"

**Notes**:
- Count: Number of orders using this payment method today
- Amount: Total revenue from this payment method today
- Percentage: Percentage of total revenue from this payment method
- Orders without payment information are grouped as "Unknown"

### Get Table Occupancy Trend (Area/Line Chart)

```http
GET /dashboard/table-occupancy?restaurantId={id}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (optional): Restaurant ID to filter data (required for non-super-admin users)

**Response**:
```json
[
  {
    "time": "00:00",
    "hour": 0,
    "occupied": 0,
    "total": 20,
    "occupancyRate": 0.00
  },
  {
    "time": "12:00",
    "hour": 12,
    "occupied": 5,
    "total": 20,
    "occupancyRate": 25.00
  },
  {
    "time": "13:00",
    "hour": 13,
    "occupied": 8,
    "total": 20,
    "occupancyRate": 40.00
  },
  {
    "time": "14:00",
    "hour": 14,
    "occupied": 10,
    "total": 20,
    "occupancyRate": 50.00
  }
]
```

**Notes**:
- Shows hourly table occupancy throughout today (00:00 to 23:00)
- Occupied: Number of unique tables that had orders in that hour
- Total: Total number of tables in the restaurant
- Occupancy Rate: Percentage of tables occupied (occupied/total * 100)
- Helps plan staff shifts and identify peak dining hours

### Get Recent Orders Table

```http
GET /dashboard/recent-orders?restaurantId={id}&limit={number}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Query Parameters**:
- `restaurantId` (optional): Restaurant ID to filter data (required for non-super-admin users)
- `limit` (optional): Number of recent orders to return (default: 10, max recommended: 50)

**Response**:
```json
[
  {
    "orderId": "order-uuid",
    "orderNumber": "ORD000045",
    "tableNo": "Table 5",
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "customer": {
      "id": "customer-uuid",
      "name": "John Doe",
      "phone": "+1234567890"
    },
    "orderType": "dine_in",
    "itemsCount": 3,
    "totalAmount": 45.50,
    "paymentMethod": "cashier",
    "paymentStatus": "pending",
    "orderTime": "2025-01-11T14:30:00.000Z",
    "orderStatus": "preparing",
    "isOnHold": false,
    "holdReason": null
  },
  {
    "orderId": "order-uuid-2",
    "orderNumber": "ORD000044",
    "tableNo": "N/A",
    "customerName": "Jane Smith",
    "customerPhone": "+1987654321",
    "customer": {
      "id": "customer-uuid-2",
      "name": "Jane Smith",
      "phone": "+1987654321"
    },
    "orderType": "takeaway",
    "itemsCount": 2,
    "totalAmount": 28.75,
    "paymentMethod": "card",
    "paymentStatus": "paid",
    "orderTime": "2025-01-11T14:25:00.000Z",
    "orderStatus": "ready",
    "isOnHold": false,
    "holdReason": null
  },
  {
    "orderId": "order-uuid-3",
    "orderNumber": "ORD000043",
    "tableNo": "Table 12",
    "customerName": "Bob Johnson",
    "customerPhone": "+1555555555",
    "customer": {
      "id": "customer-uuid-3",
      "name": "Bob Johnson",
      "phone": "+1555555555"
    },
    "orderType": "dine_in",
    "itemsCount": 4,
    "totalAmount": 67.25,
    "paymentMethod": "cash",
    "paymentStatus": "paid",
    "orderTime": "2025-01-11T14:20:00.000Z",
    "orderStatus": "served",
    "isOnHold": false,
    "holdReason": null
  }
]
```

**Response Fields**:
- `orderId`: Order UUID
- `orderNumber`: Human-readable order number (e.g., "ORD000045")
- `tableNo`: Table number/name, or "N/A" for takeaway orders
- `customerName`: Customer's name
- `customerPhone`: Customer's phone number
- `customer`: Full customer object with `id`, `name`, and `phone` - **Included to provide complete customer information for each order**
- `orderType`: Order type (`takeaway` or `dine_in`)
- `itemsCount`: Number of items in the order
- `totalAmount`: Total order amount (safely handled, defaults to 0 if null)
- `paymentMethod`: Payment method used for the order
- `paymentStatus`: Payment status (pending, paid, failed, refunded)
- `orderTime`: Order creation timestamp (ISO 8601)
- `orderStatus`: Current order status (pending, confirmed, preparing, ready, served, completed, cancelled)
- `isOnHold`: Whether the order is currently on hold
- `holdReason`: Reason for hold (if order is on hold)

**Notes**:
- Orders are sorted by creation time (most recent first)
- Table number shows "N/A" for takeaway orders (orders without tableId/tableNo)
- Order status values match the Order Status enum
- **Customer details are included in all responses** - This allows dashboard users to see customer information for each order
- `totalAmount` is safely handled to prevent errors if the value is null or undefined

### Dashboard Data Filtering

**Restaurant Filtering**:
- **Super Admin**: Can access all restaurants (optional `restaurantId` query parameter)
- **Tenant Admin / Manager**: Automatically filtered by their assigned `restaurantId` (can optionally specify different `restaurantId` if they have access)
- **Non-admin users**: `restaurantId` is required and must match their assigned restaurant

**Date Filtering**:
- All dashboard endpoints use **today's date** by default
- Sales overview daily period shows last 7 days
- All other metrics are calculated for today (00:00:00 to 23:59:59)

**Time Zone**:
- All dates and times use the server's time zone
- Timestamps are returned in ISO 8601 format

---

### Get Restaurant Analytics (Top 6 Analytics)

```http
GET /dashboard/restaurant-analytics?restaurantId={id}&period={daily|weekly}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN` or `TENANT_ADMIN` (Admin and Tenant Admin only)

**Query Parameters**:
- `restaurantId` (optional): Restaurant ID to filter data (required for non-super-admin users)
- `period` (optional): `daily` (default) or `weekly`

**Description**: Returns comprehensive restaurant analytics with 6 key metrics to help restaurant owners understand their business performance, optimize operations, and make data-driven decisions.

**Response**:
```json
{
  "salesOverview": {
    "totalRevenue": 1250.75,
    "trendPercent": 15.5,
    "trend": "up",
    "comparisonPeriod": "yesterday",
    "peakRevenueDay": "2025-01-11",
    "peakRevenue": 1250.75,
    "period": "daily"
  },
  "topSellingItems": [
    {
      "name": "Margherita Pizza",
      "quantity": 25,
      "revenue": 312.50,
      "revenueContribution": 25.0
    },
    {
      "name": "Caesar Salad",
      "quantity": 18,
      "revenue": 216.00,
      "revenueContribution": 17.3
    },
    {
      "name": "Chocolate Cake",
      "quantity": 15,
      "revenue": 150.00,
      "revenueContribution": 12.0
    }
  ],
  "ordersByCategory": [
    {
      "category": "Starters",
      "count": 45
    },
    {
      "category": "Mains",
      "count": 120
    },
    {
      "category": "Desserts",
      "count": 35
    },
    {
      "category": "Drinks",
      "count": 80
    }
  ],
  "tableOccupancy": {
    "totalTables": 20,
    "occupiedTables": 12,
    "occupancyRate": 60.00,
    "hourlyData": [
      {
        "time": "00:00",
        "hour": 0,
        "occupied": 0,
        "total": 20,
        "occupancyRate": 0.00
      },
      {
        "time": "12:00",
        "hour": 12,
        "occupied": 5,
        "total": 20,
        "occupancyRate": 25.00
      },
      {
        "time": "13:00",
        "hour": 13,
        "occupied": 10,
        "total": 20,
        "occupancyRate": 50.00
      },
      {
        "time": "14:00",
        "hour": 14,
        "occupied": 12,
        "total": 20,
        "occupancyRate": 60.00
      }
    ]
  },
  "paymentMethods": [
    {
      "method": "Cash",
      "count": 15,
      "amount": 450.25,
      "percentage": 36.0
    },
    {
      "method": "Card",
      "count": 20,
      "amount": 600.50,
      "percentage": 48.0
    },
    {
      "method": "Online",
      "count": 8,
      "amount": 180.00,
      "percentage": 14.4
    },
    {
      "method": "Cashier",
      "count": 2,
      "amount": 20.00,
      "percentage": 1.6
    }
  ],
  "peakHours": [
    {
      "time": "00:00",
      "hour": 0,
      "orders": 0,
      "revenue": 0.00,
      "items": 0
    },
    {
      "time": "12:00",
      "hour": 12,
      "orders": 8,
      "revenue": 125.50,
      "items": 24
    },
    {
      "time": "13:00",
      "hour": 13,
      "orders": 15,
      "revenue": 185.75,
      "items": 42
    },
    {
      "time": "14:00",
      "hour": 14,
      "orders": 12,
      "revenue": 150.25,
      "items": 35
    }
  ]
}
```

#### 1. Daily / Weekly Sales Overview

**Purpose**: Helps owners understand money flow instantly

**Fields**:
- `totalRevenue`: Total sales revenue for the period
- `trendPercent`: Percentage change compared to previous period (+/- %)
- `trend`: "up" or "down" indicator
- `comparisonPeriod`: "yesterday" (for daily) or "last week" (for weekly)
- `peakRevenueDay`: Date (YYYY-MM-DD) with highest revenue in the period
- `peakRevenue`: Revenue amount on the peak day
- `period`: "daily" or "weekly"

**Notes**:
- Daily period compares today vs yesterday
- Weekly period compares this week (Monday to today) vs last week (same days)
- Trend percentage is calculated as: ((current - previous) / previous) * 100

#### 2. Top Selling Items

**Purpose**: Helps decide menu changes, promotions, and stock planning

**Fields**:
- `name`: Item name
- `quantity`: Total quantity sold in the period
- `revenue`: Total revenue generated by this item
- `revenueContribution`: Percentage of total revenue contributed by this item

**Notes**:
- Returns top 10 items sorted by quantity sold
- Revenue contribution helps identify which items drive the most revenue
- Useful for menu optimization and inventory planning

#### 3. Orders by Category (Food Type)

**Purpose**: Shows which category customers prefer the most

**Fields**:
- `category`: Category name (Starters, Mains, Desserts, Drinks, etc.)
- `count`: Total quantity of items ordered in this category

**Notes**:
- Default categories (Starters, Mains, Desserts, Drinks) are always included
- Additional categories found in orders are also included
- Helps identify popular food types for menu planning

#### 4. Table Occupancy Rate

**Purpose**: Helps optimize staff, kitchen load, and seating

**Fields**:
- `totalTables`: Total number of tables in the restaurant
- `occupiedTables`: Number of unique tables that had orders in the period
- `occupancyRate`: Percentage of tables occupied
- `hourlyData`: Array of hourly occupancy data (24 hours)

**Hourly Data Fields**:
- `time`: Time in HH:00 format
- `hour`: Hour number (0-23)
- `occupied`: Number of unique tables occupied in that hour
- `total`: Total number of tables
- `occupancyRate`: Percentage occupancy for that hour

**Notes**:
- Shows how many tables were occupied throughout the day
- Helps plan staff scheduling based on peak occupancy times
- Useful for optimizing kitchen load and seating arrangements

#### 5. Payment Methods Breakdown

**Purpose**: Helps identify preferred payment method

**Fields**:
- `method`: Payment method name (Cash, Card, Online, Cashier)
- `count`: Number of orders using this payment method
- `amount`: Total revenue from this payment method
- `percentage`: Percentage of total revenue from this payment method

**Payment Method Mapping**:
- `cash` → "Cash"
- `card` → "Card"
- `qr` → "Online" (includes QR, Wallet, Apple Pay, Google Pay)
- `cashier` → "Cashier"

**Notes**:
- Online category includes all digital payment methods (QR, Wallet, Apple Pay, Google Pay)
- Helps identify customer payment preferences
- Useful for payment infrastructure planning

#### 6. Peak Hours Analytics

**Purpose**: Helps plan staff scheduling & menu promotions

**Fields**:
- `time`: Time in HH:00 format
- `hour`: Hour number (0-23)
- `orders`: Number of orders placed in this hour
- `revenue`: Total revenue generated in this hour
- `items`: Total number of items ordered in this hour

**Notes**:
- Shows when most orders come in
- Shows when sales are highest
- Shows when kitchen load is maximum (via items count)
- Covers all 24 hours (00:00 to 23:00)
- Helps identify:
  - Busiest hours for staff scheduling
  - Peak sales hours for promotions
  - Kitchen load patterns for prep planning

**Period Options**:
- **Daily** (`period=daily`): Today's data compared to yesterday
- **Weekly** (`period=weekly`): This week's data (Monday to today) compared to last week

**Use Cases**:
- **Menu Optimization**: Use top selling items to decide what to keep, promote, or remove
- **Staff Scheduling**: Use peak hours and table occupancy to plan staff shifts
- **Inventory Planning**: Use top selling items and category data to plan stock
- **Promotion Timing**: Use peak hours to schedule promotions for maximum impact
- **Payment Infrastructure**: Use payment methods breakdown to optimize payment options
- **Seating Optimization**: Use table occupancy to understand seating patterns

---

## OrderStatusModule: Order Status Management

This module handles order and order item status updates, provides real-time WebSocket broadcasts, and tracks status history.

**Integration**: This module is used by KitchenDisplayModule for status updates.

### Create Order Status
```http
POST /order-status
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "orderId": "order-uuid",
  "status": "preparing",
  "notes": "Order is being prepared",
  "updatedBy": "user-uuid"
}
```

**Status Values**: Use Order Status Enum (pending, confirmed, preparing, ready, served, completed, cancelled)

### Get Order Status History
```http
GET /order-status/order/{orderId}/history
Authorization: Bearer your-access-token
```

**Response**: Array of status history entries

### Get Active Orders
```http
GET /order-status/active-orders?restaurantId={id}&foodCourtId={id}
Authorization: Bearer your-access-token
```

**Response**: Array of active orders

### Update Order Item Status
```http
PATCH /order-status/order-item/{orderItemId}/status
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "status": "ready",
  "updatedBy": "user-uuid"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `KITCHEN_STAFF`

**Request Body**:
- `status` (string, required): New order item status
- `updatedBy` (string, required): User ID who updated the status

**Order Item Status Values**:
- `pending` - Order item created, awaiting kitchen
- `in_progress` - Kitchen started preparing (sets `startedAt` timestamp)
- `ready` - Order item ready (sets `readyAt` timestamp)
- `served` - Order item served to customer (sets `servedAt` timestamp)

**Response**: Updated order item with new status and timestamps

**Real-time Event**: When an order item status is updated, an `order_status_update` WebSocket event is broadcast with the updated order item and full order details.

### Mark Order as Ready
```http
POST /order-status/order/{orderId}/mark-ready
Authorization: Bearer your-access-token
```

### Mark Order as Completed
```http
POST /order-status/order/{orderId}/mark-completed
Authorization: Bearer your-access-token
```

### Cancel Order (Staff)
```http
POST /api/order-status/order/{orderId}/cancel
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "reason": "Customer request",
  "updatedBy": "user-uuid"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Request Body**:
- `reason` (string, required): Reason for cancelling the order
- `updatedBy` (string, required): User ID who cancelled the order

**Note**:
- Staff members can cancel orders in their restaurant/tenant scope
- Order status will be updated to `cancelled` after successful cancellation
- Real-time WebSocket event is broadcast when order is cancelled

**Response**: Updated order object with status `cancelled`

**Error Responses**:
- `400 Bad Request`: Invalid cancellation payload or order cannot be cancelled
- `403 Forbidden`: User does not have permission to cancel this order
- `404 Not Found`: Order not found

### Hold Order (Staff)
```http
POST /api/order-status/order/{orderId}/hold
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "reason": "Waiting for customer confirmation",
  "updatedBy": "user-uuid"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Request Body**:
- `reason` (string, required): Reason for putting the order on hold
- `updatedBy` (string, required): User ID who is putting the order on hold

**Note**:
- Staff members can put orders on hold in their restaurant/tenant scope
- Orders with status `completed` or `cancelled` cannot be put on hold
- When an order is on hold, it maintains its current status but is marked as `isOnHold: true`
- The order can be resumed later using the release endpoint
- Real-time WebSocket event is broadcast when order is put on hold
- **Route Fix**: This endpoint is now properly accessible. Specific routes (hold, cancel, release) are defined before the general POST route to ensure correct routing.

**Response**: Updated order object with `isOnHold: true` and `holdReason` set

**Error Responses**:
- `400 Bad Request`: Order cannot be put on hold (already completed, cancelled, or already on hold)
- `403 Forbidden`: User does not have permission to hold this order
- `404 Not Found`: Order not found

### Release Order from Hold (Staff)
```http
POST /api/order-status/order/{orderId}/release
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Note**:
- Staff members can release orders from hold in their restaurant/tenant scope
- Only orders that are currently on hold can be released
- When released, the order's `isOnHold` flag is set to `false` and `holdReason` is cleared
- The order resumes from its previous status
- Real-time WebSocket event is broadcast when order is released from hold
- **After release, the response includes full order details with customer information and order items grouped by category** - This allows waiters to navigate to an edit screen with all order details pre-populated

**Response**: Formatted order object with customer details, order items grouped by category, and all order information. This response is designed to support the edit screen that appears after order release.

**Example Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD000001",
  "tableNo": "5",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "customer": {
    "id": "customer-uuid",
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "orderType": "dine_in",
  "status": "pending",
  "isOnHold": false,
  "holdReason": null,
  "totalAmount": 45.97,
  "paymentMethod": "cashier",
  "paymentStatus": "pending",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "itemsByCategory": [
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "order-item-uuid-1",
          "menuId": "menu-item-uuid-1",
          "menuName": "Margherita Pizza",
          "quantity": 2,
          "unitPrice": 12.99,
          "totalPrice": 25.98,
          "specialInstructions": null,
          "status": "pending",
          "category": "Main Courses"
        }
      ]
    }
  ],
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T22:30:00.000Z"
}
```

**Response Fields**:
- `customer` (object): Full customer details including `id`, `name`, and `phone` - **This is included to support the edit screen after order release, allowing waiters to view and verify customer contact information**
- `itemsByCategory` (array): Order items grouped by menu category for easier viewing and editing
- All other standard order fields (status, totalAmount, paymentMethod, etc.)

**Error Responses**:
- `400 Bad Request`: Order is not on hold
- `403 Forbidden`: User does not have permission to release this order
- `404 Not Found`: Order not found

---

## KitchenDisplayModule: Kitchen Operations

This module provides kitchen staff with real-time visibility into active orders and order items. It integrates with OrderStatusModule to update order item statuses and broadcast changes via WebSocket.

**Features**:
- View kitchen orders and order items
- Start order item preparation
- Mark order items as ready
- Extend order item preparation time
- View kitchen statistics

**Real-time Updates**: All order item status changes (start, ready) are automatically broadcast via WebSocket to subscribed clients (kitchen staff and customers).

### Kitchen Flow Overview

**Order Movement to Kitchen**:
1. Order is created with status `PENDING`
2. Order is confirmed by staff → Status: `CONFIRMED` (order now appears in kitchen view)
3. Kitchen staff can view all active orders: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`
4. When kitchen starts preparing an item → Order status automatically changes to `PREPARING`
5. When all items are ready → Order status automatically changes to `READY`
6. Customers receive real-time updates via WebSocket throughout the process

**Kitchen Visibility**:
- Kitchen staff can view orders with status: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`
- Orders on hold (`isOnHold = true`) are excluded from kitchen view
- Orders are sorted by creation time (oldest first)

### Get Kitchen Orders
```http
GET /kitchen-display/orders?restaurantId={id}&vendorId={id}&status={status}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `KITCHEN_STAFF`

**Query Parameters**:
- `restaurantId` (optional): Filter by restaurant ID
- `vendorId` (optional): Filter by vendor ID
- `status` (optional): Filter by specific order status. If not provided, returns all active kitchen orders (PENDING, CONFIRMED, PREPARING, READY)

**Response**: Array of kitchen orders with order items, menu details, customer, and restaurant information

**Notes**:
- Default behavior (no status filter): Returns all active orders that need kitchen attention
- Orders are filtered to exclude those on hold
- Orders include full relations: `orderItems`, `orderItems.menu`, `customer`, `restaurant`

### Get Order Items
```http
GET /kitchen-display/order-items?restaurantId={id}&vendorId={id}&status={status}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `KITCHEN_STAFF`

**Query Parameters**:
- `restaurantId` (optional): Filter by restaurant ID
- `vendorId` (optional): Filter by vendor ID
- `status` (optional): Filter by order item status (pending, in_progress, ready, served)

**Response**: Array of order items with preparation status, including:
- Order details
- Menu item information
- Customer information
- Restaurant information
- Current item status and timestamps

**Notes**:
- Returns order items from orders with status: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`
- Excludes items from orders on hold
- Items are sorted by order creation time, then by item creation time

### Start Order Item
```http
POST /kitchen-display/order-item/{orderItemId}/start
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `KITCHEN_STAFF`

**Flow**: 
- Changes order item status from `pending` → `in_progress`
- Sets `startedAt` timestamp
- **Automatically updates order status**: If order status is `PENDING` or `CONFIRMED`, it changes to `PREPARING`

**Response**: Updated order item with status `in_progress` and `startedAt` timestamp

**Real-time Events**: 
- `order_status_update` WebSocket event is broadcast to all subscribed clients (kitchen staff and customers)
- `order_update` WebSocket event is broadcast with full order details
- Customers receive real-time notification that their order is being prepared

### Mark Order Item Ready
```http
POST /kitchen-display/order-item/{orderItemId}/ready
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `KITCHEN_STAFF`

**Flow**: 
- Changes order item status from `in_progress` → `ready`
- Sets `readyAt` timestamp
- **Automatically checks if all items are ready**: If all order items are now `ready`, the order status automatically changes to `READY`

**Response**: Updated order item with status `ready` and `readyAt` timestamp

**Real-time Events**: 
- `order_status_update` WebSocket event is broadcast to all subscribed clients (kitchen staff and customers)
- `order_update` WebSocket event is broadcast with full order details
- If order status changes to `READY`, customers receive notification that their order is ready

### Extend Order Item Time
```http
POST /kitchen-display/order-item/{orderItemId}/extend-time
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "additionalMinutes": 15
}
```

### Get Kitchen Statistics
```http
GET /kitchen-display/statistics?restaurantId={id}&vendorId={id}&date={date}
Authorization: Bearer your-access-token
```

**Response**: Statistics object with order counts and completion rates

---

## Order Workflow: Customer → Waiter → Kitchen

This section describes the complete order lifecycle across all modules.

### Order Flow Diagram

```
1. CUSTOMER creates order
   ↓
   Order Status: PENDING
   Order Items Status: pending
   
2. WAITER confirms order
   ↓
   Order Status: CONFIRMED
   
3. KITCHEN starts preparing items
   ↓
   Order Item Status: in_progress (sets startedAt)
   
4. KITCHEN marks items ready
   ↓
   Order Item Status: ready (sets readyAt)
   
5. WAITER marks order as ready
   ↓
   Order Status: READY
   
6. WAITER serves order
   ↓
   Order Status: SERVED
   
7. WAITER marks order completed
   ↓
   Order Status: COMPLETED
```

### Complete Order Workflow Steps

#### Step 1: Customer Creates Order
**Endpoint**: `POST /customer-portal/order`  
**Actor**: Customer  
**Result**: 
- Order created with status `PENDING` (if restaurant has `pay_at_first`) or `CONFIRMED` (if restaurant has `pay_at_last`)
- Order items with status `pending`
- Order type (`takeaway` or `dine_in`) is set based on customer selection or table presence

#### Step 2: Waiter Confirms Order (if needed)
**Endpoint**: `POST /orders/{orderId}/confirm`  
**Actor**: Waiter/Staff  
**Result**: Order status changes to `CONFIRMED`  
**Note**: This step is only needed for restaurants with `pay_at_first` payment timing. For `pay_at_last` restaurants, orders are automatically confirmed and sent to kitchen.

#### Step 3: Kitchen Views Orders
**Endpoint**: `GET /kitchen-display/orders` or `GET /kitchen-display/order-items`  
**Actor**: Kitchen Staff  
**Result**: Views all active orders (PENDING, CONFIRMED, PREPARING, READY) and their items
**Note**: Confirmed orders automatically appear in kitchen view. Kitchen can see all orders that need attention.

#### Step 4: Kitchen Starts Preparing Item
**Endpoint**: `POST /kitchen-display/order-item/{orderItemId}/start`  
**Actor**: Kitchen Staff  
**Result**: 
- Order item status changes to `in_progress`, `startedAt` timestamp set
- **Order status automatically changes to `PREPARING`** (if it was PENDING or CONFIRMED)
- **Real-time WebSocket update** sent to customers and kitchen staff

#### Step 5: Kitchen Marks Item Ready
**Endpoint**: `POST /kitchen-display/order-item/{orderItemId}/ready`  
**Actor**: Kitchen Staff  
**Result**: 
- Order item status changes to `ready`, `readyAt` timestamp set
- **If all items are ready, order status automatically changes to `READY`**
- **Real-time WebSocket update** sent to customers and kitchen staff

#### Step 6: Waiter Marks Order Ready
**Endpoint**: `POST /order-status/order/{orderId}/mark-ready`  
**Actor**: Waiter/Staff  
**Result**: Order status changes to `READY` (when all items are ready)

#### Step 7: Waiter Marks Order Served
**Endpoint**: `PATCH /order-status/order-item/{orderItemId}/status` (status: `served`)  
**Actor**: Waiter/Staff  
**Result**: Order item status changes to `served`, `servedAt` timestamp set

#### Step 8: Waiter Marks Order Completed
**Endpoint**: `POST /order-status/order/{orderId}/mark-completed`  
**Actor**: Waiter/Staff  
**Result**: Order status changes to `COMPLETED`

### Order Status Transitions

**Order Status Flow**:
- `pending` → `confirmed` → `preparing` → `ready` → `served` → `completed`
- Any status → `cancelled` (can cancel from most statuses)

**Order Item Status Flow**:
- `pending` → `in_progress` → `ready` → `served`

**Important Notes**: 
- **Order Status** and **Order Item Status** are separate:
  - Order Status: Tracks overall order lifecycle (`pending` → `confirmed` → `preparing` → `ready` → `served` → `completed`)
  - Order Item Status: Tracks individual item preparation (`pending` → `in_progress` → `ready` → `served`)
- **Automatic Status Updates**:
  - Order status `preparing` is **automatically set** when kitchen starts preparing any item (item status → `in_progress`)
  - Order status `ready` is **automatically set** when all order items are marked as `ready`
- Order item status `in_progress` matches the requirement "IN_PROGRESS" (for individual items)
- Order status transitions are managed via OrderStatusService endpoints (OrderStatusModule)
- **Real-time Updates**: All status changes are broadcasted via WebSocket to:
  - Kitchen staff (via restaurant room subscriptions)
  - Customers (via customer order subscriptions)
  - All subscribed clients (via order-specific subscriptions)
- **Kitchen Visibility**: Kitchen can view orders with status: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`
- **Customer Tracking**: Customers can subscribe to their orders via WebSocket to receive real-time status updates

---

## Category Management

Categories are used to organize menu items (e.g., Foods, Beverages, Appetizers, Main Courses, Desserts).

**Example Categories**:
- **Foods** - Main food items (rice, chicken, pasta, etc.)
- **Beverages** - Drinks and beverages
- **Appetizers** - Starter dishes
- **Desserts** - Sweet items
- **Sides** - Side dishes and extras

Note: Categories can be nested or flat based on restaurant needs. The system supports flexible category organization.

### Create Category
```http
POST /categories
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Appetizers",
  "description": "Starter dishes and small plates",
  "code": "APPETIZERS",
  "image": "https://example.com/appetizers.jpg"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Request Body**:
- `name` (string, required): Category name (must be unique)
- `description` (string, optional): Category description
- `code` (string, optional): Category code (auto-generated from name in uppercase if not provided)
- `image` (string, optional): Category image URL

**Note**: 
- Category name must be unique across the system
- Code is auto-generated as uppercase version of name if not provided
- Code must also be unique
- Image URL is returned in all category responses

**Response**:
```json
{
  "isSuccess": true,
  "value": {
    "id": "category-uuid",
    "name": "Appetizers",
    "code": "APPETIZERS",
    "description": "Starter dishes and small plates",
    "image": "https://example.com/appetizers.jpg",
    "createdAt": "2025-01-11T21:00:00.000Z",
    "updatedAt": "2025-01-11T21:00:00.000Z"
  },
  "message": "Category created successfully"
}
```

### Get All Categories
```http
GET /categories
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Note**: Currently returns all categories without filtering or pagination. Filtering and pagination are not yet implemented.

**Response**: Array of category objects

### Get Restaurants by Category

```http
GET /categories/restaurants?categoryId={categoryId}
GET /categories/restaurants?categoryName={categoryName}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Query Parameters**:
- `categoryId` (uuid, optional): Category identifier. Either `categoryId` or `categoryName` must be provided.
- `categoryName` (string, optional): Category name (case-insensitive search). Either `categoryId` or `categoryName` must be provided.
- `tenantId` (uuid, optional): Filter restaurants by tenant ID. For non-admin users, this is automatically set to their tenant.

**Description**: Returns a list of restaurants that have menu items in the specified category. Useful for finding which restaurants offer items in a specific category (e.g., "Pizza", "Beverages", "Desserts").

**Response**: Array of restaurant objects
```json
[
  {
    "id": "restaurant-uuid-1",
    "name": "Pizza Palace",
    "logo": "https://example.com/logo.png",
    "address": {
      "lane": "123 Main St",
      "city": "New York",
      "district": "Manhattan",
      "country": "USA"
    },
    "contactEmail": "info@pizzapalace.com",
    "contactPhoneNumber": "+1234567890",
    "openTime": "09:00",
    "closeTime": "22:00",
    "openHours": {
      "mon-fri": "10:00-22:00",
      "sat-sun": "09:00-23:00"
    },
    "status": "active",
    "isActive": true,
    "paymentTiming": "pay_at_last",
    "tenantId": "tenant-uuid",
    "createdAt": "2025-01-11T21:00:00.000Z",
    "updatedAt": "2025-01-11T21:00:00.000Z"
  }
]
```

**Example Requests**:
```http
# Get restaurants with a specific category by ID
GET /categories/restaurants?categoryId=category-uuid-123

# Get restaurants with a category by name (case-insensitive)
GET /categories/restaurants?categoryName=Pizza

# Get restaurants with a category within a specific tenant
GET /categories/restaurants?categoryName=Beverages&tenantId=tenant-uuid
```

**Notes**:
- Only returns active restaurants (`isActive: true`, `status: 'active'`)
- Returns restaurants sorted alphabetically by name
- If searching by category name, finds all restaurants with categories matching that name (categories with the same name across different restaurants)
- Non-admin users automatically see only restaurants from their tenant

**Error Responses**:
- `400 Bad Request`: Neither `categoryId` nor `categoryName` provided
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions

### Get Category by ID
```http
GET /categories/{categoryId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Response**: Category object

### Delete Categories (Bulk)
```http
DELETE /categories
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "ids": ["category-uuid-1", "category-uuid-2"]
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`

**Request Body**:
- `ids` (array of uuids, required): Array of category IDs to delete

**Note**: Deletes multiple categories at once. Ensure categories are not in use by menu items before deleting.

**Response**:
```json
{
  "isSuccess": true,
  "value": true,
  "message": "Categories deleted successfully"
}
```

## Menu Management

Menus are linked to restaurants (outlets) and allow restaurants to organize their food items by category.

**Menu Customization**: Customers can add special instructions or customization options when ordering. This is done via the `specialInstructions` field in order items, which supports both:
- **Plain text**: `"No onions"` or `"Extra spicy"`
- **JSON object**: `{"portion": "full", "spiceLevel": "medium", "note": "No onions"}`

The field is stored as JSONB in the database and can handle any structured data needed for menu item customizations.

**Menu Variant Options**: Menu items can have variant options (e.g., Size, Flavor, Toppings) that allow customers to customize their orders. Each variant group can be:
- **Single selection** (`type: "single"`): Radio button selection (e.g., Size: Small, Medium, Large)
- **Multiple selection** (`type: "multiple"`): Checkbox selection (e.g., Toppings: Extra Cheese, Pepperoni)
- Each option requires only `name` and `price` fields
- Variant options are stored as JSONB in the database and returned in all menu responses

**Public Menu Endpoints for QR Code Scanning**:
- These endpoints are designed for customers who scan QR codes and **do not require authentication**
- **Food Court Tenants**: Use `/menus/food-court` or `/menus/tenant` to get all restaurants and their menus
- **Restaurant Tenants**: Use `/menus/tenant` to get menus for that specific restaurant only
- The tenant ID is typically embedded in the QR code URL or passed as a query parameter

### Restaurant Menu Access & Security

All authenticated menu endpoints are **restaurant-scoped**:
- `SUPER_ADMIN` users must provide an explicit `restaurantId` and can target any restaurant.
- `TENANT_ADMIN`, `MANAGER`, `WAITER`, and `KITCHEN_STAFF` are automatically limited to the restaurant linked to their JWT token (`user.restaurantId`). Any provided `restaurantId` is ignored and attempting to access another restaurant returns `403 Forbidden`.
- Every CRUD operation validates that the menu and category belong to the authorized restaurant before proceeding.
- This guarantees menus remain isolated per restaurant, preventing cross-restaurant leakage.

### Create Menu Item
```http
POST /menus
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Margherita Pizza",
  "description": "Fresh mozzarella, tomato sauce, and basil",
  "note": "Classic Italian pizza",
  "price": 12.99,
  "image": "https://example.com/pizza.jpg",
  "restaurantId": "restaurant-uuid",
  "categoryId": "category-uuid",
  "discount": 0,
  "quantityAvailable": 50,
  "preparationTime": 20,
  "isAvailable": true,
  "availableFrom": "12:00",
  "availableTo": "22:00",
  "variantOptions": [
    {
      "name": "Size",
      "type": "single",
      "required": true,
      "options": [
        {
          "name": "Small",
          "price": 1200
        },
        {
          "name": "Medium",
          "price": 1500
        },
        {
          "name": "Large",
          "price": 1800
        }
      ]
    },
    {
      "name": "Toppings",
      "type": "multiple",
      "required": false,
      "options": [
        {
          "name": "Extra Cheese",
          "price": 200
        },
        {
          "name": "Pepperoni",
          "price": 300
        }
      ]
    }
  ]
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`  
**Read Access**: `WAITER` and `KITCHEN_STAFF` can view menus but cannot create/update/delete menu details  
**Availability Update**: `WAITER` and `KITCHEN_STAFF` can update menu item availability using the dedicated endpoint

**Request Body**:
- `name` (string, required): Menu item name
- `description` (string, optional): Detailed description
- `note` (string, optional): Short note/description
- `price` (number, required): Price of the menu item
- `image` (string, optional): Image URL (currently accepts URL string - S3 upload not yet implemented)
- `restaurantId` (uuid, required): Restaurant/outlet ID this menu item belongs to. For non-`SUPER_ADMIN` users this field is automatically overridden with the restaurant attached to their token.
- `categoryId` (uuid, required): Category ID for organizing menu items
- `discount` (number, optional): Discount amount (default: 0)
- `quantityAvailable` (number, optional): Available quantity
- `preparationTime` (number, optional): Preparation time in minutes
- `isAvailable` (boolean, optional): Whether the menu item is available for ordering (default: `true`)
- `availableFrom` (string, optional): Informational field - time when the item becomes available in HH:mm format (e.g., "12:00", "09:30"). This is for display purposes only and does not affect filtering or availability checks
- `availableTo` (string, optional): Informational field - time when the item stops being available in HH:mm format (e.g., "22:00", "23:30"). This is for display purposes only and does not affect filtering or availability checks
- `variantOptions` (array, optional): Array of variant option groups. Each group contains:
  - `name` (string, required): Variant group name (e.g., "Size", "Flavor", "Toppings")
  - `type` (enum, required): Selection type - `single` (radio button) or `multiple` (checkbox)
  - `required` (boolean, optional): Whether selection is mandatory (default: false)
  - `options` (array, required): Array of variant options, each containing:
    - `name` (string, required): Option name (e.g., "Small", "Medium", "Large")
    - `price` (number, required): Price for this variant option

**Note**: 
- Image upload to S3 is not yet implemented. Currently accepts `image` as a URL string.
- Menu items are linked to restaurants via `restaurantId`.
- Category is linked via `categoryId` foreign key relationship.
- Menu item names must be unique within a restaurant.
- The `availableFrom` and `availableTo` fields are informational only (for display purposes) and do not affect filtering or availability validation. Only the `isAvailable` boolean flag is used for filtering and validation.

**Response**:
```json
{
  "id": "menu-uuid",
  "name": "Margherita Pizza",
  "description": "Fresh mozzarella, tomato sauce, and basil",
  "note": "Classic Italian pizza",
  "price": "12.99",
  "image": "https://example.com/pizza.jpg",
  "discount": 0,
  "quantityAvailable": 50,
  "preparationTime": 20,
  "isAvailable": true,
  "availableFrom": "12:00",
  "availableTo": "22:00",
  "variantOptions": [
    {
      "name": "Size",
      "type": "single",
      "required": true,
      "options": [
        {
          "name": "Small",
          "price": 1200
        },
        {
          "name": "Medium",
          "price": 1500
        },
        {
          "name": "Large",
          "price": 1800
        }
      ]
    }
  ],
  "restaurantId": "restaurant-uuid",
  "categoryId": "category-uuid",
  "category": {
    "id": "category-uuid",
    "name": "Pizzas",
    "code": "PIZZAS",
    "description": "Italian pizzas",
    "image": "https://example.com/pizzas.jpg"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace",
    "address": "123 Main St"
  },
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

### Get All Menus
```http
GET /menus?restaurantId={restaurantId}&page=1&limit=10&search=pizza&sortBy=name&sortOrder=ASC&categoryId={categoryId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Query Parameters**:
- `restaurantId` (uuid): For `SUPER_ADMIN` users, this parameter is required and lets them choose the target restaurant. For all other roles it is optional/ignored because the backend uses the restaurant from the JWT token and enforces that scope automatically.
- `page` (number, optional): Page number (default: 1, min: 1)
- `limit` (number, optional): Items per page (default: 10, min: 1, max: 100)
- `search` (string, optional): Search term to filter by name or description (case-insensitive)
- `sortBy` (string, optional): Field to sort by. Allowed values: `name`, `price`, `discount`, `createdAt`, `updatedAt` (default: `createdAt`)
- `sortOrder` (enum, optional): Sort direction - `ASC` or `DESC` (default: `DESC`)
- `categoryId` (uuid, optional): Filter by category ID
- `isAvailable` (boolean, optional): Filter by availability status (`true` for available items, `false` for unavailable items)

**Response** (with pagination parameters):
```json
{
  "data": [
    {
      "id": "menu-uuid",
      "name": "Margherita Pizza",
      "description": "Fresh mozzarella, tomato sauce, and basil",
      "note": "Classic Italian pizza",
      "price": "12.99",
      "image": "https://example.com/pizza.jpg",
      "discount": 0,
      "quantityAvailable": 50,
      "preparationTime": 20,
      "isAvailable": true,
      "availableFrom": "12:00",
      "availableTo": "22:00",
      "variantOptions": [
        {
          "name": "Size",
          "type": "single",
          "required": true,
          "options": [
            {
              "name": "Small",
              "price": 1200
            }
          ]
        }
      ],
      "restaurantId": "restaurant-uuid",
      "categoryId": "category-uuid",
      "category": {
        "id": "category-uuid",
        "name": "Pizzas",
        "code": "PIZZAS",
        "image": "https://example.com/pizzas.jpg"
      },
      "restaurant": {
        "id": "restaurant-uuid",
        "name": "Pizza Palace"
      },
      "createdAt": "2025-01-11T21:00:00.000Z",
      "updatedAt": "2025-01-11T21:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15
}
```

**Response** (without pagination parameters - backward compatible):
```json
[
  {
    "id": "menu-uuid",
    "name": "Margherita Pizza",
    "description": "Fresh mozzarella, tomato sauce, and basil",
    "note": "Classic Italian pizza",
    "price": "12.99",
    "image": "https://example.com/pizza.jpg",
      "discount": 0,
      "quantityAvailable": 50,
      "preparationTime": 20,
      "isAvailable": true,
      "availableFrom": "12:00",
      "availableTo": "22:00",
      "variantOptions": [
        {
          "name": "Size",
          "type": "single",
          "required": true,
          "options": [
            {
              "name": "Small",
              "price": 1200
            }
          ]
        }
      ],
      "restaurantId": "restaurant-uuid",
    "categoryId": "category-uuid",
    "category": {
      "id": "category-uuid",
      "name": "Pizzas",
      "code": "PIZZAS",
      "image": "https://example.com/pizzas.jpg"
    },
    "restaurant": {
      "id": "restaurant-uuid",
      "name": "Pizza Palace"
    },
    "createdAt": "2025-01-11T21:00:00.000Z",
    "updatedAt": "2025-01-11T21:00:00.000Z"
  }
]
```

**Note**: 
- If pagination parameters (`page`, `limit`, `search`, `sortBy`, `sortOrder`, `categoryId`) are provided, the endpoint returns paginated results with enhanced filtering
- If no pagination parameters are provided, the endpoint returns all menus in the original format for backward compatibility

### Get Menu by ID
```http
GET /menus/{menuId}?restaurantId={restaurantId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID (can also be inferred from user's restaurant if user has one)

**Response**: Menu item object with restaurant and category relations

**Example Response**:
```json
{
  "id": "menu-uuid",
  "name": "Margherita Pizza",
  "description": "Fresh mozzarella, tomato sauce, and basil",
  "note": "Classic Italian pizza",
  "price": "12.99",
  "image": "https://example.com/pizza.jpg",
  "discount": 0,
  "quantityAvailable": 50,
  "preparationTime": 20,
  "isAvailable": true,
  "availableFrom": "12:00",
  "availableTo": "22:00",
  "variantOptions": [
    {
      "name": "Size",
      "type": "single",
      "required": true,
      "options": [
        {
          "name": "Small",
          "price": 1200
        },
        {
          "name": "Medium",
          "price": 1500
        },
        {
          "name": "Large",
          "price": 1800
        }
      ]
    }
  ],
  "restaurantId": "restaurant-uuid",
  "categoryId": "category-uuid",
  "category": {
    "id": "category-uuid",
    "name": "Pizzas",
    "code": "PIZZAS",
    "image": "https://example.com/pizzas.jpg"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

### Update Menu Item
```http
PATCH /api/menus/{menuId}?restaurantId={restaurantId}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Pizza Name",
  "description": "Updated description",
  "note": "Updated note",
  "price": 14.99,
  "image": "https://example.com/new-pizza.jpg",
  "discount": 2.00,
  "categoryId": "new-category-uuid",
  "restaurantId": "restaurant-uuid",
  "quantityAvailable": 40,
  "preparationTime": 25,
  "isAvailable": true,
  "availableFrom": "12:00",
  "availableTo": "22:00"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`  
**Note**: WAITER and KITCHEN_STAFF cannot update menu details, but they can update availability using the dedicated endpoint below

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID (can also be inferred from user's restaurant if user has one)

**Request Body** (all fields optional):
- `name` (string): Updated menu item name
- `description` (string): Updated description
- `note` (string): Updated note
- `price` (number): Updated price
- `image` (string): Updated image URL
- `discount` (number): Updated discount
- `categoryId` (uuid): Updated category ID
- `restaurantId` (uuid): Updated restaurant ID
- `quantityAvailable` (number): Updated available quantity
- `preparationTime` (number): Updated preparation time
- `isAvailable` (boolean): Updated availability status
- `availableFrom` (string): Updated informational time when item becomes available (HH:mm format, e.g., "12:00"). This is for display purposes only
- `availableTo` (string): Updated informational time when item stops being available (HH:mm format, e.g., "22:00"). This is for display purposes only
- `variantOptions` (array, optional): Updated variant options (same structure as Create Menu Item)

**Response**: Updated menu item object with restaurant and category relations

### Update Menu Item Availability
```http
PATCH /api/menus/{menuId}/availability?restaurantId={restaurantId}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "isAvailable": false
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`  
**Note**: This endpoint allows staff members (WAITER and KITCHEN_STAFF) to update menu item availability without requiring full menu update permissions. This is useful for quickly marking items as unavailable when they run out.

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID (can also be inferred from user's restaurant if user has one)

**Request Body**:
- `isAvailable` (boolean, required): New availability status (`true` for available, `false` for unavailable)

**Response**: Updated menu item object with restaurant and category relations

**Note on Time Fields**: 
- This endpoint only updates the `isAvailable` boolean flag
- To update time fields (`availableFrom` and `availableTo`), use the full menu update endpoint (`PATCH /menus/{menuId}`)
- The `availableFrom` and `availableTo` fields are informational only and do not affect availability checks or filtering

**Example Use Cases**:
- Kitchen staff marking items as unavailable when ingredients run out
- Waiters marking items as unavailable during service
- Managers quickly toggling item availability

### Delete Menu Item
```http
DELETE /api/menus/{menuId}?restaurantId={restaurantId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, or `MANAGER`  
**Note**: WAITER and KITCHEN_STAFF cannot delete menus

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID (can also be inferred from user's restaurant if user has one)

**Response**:
```json
{
  "message": "Menu deleted successfully"
}
```

**Error Responses**:
- `403 Forbidden`: User does not have permission to delete this menu
- `404 Not Found`: Menu not found for this restaurant

### Get Menus by Restaurant
```http
GET /menus/restaurant/{restaurantId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Access Control**:
- `SUPER_ADMIN`: Must provide the target `restaurantId`.
- Other roles: Can only access their own restaurant; if a different `restaurantId` is supplied, the request fails with `403 Forbidden`.

**Response**: Array of menu items for the specified restaurant, including restaurant details

### Get Menus by Food Court
```http
GET /menus/food-court?tenantId={tenantId}
X-Tenant-ID: tenant-uuid (optional)
```

**Public Endpoint** (No authentication required) - For QR code scanning

**Tenant Identification** (one of the following is required):
- `X-Tenant-ID` header: Food court tenant ID (preferred - set by TenantMiddleware)
- Subdomain: Extract tenant from subdomain (e.g., `foodcourt.example.com`)
- `tenantId` query parameter: Food court tenant ID (for backward compatibility)

**Query Parameters**:
- `tenantId` (uuid, optional): Food court tenant ID (used only if not provided via header or subdomain)

**Headers** (optional):
- `X-Tenant-ID`: Food court tenant ID (set automatically by TenantMiddleware if subdomain is used)

**Note**: 
- This endpoint is **public** and designed for customers scanning QR codes
- This endpoint is only available for food court tenants (`TenantType.FOOD_COURT`)
- Returns all restaurants and their menus under the food court tenant
- Each restaurant in the response includes its full menu items

**Response**: Array of objects, each containing a restaurant and its menus
```json
[
  {
    "restaurant": {
      "id": "restaurant-uuid-1",
      "tenantId": "food-court-tenant-uuid",
      "name": "Pizza Place",
      "address": "123 Main St",
      "contactEmail": "info@pizzaplace.com",
      "contactPhoneNumber": "+1234567890",
      "logo": "https://example.com/pizza-logo.png",
      "openTime": "09:00",
      "closeTime": "22:00",
      "openHours": {
        "mon-fri": "10:00-22:00",
        "sat-sun": "09:00-23:00"
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    },
    "menus": [
      {
        "id": "menu-uuid-1",
        "name": "Margherita Pizza",
        "description": "Classic pizza",
        "price": "12.99",
        "image": "https://example.com/pizza.jpg",
        "restaurantId": "restaurant-uuid-1",
        "categoryId": "category-uuid",
        "category": {
          "id": "category-uuid",
          "name": "Pizzas",
          "code": "PIZZAS"
        },
        "restaurant": {
          "id": "restaurant-uuid-1",
          "name": "Pizza Place"
        },
        "createdAt": "2025-01-11T21:00:00.000Z",
        "updatedAt": "2025-01-11T21:00:00.000Z"
      }
    ]
  },
  {
    "restaurant": {
      "id": "restaurant-uuid-2",
      "tenantId": "food-court-tenant-uuid",
      "name": "Burger House",
      "address": "456 Main St",
      "contactEmail": "info@burgerhouse.com",
      "contactPhoneNumber": "+9876543210",
      "logo": "https://example.com/burger-logo.png",
      "openTime": "10:00",
      "closeTime": "23:00",
      "openHours": {
        "mon-fri": "11:00-21:00"
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    },
    "menus": [
      {
        "id": "menu-uuid-2",
        "name": "Classic Burger",
        "description": "Juicy burger",
        "price": "9.99",
        "image": "https://example.com/burger.jpg",
        "restaurantId": "restaurant-uuid-2",
        "categoryId": "category-uuid-2",
        "category": {
          "id": "category-uuid-2",
          "name": "Burgers",
          "code": "BURGERS"
        },
        "restaurant": {
          "id": "restaurant-uuid-2",
          "name": "Burger House"
        },
        "createdAt": "2025-01-11T21:00:00.000Z",
        "updatedAt": "2025-01-11T21:00:00.000Z"
      }
    ]
  }
]
```

**Error Responses**:
- `400 Bad Request`: Tenant ID is required or tenant type is not food court
- `404 Not Found`: Tenant not found

### Get Menus by Tenant Type
```http
GET /menus/tenant?tenantId={tenantId}&restaurantId={restaurantId}
X-Tenant-ID: tenant-uuid (optional)
```

**Public Endpoint** (No authentication required) - For QR code scanning

**Tenant Identification** (one of the following is required):
- `X-Tenant-ID` header: Tenant ID (preferred - set by TenantMiddleware)
- Subdomain: Extract tenant from subdomain (e.g., `restaurant.example.com`)
- `tenantId` query parameter: Tenant ID (for backward compatibility)

**Query Parameters**:
- `tenantId` (uuid, optional): Tenant ID (used only if not provided via header or subdomain)
- `restaurantId` (uuid, optional): Restaurant ID (not required - automatically determined for restaurant tenant type)

**Headers** (optional):
- `X-Tenant-ID`: Tenant ID (set automatically by TenantMiddleware if subdomain is used)

**Behavior**:
- **For Food Court Tenant** (`TenantType.FOOD_COURT`): Returns all restaurants and their menus under the food court (same as `/menus/food-court`)
- **For Restaurant Tenant** (`TenantType.RESTAURANT`): Returns menus **only for that specific restaurant** under the tenant (restaurantId is automatically determined from the tenant)

**Note**: 
- This endpoint is **public** and designed for customers scanning QR codes
- For restaurant tenants, the system automatically finds the restaurant associated with that tenant
- For food court tenants, all restaurants and their menus are returned

**Response** (Food Court):
```json
[
  {
    "restaurant": { ... },
    "menus": [ ... ]
  }
]
```

**Response** (Restaurant):
```json
[
  {
    "id": "menu-uuid",
    "name": "Menu Item",
    "description": "...",
    "price": "12.99",
    "restaurantId": "restaurant-uuid",
    "categoryId": "category-uuid",
    "category": { ... },
    "restaurant": { ... }
  }
]
```

**Error Responses**:
- `400 Bad Request`: Tenant ID is required or invalid tenant type
- `404 Not Found`: Tenant or restaurant not found

### Get Menu Items with Category Filter (Public)
```http
GET /menus/items?restaurantId={restaurantId}&category={categoryId|all}
```

**Public Endpoint** (No authentication required) - For customer menu browsing with category filtering

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID to get menu items from
- `category` (string, optional): Category filter
  - Not provided or `"all"`: Returns all menu items from the restaurant
  - `{categoryId}`: Returns only menu items from the specified category (e.g., Appetizers, Main Course)

**Use Cases**:
- **Show all items**: `GET /menus/items?restaurantId={restaurantId}`
- **Show all items explicitly**: `GET /menus/items?restaurantId={restaurantId}&category=all`
- **Filter by category**: `GET /menus/items?restaurantId={restaurantId}&category={categoryId}`

**Response**:
```json
[
  {
    "id": "menu-uuid",
    "name": "Margherita Pizza",
    "description": "Fresh mozzarella, tomato sauce, and basil",
    "note": "Classic Italian pizza",
    "price": "12.99",
    "image": "https://example.com/pizza.jpg",
    "restaurantId": "restaurant-uuid",
    "categoryId": "category-uuid",
    "discount": 0,
    "quantityAvailable": 50,
    "preparationTime": 20,
    "isAvailable": true,
    "availableFrom": "12:00",
    "availableTo": "22:00",
    "variantOptions": [
      {
        "name": "Size",
        "type": "single",
        "required": true,
        "options": [
          { "name": "Small", "price": 1200 },
          { "name": "Medium", "price": 1500 },
          { "name": "Large", "price": 1800 }
        ]
      }
    ],
    "restaurant": {
      "id": "restaurant-uuid",
      "name": "Pizza Palace",
      "tenantId": "tenant-uuid"
    },
    "category": {
      "id": "category-uuid",
      "name": "Main Course",
      "description": "Main dishes",
      "displayOrder": 2
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-11T00:00:00.000Z"
  }
]
```

**Benefits**:
- Allows customers to filter menu items by category (e.g., Appetizers, Main Course, Desserts)
- Reduces confusion by showing only relevant items for each category
- Supports "View All" option when category is "all" or not provided
- Returns complete menu item details including variant options, pricing, and availability

**Error Responses**:
- `400 Bad Request`: restaurantId is required
- `404 Not Found`: Restaurant or category not found

## Menu Item Customizations & Options

Menu items support two types of customization:

1. **Variant Options** (defined on menu items): Pre-defined variant groups like Size, Flavor, or Toppings that customers can select when ordering
2. **Special Instructions** (free-form): Custom text or JSON instructions that customers can add to their orders

### Variant Options

Variant options are defined when creating or updating menu items. They allow restaurants to offer structured customization choices:

**Example Variant Structure**:
```json
{
  "variantOptions": [
    {
      "name": "Size",
      "type": "single",
      "required": true,
      "options": [
        { "name": "Small", "price": 1200 },
        { "name": "Medium", "price": 1500 },
        { "name": "Large", "price": 1800 }
      ]
    },
    {
      "name": "Toppings",
      "type": "multiple",
      "required": false,
      "options": [
        { "name": "Extra Cheese", "price": 200 },
        { "name": "Pepperoni", "price": 300 }
      ]
    }
  ]
}
```

**Variant Types**:
- `single`: Customer must select exactly one option (radio buttons)
- `multiple`: Customer can select multiple options (checkboxes)

**Price Calculation**: Base price + sum of selected option price modifiers = Final price

### Special Instructions

Customers can add **flexible customization options** when ordering menu items. These are stored in the `specialInstructions` field as JSONB.

### Supported Customizations

The system supports any customization fields needed by the restaurant. Common examples include:

**Portion Sizes**:
```json
{
  "portion": "full",       // full, half, medium, small
  "rice": "full",          // full, half, medium
  "chicken": "medium",     // full, medium, small
  "meat": "full"           // flexible portion options
}
```

**Spice Levels**:
```json
{
  "spiceLevel": "medium"   // mild, medium, spicy, extra-spicy
}
```

**Dietary Requirements**:
```json
{
  "dietary": ["halal", "gluten-free", "vegetarian", "vegan"]
}
```

**Cooking Preferences**:
```json
{
  "doneness": "well-done",    // rare, medium-rare, medium, well-done
  "noOnions": true,
  "extraCheese": true,
  "extraRaita": true
}
```

**Mixed Customizations**:
```json
{
  "portion": "full",
  "rice": "full",
  "chicken": "medium",
  "spiceLevel": "medium",
  "note": "Extra raita on side, no onions"
}
```

### How It Works

1. **Customer places order** with customization options
2. **Stored as JSONB** in `OrderItem.specialInstructions`
3. **Kitchen receives** order with full customization details
4. **Order history** preserves all customization information

### Example: Complete Order Flow

**Step 1**: Customer scans QR code
```http
GET /customer-portal/qr/{qrCodeId}/menu
```
**Response**: Menu with all items and categories

**Step 2**: Customer places order with customizations
```http
POST /customer-portal/order
{
  "restaurantId": "restaurant-uuid",
  "customerId": "+1234567890",
  "tableNo": "5",
  "orderItems": [
    {
      "menuId": "biryani-uuid",
      "quantity": 1,
      "specialInstructions": {
        "portion": "full",
        "rice": "full",
        "chicken": "medium",
        "spiceLevel": "medium",
        "note": "Extra raita on side"
      }
    }
  ]
}
```

**Step 3**: Kitchen views order with customizations
```http
GET /orders/{orderId}
```
**Response**: Order with full menu and customization details

---

## Table Management

Tables are used to organize restaurant seating and track table availability. Each table belongs to a specific restaurant and has a unique name within that restaurant.

**Table Entity Fields**:
- `id` (uuid): Auto-generated unique identifier
- `name` (string, required): Table name (unique per restaurant)
- `tableNumber` (string, required): Table number/identifier
- `capacity` (number, required): Number of seats (minimum: 1)
- `location` (jsonb, optional): Table location information (e.g., `{ section: 'Window Area', floor: 1, coordinates: { x: 10, y: 20 } }`)
- `restaurantId` (uuid, required): Restaurant this table belongs to
- `status` (enum, optional): Table status (`available`, `occupied`, `reserved`, `maintenance`)
- `qrCode` (string, optional): QR code for table ordering
- `createdAt`, `updatedAt`: Auto-managed timestamps

### Restaurant Table Access & Security

All authenticated table endpoints are **restaurant-scoped**:
- `SUPER_ADMIN` users must provide an explicit `restaurantId` and can target any restaurant.
- `TENANT_ADMIN`, `MANAGER`, `WAITER`, and `KITCHEN_STAFF` are automatically limited to the restaurant linked to their JWT token (`user.restaurantId`). Any provided `restaurantId` is ignored and attempting to access another restaurant returns `403 Forbidden`.
- Every CRUD operation validates that the table belongs to the authorized restaurant before proceeding.
- This guarantees tables remain isolated per restaurant, preventing cross-restaurant leakage.

### Create Table
```http
POST /tables
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Window Table 1",
  "tableNumber": "T-01",
  "capacity": 4,
  "location": {
    "section": "Window Area",
    "floor": 1,
    "coordinates": {
      "x": 10,
      "y": 20
    }
  },
  "restaurantId": "restaurant-uuid"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Request Body**:
- `name` (string, required): Table name (must be unique per restaurant)
- `tableNumber` (string, required): Table number/identifier
- `capacity` (number, required): Number of seats (minimum: 1)
- `location` (object, optional): Table location information (JSON object)
- `restaurantId` (uuid, required): Restaurant ID this table belongs to. For non-`SUPER_ADMIN` users this field is automatically overridden with the restaurant attached to their token.

**Note**: 
- Table name must be unique within the restaurant
- For non-`SUPER_ADMIN` users, `restaurantId` is automatically set from their user profile
- Location can contain any JSON structure (section, floor, coordinates, etc.)

**Response**: Created table object with restaurant relation

**Example Response**:
```json
{
  "id": "table-uuid",
  "name": "Window Table 1",
  "tableNumber": "T-01",
  "capacity": 4,
  "location": {
    "section": "Window Area",
    "floor": 1,
    "coordinates": {
      "x": 10,
      "y": 20
    }
  },
  "status": "available",
  "restaurantId": "restaurant-uuid",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace",
    "address": "123 Main St"
  },
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input or restaurant not found
- `403 Forbidden`: User does not have permission to create tables for this restaurant
- `409 Conflict`: Table with this name already exists in this restaurant

### Get All Tables
```http
GET /tables?restaurantId={restaurantId}&page=1&limit=10
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Query Parameters**:
- `restaurantId` (uuid): For `SUPER_ADMIN` users, this parameter is required and lets them choose the target restaurant. For all other roles it is optional/ignored because the backend uses the restaurant from the JWT token and enforces that scope automatically.
- `page` (number, optional): Page number (default: 1, min: 1)
- `limit` (number, optional): Items per page (default: 10, min: 1, max: 100)

**Response**: Paginated list of table objects for the specified restaurant

**Example Response**:
```json
{
  "data": [
    {
      "id": "table-uuid-1",
      "name": "Window Table 1",
      "tableNumber": "T-01",
      "capacity": 4,
      "location": {
        "section": "Window Area",
        "floor": 1
      },
      "status": "available",
      "restaurantId": "restaurant-uuid",
      "restaurant": {
        "id": "restaurant-uuid",
        "name": "Pizza Palace"
      },
      "createdAt": "2025-01-11T21:00:00.000Z",
      "updatedAt": "2025-01-11T21:00:00.000Z"
    },
    {
      "id": "table-uuid-2",
      "name": "Corner Table 2",
      "tableNumber": "T-02",
      "capacity": 6,
      "location": {
        "section": "Corner Area",
        "floor": 1
      },
      "status": "occupied",
      "restaurantId": "restaurant-uuid",
      "restaurant": {
        "id": "restaurant-uuid",
        "name": "Pizza Palace"
      },
      "createdAt": "2025-01-11T21:00:00.000Z",
      "updatedAt": "2025-01-11T21:00:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

### Get Table by ID
```http
GET /tables/{id}?restaurantId={restaurantId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, or `KITCHEN_STAFF`

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID (can also be inferred from user's restaurant if user has one)

**Response**: Table object with restaurant relation

**Error Responses**:
- `403 Forbidden`: User does not have permission to view this table
- `404 Not Found`: Table not found for this restaurant

### Update Table
```http
PATCH /api/tables/{id}?restaurantId={restaurantId}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Window Table 1",
  "tableNumber": "T-01-UPDATED",
  "capacity": 6,
  "location": {
    "section": "Updated Window Area",
    "floor": 2
  },
  "status": "occupied"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID (can also be inferred from user's restaurant if user has one)

**Request Body** (all fields optional):
- `name` (string): Updated table name (must be unique per restaurant)
- `tableNumber` (string): Updated table number
- `capacity` (number): Updated number of seats (minimum: 1)
- `location` (object): Updated location information
- `status` (enum, optional): Updated table booking status. Values: `available`, `occupied`, `reserved`, `maintenance`

**Response**: Updated table object with restaurant relation

**Error Responses**:
- `400 Bad Request`: Invalid input or table name already exists
- `403 Forbidden`: User does not have permission to update this table
- `404 Not Found`: Table not found for this restaurant
- `409 Conflict`: Table with this name already exists in this restaurant

### Update Table Booking Status
```http
PATCH /api/tables/{id}/status?restaurantId={restaurantId}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "status": "occupied"
}
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID (can also be inferred from user's restaurant if user has one)

**Request Body**:
- `status` (enum, required): New table booking status. Values:
  - `available` - Table is available for use
  - `occupied` - Table is currently occupied
  - `reserved` - Table is reserved for a booking
  - `maintenance` - Table is under maintenance

**Note**:
- This endpoint provides a dedicated way to update only the table booking status
- Useful for quickly updating table status without modifying other table properties
- The status field can also be updated via the general update endpoint (`PATCH /api/tables/{id}`)

**Response**: Updated table object with new status

**Example Response**:
```json
{
  "id": "table-uuid",
  "name": "Window Table 1",
  "tableNumber": "T-01",
  "capacity": 4,
  "status": "occupied",
  "restaurantId": "restaurant-uuid",
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Pizza Palace"
  },
  "createdAt": "2025-01-11T21:00:00.000Z",
  "updatedAt": "2025-01-11T21:05:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid status value
- `403 Forbidden`: User does not have permission to update this table status
- `404 Not Found`: Table not found for this restaurant

### Delete Table
```http
DELETE /tables/{id}?restaurantId={restaurantId}
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, or `WAITER`

**Query Parameters**:
- `restaurantId` (uuid, required): Restaurant ID (can also be inferred from user's restaurant if user has one)

**Response**:
```json
{
  "message": "Table deleted successfully"
}
```

**Error Responses**:
- `403 Forbidden`: User does not have permission to delete this table
- `404 Not Found`: Table not found for this restaurant

---

## Real-time Order Status Updates (WebSocket)

**Part of OrderStatusModule**: The WebSocket gateway is integrated into the OrderStatusModule and automatically broadcasts all status changes.

The WebSocket gateway is implemented using Socket.IO with namespace `/order-status`. **✅ All order status changes are automatically broadcast in real-time** to subscribed clients. The gateway is fully integrated with OrderManagementService and OrderStatusService.

**Automatic Broadcasts**:
- ✅ New orders: Broadcast when order is created
- ✅ Order status updates: Broadcast when order status changes (pending → confirmed → preparing → ready → completed/cancelled)
- ✅ Order item status updates: Broadcast when order item status changes (pending → in_progress → ready → served)
- ✅ Order confirmations: Broadcast when order is confirmed
- ✅ Order cancellations: Broadcast when order is cancelled

### Connection

**Server URL Configuration**:
The WebSocket server URL is configurable via environment variables:
- `SERVER_URL`: Base server URL (e.g., `https://your-server.com`)
- `WEBSOCKET_URL`: WebSocket URL (e.g., `wss://your-server.com`). If not set, automatically derived from `SERVER_URL`
- Default: `ws://localhost:4001` (development) or `wss://your-server.com` (production)

**Connection Example**:
```javascript
import io from 'socket.io-client';

// Production: Use your server URL
const socket = io('wss://your-server.com/order-status', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// Development: Use localhost
// const socket = io('ws://localhost:4001/order-status', {
//   transports: ['websocket', 'polling'],
// });
```

**Connection URL Format**:
- Development: `ws://localhost:4001/order-status`
- Production: `wss://your-server.com/order-status` (use your actual server URL)

**Note**: The server logs the WebSocket URL on startup. Check server logs for the exact connection URL.

### Authentication
```javascript
socket.emit('authenticate', { token: 'your-jwt-access-token' });

socket.on('authenticated', (data) => {
  console.log('Authenticated:', data); // { userId, role }
});

socket.on('authentication_failed', (data) => {
  console.error('Authentication failed:', data.message);
});
```

**Note**: JWT token is verified on authentication. Invalid tokens result in disconnection.

### Subscribe to Order Updates
```javascript
socket.emit('subscribe_order', { orderId: 'order-uuid' });

socket.on('subscribed_to_order', (data) => {
  console.log('Subscribed to order:', data.orderId);
});

socket.on('order_status_update', (data) => {
  console.log('Order status updated:', data);
  // data: { orderId, status, ...statusUpdate }
});
```

### Unsubscribe from Order Updates
```javascript
socket.emit('unsubscribe_order', { orderId: 'order-uuid' });

socket.on('unsubscribed_from_order', (data) => {
  console.log('Unsubscribed from order:', data.orderId);
});
```

### Subscribe to Restaurant Orders
```javascript
socket.emit('subscribe_restaurant_orders', { restaurantId: 'restaurant-uuid' });

socket.on('subscribed_to_restaurant', (data) => {
  console.log('Subscribed to restaurant:', data.restaurantId);
});

socket.on('new_order', (order) => {
  console.log('New order received:', order);
});

socket.on('order_update', (order) => {
  console.log('Order updated:', order);
});
```

### Subscribe to Food Court Orders
```javascript
socket.emit('subscribe_food_court_orders', { foodCourtId: 'food-court-uuid' });

socket.on('subscribed_to_food_court', (data) => {
  console.log('Subscribed to food court:', data.foodCourtId);
});
```

### Subscribe to Customer Order (For Customers)
```javascript
// Customers can subscribe to track their order status in real-time
socket.emit('subscribe_customer_order', { 
  orderId: 'order-uuid',
  customerId: 'customer-uuid' // Optional: for customer-specific room
});

socket.on('subscribed_to_customer_order', (data) => {
  console.log('Subscribed to order:', data.orderId);
  console.log('Customer ID:', data.customerId);
});

// Listen for real-time order updates
socket.on('order_status_update', (data) => {
  console.log('Order status updated:', data);
  // data contains: orderId, status, orderItem, updatedAt, etc.
  // Customers can see: pending → confirmed → preparing → ready → completed
});

socket.on('order_update', (order) => {
  console.log('Order updated:', order);
  // Full order object with all items and current status
});
```

### Unsubscribe from Customer Order
```javascript
socket.emit('unsubscribe_customer_order', { orderId: 'order-uuid' });

socket.on('unsubscribed_from_customer_order', (data) => {
  console.log('Unsubscribed from order:', data.orderId);
});
```

### Listen for Updates
```javascript
// Order status update (for subscribed orders)
socket.on('order_status_update', (data) => {
  console.log('Order status updated:', data);
  // { orderId, status, updatedAt, ... }
});

// New order notification (for restaurant/food court subscriptions)
socket.on('new_order', (order) => {
  console.log('New order received:', order);
  // Full order object
});

// Order update notification (for restaurant/food court subscriptions)
socket.on('order_update', (order) => {
  console.log('Order updated:', order);
  // Updated order object
});
```

### WebSocket Events Summary

**Client → Server Events**:
- `authenticate` - Authenticate with JWT token (for staff/admin)
- `subscribe_order` - Subscribe to specific order updates (for staff/admin)
- `unsubscribe_order` - Unsubscribe from order updates (for staff/admin)
- `subscribe_restaurant_orders` - Subscribe to all orders for a restaurant (for kitchen staff)
- `subscribe_food_court_orders` - Subscribe to all orders for a food court (for staff)
- `subscribe_customer_order` - Subscribe to order updates (for customers) - **NEW**
- `unsubscribe_customer_order` - Unsubscribe from order updates (for customers) - **NEW**

**Server → Client Events**:
- `authenticated` - Authentication successful
- `authentication_failed` - Authentication failed
- `subscribed_to_order` - Successfully subscribed to order
- `unsubscribed_from_order` - Successfully unsubscribed from order
- `subscribed_to_restaurant` - Successfully subscribed to restaurant orders
- `subscribed_to_food_court` - Successfully subscribed to food court orders
- `subscribed_to_customer_order` - Successfully subscribed to customer order - **NEW**
- `unsubscribed_from_customer_order` - Successfully unsubscribed from customer order - **NEW**
- `order_status_update` - Order status changed (broadcasted to all subscribed clients: kitchen staff, customers, etc.)
- `new_order` - New order created (for restaurant/food court subscribers)
- `order_update` - Order updated (broadcasted to restaurant, food court, and customer rooms)

### WebSocket Implementation Status

**Current Implementation**:
- ✅ WebSocket gateway implemented using Socket.IO
- ✅ JWT authentication for WebSocket connections (for staff/admin)
- ✅ Subscription management (order, restaurant, food court, customer)
- ✅ Connection/disconnection handling
- ✅ **Automatic WebSocket broadcasts on all order status changes**
- ✅ Gateway fully integrated with OrderStatusService
- ✅ Gateway fully integrated with OrderManagementService
- ✅ Real-time broadcasts for new orders, status updates, and cancellations
- ✅ **Customer order tracking** - Customers can subscribe to their orders
- ✅ **Server URL configuration** - Configurable via environment variables
- ✅ **Real-time kitchen updates** - Kitchen staff receive instant notifications
- ✅ **Real-time customer updates** - Customers see order status changes instantly

**Integration Points**:
1. ✅ `OrderStatusGateway` injected into `OrderStatusService` and `OrderManagementService`
2. ✅ `broadcastOrderStatusUpdate()` called when order status changes (broadcasts to all subscribed clients)
3. ✅ `broadcastNewOrder()` called when new order is created
4. ✅ `broadcastOrderUpdate()` called when order is updated (broadcasts to restaurant, food court, and customer rooms)
5. ✅ Order item status updates automatically broadcast to kitchen staff and customers
6. ✅ Order status auto-updates when kitchen starts preparing (PENDING/CONFIRMED → PREPARING)
7. ✅ Order status auto-updates when all items ready (PREPARING → READY)

**Broadcast Targets**:
- **Kitchen Staff**: Receive updates via `restaurant_{restaurantId}` room
- **Customers**: Receive updates via `customer_{customerId}` room and order subscriptions
- **All Subscribed Clients**: Receive updates via order-specific subscriptions
- **Real-time**: All status changes broadcasted instantly to all relevant parties

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["Validation failed: email must be an email"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Resource already exists",
  "error": "Conflict"
}
```

## Data Models Summary

### Enums Reference

**Order Status** (Order-level):
- `pending` - Order created, waiting for confirmation
- `confirmed` - Order confirmed by staff/waiter
- `preparing` - Order being prepared in kitchen (auto-set when items start)
- `ready` - Order ready for pickup/delivery (all items ready)
- `served` - Order served to customer
- `completed` - Order completed
- `cancelled` - Order cancelled

**Order Item Status** (Item-level):
- `pending` - Order item created, awaiting kitchen
- `in_progress` - Kitchen started preparing (sets `startedAt`)
- `ready` - Order item ready (sets `readyAt`)
- `served` - Order item served to customer (sets `servedAt`)

**Payment Status**:
- `pending` - Payment not processed
- `paid` - Payment completed
- `failed` - Payment failed
- `refunded` - Payment refunded

**Payment Methods**:
- `cash` - Cash payment
- `card_online` - Online card payment
- `card_counter` - Card payment at counter
- `digital_wallet` - Digital wallet payment

**Tenant Types**:
- `restaurant` - Restaurant tenant
- `food_court` - Food court tenant

**Tenant Status**:
- `active` - Tenant is active
- `inactive` - Tenant is inactive
- `suspended` - Tenant is suspended

**User Roles**:
- `super_admin` - Platform administrator
- `tenant_admin` - Tenant administrator
- `manager` - Manager
- `waiter` - Waiter/Service staff
- `kitchen_staff` - Kitchen staff

**User Status**:
- `active` - User is active
- `inactive` - User is inactive
- `suspended` - User is suspended

**QR Code Type**:
- `TABLE` - Restaurant table QR code
- `FOOD_COURT` - Food court QR code
- `TAKE_AWAY` - Takeaway QR code

**QR Code Status**:
- `active` - QR code is active
- `inactive` - QR code is inactive

## File Upload Implementation Status

### Current Implementation
- **File Upload**: Not yet implemented (S3 upload not found in codebase)
- **Logo/Image Fields**: Currently accept URL strings (`logo`, `imageUrl`, `logoUrl`)
- **Workaround**: Upload files separately (via external service/CDN) and provide the URL

### Recommended Implementation
To enable S3 file uploads, you would need to:

1. **Install AWS SDK**:
   ```bash
   npm install @aws-sdk/client-s3
   ```

2. **Add Environment Variables** (to `.env`):
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_S3_BUCKET_NAME=your-bucket-name
   ```

3. **Create File Upload Service**:
   - Create `FileUploadService` using AWS S3 SDK
   - Implement file validation (size, type)
   - Generate unique file names
   - Return public S3 URLs

4. **Add Upload Endpoints**:
   ```http
   POST /upload/logo
   POST /upload/image
   Content-Type: multipart/form-data
   ```

### Current Logo/Image Usage
All endpoints accept logo/image as URL strings:
- Outlet/Restaurant: `logo` field (string URL)
- Legacy Restaurant: `logoUrl`, `imageUrl` fields (string URLs)
- QR Code: `imageUrl` field (string URL) - optional metadata field
- Menu Items: `imageUrl` field (string URL) - required field

## Security Features

### Multi-Tenant Isolation
- **Tenant Middleware**: Automatically extracts and validates tenant context
- **Tenant Guard**: Ensures users can only access their tenant's resources
- **Subdomain Support**: Automatic tenant resolution from subdomain

### Role-Based Access Control (RBAC)
- **JWT Authentication**: All protected endpoints require valid JWT token
- **Role Guards**: Enforce role-based permissions at endpoint level
- **Hierarchical Permissions**: Role hierarchy system for access control

### JWT Token Security
- **Access Tokens**: Short-lived (15 minutes) for API requests
- **Refresh Tokens**: Long-lived (7 days) for token renewal
- **Token Rotation**: Refresh tokens are rotated on each use

## Rate Limiting
API requests are rate-limited to prevent abuse:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

## Pagination
**All GET list endpoints now support pagination** using standard query parameters.

### Pagination Parameters
- `page` (number, optional): Page number (default: 1, min: 1)
- `limit` (number, optional): Number of items per page (default: 10, min: 1, max: 100)

### Pagination Response Format
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15
}
```

### Example Usage
```http
GET /tenants?page=1&limit=10
GET /users?page=1&limit=10
GET /tenants/{tenantId}/users?page=2&limit=20
GET /tenants/{tenantId}/outlets?page=1&limit=5
GET /qr-codes?page=1&limit=10
```

### Endpoints with Pagination
- ✅ GET /tenants
- ✅ GET /users (SUPER_ADMIN only - all users across all tenants)
- ✅ GET /tenants/{tenantId}/users
- ✅ GET /tenants/{tenantId}/outlets
- ✅ GET /qr-codes
- ✅ GET /orders (existing)
- ✅ GET /menus (with pagination, search, sorting, and filtering support)

**Note**: Category endpoints may use different response formats (Result wrapper) and will be updated in a future release.

## Filtering, Sorting, and Search

### Overview
The API supports comprehensive filtering, sorting, and search capabilities for main resource endpoints. These features allow you to:
- **Search**: Find records by matching text across multiple fields
- **Sort**: Order results by any supported field in ascending or descending order
- **Filter**: Narrow down results by specific field values
- **Paginate**: Control the number of results per page

### Common Query Parameters

All enhanced endpoints support the following base parameters:

- `page` (number, optional): Page number (default: 1, min: 1)
- `limit` (number, optional): Items per page (default: 10, min: 1, max: 100)
- `search` (string, optional): Search term (case-insensitive, searches across multiple fields)
- `sortBy` (string, optional): Field to sort by (default: `createdAt`)
- `sortOrder` (enum, optional): Sort direction - `ASC` or `DESC` (default: `DESC`)

### Endpoints with Enhanced Filtering, Sorting, and Search

#### 1. Get All Restaurants
**Endpoint**: `GET /restaurants`

**Searchable Fields**: `name`, `address`, `contactEmail`, `contactPhoneNumber`

**Sortable Fields**: `name`, `address`, `contactEmail`, `contactPhoneNumber`, `createdAt`, `updatedAt`

**Filterable Fields**: `tenantId`

**Example**:
```http
GET /restaurants?search=pizza&tenantId=xxx&sortBy=name&sortOrder=ASC&page=1&limit=10
```

#### 2. Get All Tenants
**Endpoint**: `GET /tenants`

**Searchable Fields**: `name`, `subdomain`, `contactEmail`, `description`

**Sortable Fields**: `name`, `subdomain`, `status`, `type`, `subscriptionPlan`, `createdAt`, `updatedAt`

**Filterable Fields**: `status`, `type`, `subscriptionPlan`

**Example**:
```http
GET /tenants?search=restaurant&status=active&type=restaurant&sortBy=name&sortOrder=ASC&page=1&limit=10
```

#### 3. Get All Users (Super Admin)
**Endpoint**: `GET /users`

**Searchable Fields**: `name`, `email`, `phoneNumber`

**Sortable Fields**: `name`, `email`, `phoneNumber`, `role`, `status`, `createdAt`, `updatedAt`, `lastLoginAt`

**Filterable Fields**: `role`, `status` (default: `active` only), `tenantId`, `restaurantId`

**Example**:
```http
GET /users?search=john&role=manager&status=active&sortBy=name&sortOrder=ASC&page=1&limit=10
```

#### 4. Get All Users (by Tenant)
**Endpoint**: `GET /tenants/{tenantId}/users`

**Searchable Fields**: `name`, `email`, `phoneNumber`

**Sortable Fields**: `name`, `email`, `phoneNumber`, `role`, `status`, `createdAt`, `updatedAt`, `lastLoginAt`

**Filterable Fields**: `role`, `status` (default: `active` only), `restaurantId` (tenantId is automatically applied from URL)

**Example**:
```http
GET /tenants/{tenantId}/users?search=john&role=waiter&status=active&sortBy=name&sortOrder=ASC&page=1&limit=10
```

#### 5. Get All Orders
**Endpoint**: `GET /orders`

**Note**: Orders endpoint has existing filtering but uses different parameter names.

**Example**:
```http
GET /orders?restaurantId=xxx&status=pending&paymentStatus=paid&date=2025-01-11
```

### Search Behavior

- **Case-Insensitive**: All searches are case-insensitive
- **Partial Matching**: Searches match partial text (e.g., "pizza" matches "Pizza Palace")
- **Multi-Field**: Search term is checked against multiple fields simultaneously
- **OR Logic**: Results match if any of the searchable fields contain the search term

### Sorting Behavior

- **Default Sort**: If `sortBy` is not specified, results are sorted by `createdAt` in descending order
- **Invalid Fields**: If an invalid `sortBy` field is provided, it defaults to `createdAt`
- **Combined with Filters**: Sorting works seamlessly with filters and search

### Filtering Behavior

- **Exact Match**: Filters use exact matching (e.g., `status=active` matches only `active` status)
- **Enum Values**: Filter values must match valid enum values for the field
- **Multiple Filters**: Multiple filters can be combined (AND logic)
- **Combined with Search**: Filters work in conjunction with search terms (AND logic)

### Backward Compatibility

All enhanced endpoints maintain backward compatibility:
- If no enhanced parameters are provided, endpoints return results in the original format
- Enhanced parameters are all optional
- Existing API consumers continue to work without changes

### Notes

- **Menu endpoints**: ✅ Now support pagination, search, sorting, and filtering. See [Menu Management](#menu-management) section for details.
- **Category endpoints**: Filtering and sorting are not yet implemented. Currently, these endpoints return all records without filtering.
- **Performance**: Search and filtering are optimized using database indexes. Large result sets should use pagination.
- **Validation**: Invalid enum values for filters will be ignored (no error, just no results)

## Support
For API support and questions:
- Check this documentation
- Review the codebase repository
- Contact the development team

---

## Payment Processing - Complete Flow

### Overview

The DineFlow platform supports two payment timing models:
1. **Pay at First**: Payment required before order goes to kitchen
2. **Pay at Last**: Payment after food is served

Both models are now fully integrated with the customer portal for self-service payments.

---

### Payment Timing Models

#### Model 1: Pay at First (Pre-Payment)

**Business Model**: Customer pays before order is processed (fast food, cafes, etc.)

**Order Flow**:
```
1. CREATE ORDER    → Status: PENDING ⏳ (waiting for payment)
2. PROCESS PAYMENT → Status: CONFIRMED ✅ (sent to kitchen)
3. PREPARE FOOD    → Status: PREPARING
4. READY FOR PICKUP → Status: READY
5. SERVE FOOD      → Status: SERVED
6. COMPLETE        → Status: COMPLETED (marked by staff)
```

**Payment Endpoint**:
```http
POST /api/customer-portal/order/:orderId/payment?phone={phoneNumber}
Content-Type: application/json

{
  "paymentMethod": "card",
  "amount": 25.99
}
```

**Response**:
```json
{
  "success": true,
  "payment": {
    "id": "payment-uuid",
    "orderId": "order-uuid",
    "method": "card",
    "amount": 25.99,
    "status": "paid",
    "createdAt": "2025-12-04T12:00:00Z"
  },
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-001",
    "totalAmount": 25.99,
    "status": "confirmed"  // ✅ Changed from PENDING to CONFIRMED
  }
}
```

---

#### Model 2: Pay at Last (Post-Service Payment)

**Business Model**: Customer pays after dining (restaurants, full-service establishments)

**Order Flow**:
```
1. CREATE ORDER    → Status: CONFIRMED ✅ (immediately sent to kitchen)
2. PREPARE FOOD    → Status: PREPARING
3. READY FOR PICKUP → Status: READY
4. SERVE FOOD      → Status: SERVED 🍽️
5. PROCESS PAYMENT → Status: COMPLETED ✅ (order finished, table released)
```

**Payment Endpoint** (same as pay at first):
```http
POST /api/customer-portal/order/:orderId/payment?phone={phoneNumber}
Content-Type: application/json

{
  "paymentMethod": "card",
  "amount": 30.50
}
```

**Response**:
```json
{
  "success": true,
  "payment": {
    "id": "payment-uuid",
    "orderId": "order-uuid",
    "method": "card",
    "amount": 30.50,
    "status": "paid",
    "createdAt": "2025-12-04T13:30:00Z"
  },
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-002",
    "totalAmount": 30.50,
    "status": "completed"  // ✅ Changed from SERVED to COMPLETED
  }
}
```

**Additional Behavior**:
- ✅ Table automatically released (if applicable)
- ✅ Only releases table if no other active orders on same table
- ✅ Order usage recorded for subscription tracking

---

### Payment Methods Supported

```typescript
enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  QR = 'qr',
  CASHIER = 'cashier'
}
```

All payment methods trigger the same automatic status updates.

---

### Payment Status Updates

#### Pay at First: PENDING → CONFIRMED

**Trigger**: Payment processed for order in `PENDING` status

**Actions**:
1. Payment record created with `PAID` status
2. Order status updated from `PENDING` to `CONFIRMED`
3. Order sent to kitchen for preparation
4. Kitchen staff notified (via WebSocket)

**Code Reference**: [customer-portal.service.ts:750-754](src/customer-portal/customer-portal.service.ts#L750-L754)

---

#### Pay at Last: SERVED → COMPLETED

**Trigger**: Payment processed for order in `SERVED` status

**Actions**:
1. Payment record created with `PAID` status
2. Order status updated from `SERVED` to `COMPLETED`
3. Check for other active orders on the same table
4. If no other active orders → Table status changed to `AVAILABLE`
5. If other active orders exist → Table remains `OCCUPIED`

**Code Reference**: [customer-portal.service.ts:756-786](src/customer-portal/customer-portal.service.ts#L756-L786)

---

### Table Release Logic

When a "pay at last" order is completed via payment:

```sql
-- Check for other active orders on the same table
SELECT COUNT(*) FROM orders 
WHERE tableId = :tableId 
  AND id != :currentOrderId
  AND status NOT IN ('cancelled', 'completed')

-- If count = 0, release table
UPDATE tables SET status = 'available' WHERE id = :tableId
```

**Table Status Enum**:
```typescript
enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance'
}
```

---

### Customer Portal Integration

#### Scenario 1: Pay at First Restaurant

```javascript
// Step 1: Create order
const createOrderResponse = await fetch('/api/customer-portal/order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    restaurantId: 'restaurant-uuid',
    phone: '+1234567890',
    customerName: 'John Doe',
    orderItems: [
      { menuId: 'menu-uuid-1', quantity: 2 },
      { menuId: 'menu-uuid-2', quantity: 1 }
    ]
  })
});

const order = await createOrderResponse.json();
console.log(order.status); // "pending"

// Step 2: Show payment screen (required before kitchen gets order)
// Customer MUST pay to proceed

// Step 3: Process payment
const paymentResponse = await fetch(
  `/api/customer-portal/order/${order.id}/payment?phone=${order.customer.phone}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentMethod: 'card',
      amount: order.totalAmount
    })
  }
);

const paymentResult = await paymentResponse.json();
console.log(paymentResult.order.status); // "confirmed" ✅
console.log(paymentResult.success); // true

// UI Flow:
// 1. Show "Payment Required" screen
// 2. Process payment
// 3. Show "Order Confirmed - Kitchen is preparing your order"
```

---

#### Scenario 2: Pay at Last Restaurant

```javascript
// Step 1: Create order
const createOrderResponse = await fetch('/api/customer-portal/order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    restaurantId: 'restaurant-uuid',
    phone: '+1234567890',
    customerName: 'Jane Smith',
    tableId: 'table-uuid',
    orderItems: [
      { menuId: 'menu-uuid-1', quantity: 1 }
    ]
  })
});

const order = await createOrderResponse.json();
console.log(order.status); // "confirmed" ✅ (immediately sent to kitchen!)

// Step 2: Customer eats meal
// Staff updates order: CONFIRMED → PREPARING → READY → SERVED

// Step 3: Fetch orders that need payment
const ordersResponse = await fetch(
  `/api/customer-portal/orders?phone=+1234567890`
);
const { data: orders } = await ordersResponse.json();

// Filter orders that are served but not paid
const unpaidOrders = orders.filter(o => 
  o.status === 'served' && o.paymentStatus !== 'paid'
);

// Step 4: Customer clicks "Pay Now" on served order
if (unpaidOrders.length > 0) {
  const orderToPay = unpaidOrders[0];
  
  const paymentResponse = await fetch(
    `/api/customer-portal/order/${orderToPay.id}/payment?phone=${orderToPay.customer.phone}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'card',
        amount: orderToPay.totalAmount
      })
    }
  );

  const paymentResult = await paymentResponse.json();
  console.log(paymentResult.order.status); // "completed" ✅
  console.log(paymentResult.success); // true
  
  // UI Flow:
  // 1. Show "Meal Completed - Ready to Pay" screen
  // 2. Display order summary and total
  // 3. Process payment
  // 4. Show "Thank you! Payment Successful" message
  // 5. Customer can leave (table automatically released)
}
```

---

### Get Order Details

**Endpoint**: `GET /api/customer-portal/order/:orderId?phone={phoneNumber}`

**Description**: Retrieve order details to check payment status and order status.

**Example Request**:
```http
GET /api/customer-portal/order/order-uuid?phone=+1234567890
```

**Response**:
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD-001",
  "status": "served",
  "totalAmount": 45.99,
  "paymentMethod": null,
  "paymentStatus": null,
  "customer": {
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Restaurant Name",
    "paymentTiming": "pay_at_last"
  },
  "orderItems": [
    {
      "menuName": "Burger",
      "quantity": 2,
      "unitPrice": 12.99,
      "totalPrice": 25.98
    }
  ],
  "createdAt": "2025-12-04T12:00:00Z"
}
```

**Use Case**: 
- Check if order needs payment (`status: "served"` + `paymentStatus: null`)
- Display order details before payment
- Show payment button conditionally

---

### Get Customer Orders

**Endpoint**: `GET /api/customer-portal/orders?phone={phoneNumber}&page={page}&limit={limit}`

**Description**: Retrieve all orders for a customer (with pagination).

**Query Parameters**:
- `phone` (required): Customer phone number
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Example Request**:
```http
GET /api/customer-portal/orders?phone=+1234567890&page=1&limit=10
```

**Response**:
```json
{
  "data": [
    {
      "id": "order-uuid-1",
      "orderNumber": "ORD-001",
      "status": "served",
      "totalAmount": 45.99,
      "paymentMethod": null,
      "paymentStatus": null,
      "restaurant": {
        "name": "Restaurant ABC",
        "paymentTiming": "pay_at_last"
      },
      "createdAt": "2025-12-04T12:00:00Z"
    },
    {
      "id": "order-uuid-2",
      "orderNumber": "ORD-002",
      "status": "completed",
      "totalAmount": 30.50,
      "paymentMethod": "card",
      "paymentStatus": "paid",
      "restaurant": {
        "name": "Restaurant XYZ",
        "paymentTiming": "pay_at_first"
      },
      "createdAt": "2025-12-03T18:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 10,
  "totalPages": 2
}
```

**Frontend Logic**:
```javascript
// Filter orders that need payment
const needsPayment = (order) => {
  return order.status === 'served' && !order.paymentStatus;
};

// Display "Pay Now" button for these orders
orders.data.filter(needsPayment).forEach(order => {
  console.log(`Order ${order.orderNumber} needs payment: $${order.totalAmount}`);
});
```

---

### Payment Validation

#### Pre-Payment Checks

1. **Customer Verification**: Phone number must match order's customer
2. **Amount Validation**: Payment amount must match order total exactly
3. **Payment Method**: Must be valid enum value (`cash`, `card`, `qr`, `cashier`)
4. **Order Status**: Order must be in appropriate status for payment

#### Error Responses

**Customer Not Found** (404):
```json
{
  "statusCode": 404,
  "message": "Customer not found",
  "error": "Not Found"
}
```

**Order Not Found** (404):
```json
{
  "statusCode": 404,
  "message": "Order not found or does not belong to this customer",
  "error": "Not Found"
}
```

**Amount Mismatch** (400):
```json
{
  "statusCode": 400,
  "message": "Payment amount (25.00) does not match order total (30.50)",
  "error": "Bad Request"
}
```

**Invalid Payment Method** (400):
```json
{
  "statusCode": 400,
  "message": "Invalid payment method. Must be one of: cash, card, qr, cashier",
  "error": "Bad Request"
}
```

---

### Complete Status Flow Comparison

#### Pay at First Restaurant

```
┌──────────────┐
│ CREATE ORDER │
└──────┬───────┘
       │
       v
┌─────────────┐       ┌─────────────────┐
│   PENDING   │ ───>  │ PROCESS PAYMENT │
└─────────────┘       └────────┬────────┘
      ⏳                        │
                               v
                      ┌─────────────┐
                      │  CONFIRMED  │
                      └──────┬──────┘
                             │
                             v
                      ┌─────────────┐
                      │  PREPARING  │
                      └──────┬──────┘
                             │
                             v
                      ┌─────────────┐
                      │    READY    │
                      └──────┬──────┘
                             │
                             v
                      ┌─────────────┐
                      │   SERVED    │
                      └──────┬──────┘
                             │
                             v
                      ┌─────────────┐
                      │  COMPLETED  │
                      └─────────────┘
```

#### Pay at Last Restaurant

```
┌──────────────┐
│ CREATE ORDER │
└──────┬───────┘
       │
       v
┌─────────────┐
│  CONFIRMED  │ (immediate)
└──────┬──────┘
       │
       v
┌─────────────┐
│  PREPARING  │
└──────┬──────┘
       │
       v
┌─────────────┐
│    READY    │
└──────┬──────┘
       │
       v
┌─────────────┐       ┌─────────────────┐
│   SERVED    │ ───>  │ PROCESS PAYMENT │
└─────────────┘       └────────┬────────┘
      🍽️                        │
                               v
                      ┌─────────────┐
                      │  COMPLETED  │
                      └─────────────┘
                             ✅
                      (Table Released)
```

---

### Best Practices for Frontend Integration

#### 1. Check Restaurant Payment Timing

```javascript
// Fetch QR code info to get payment timing
const qrResponse = await fetch(`/api/customer-portal/qr/${qrCodeId}`);
const { restaurant } = await qrResponse.json();

if (restaurant.paymentTiming === 'pay_at_first') {
  // Show payment screen immediately after order creation
  // Block order submission until payment is complete
} else {
  // Allow order submission without payment
  // Show "pay later" messaging
}
```

#### 2. Display Payment Status

```javascript
const getPaymentButtonText = (order) => {
  if (order.status === 'pending') {
    return 'Pay Now to Confirm Order';
  } else if (order.status === 'served' && !order.paymentStatus) {
    return 'Pay Bill';
  } else if (order.paymentStatus === 'paid') {
    return 'Paid ✓';
  }
  return null; // No payment button needed
};
```

#### 3. Handle Payment Errors Gracefully

```javascript
const processPayment = async (orderId, amount, phone) => {
  try {
    const response = await fetch(
      `/api/customer-portal/order/${orderId}/payment?phone=${phone}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'card',
          amount: amount
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('Payment failed:', error.message);
    // Show user-friendly error message
    alert(`Payment failed: ${error.message}`);
    return null;
  }
};
```

#### 4. Real-Time Order Updates

```javascript
// Poll for order status updates (or use WebSocket)
const pollOrderStatus = async (orderId, phone) => {
  const response = await fetch(
    `/api/customer-portal/order/${orderId}?phone=${phone}`
  );
  const order = await response.json();
  
  // Update UI based on status
  if (order.status === 'confirmed') {
    showMessage('Order confirmed! Kitchen is preparing your food.');
  } else if (order.status === 'ready') {
    showMessage('Your order is ready for pickup!');
  } else if (order.status === 'served') {
    if (order.restaurant.paymentTiming === 'pay_at_last') {
      showPaymentButton(order);
    }
  }
};
```

---

### Summary Table

| Payment Timing | Order Created | Payment Time | After Payment | Table Release |
|---------------|---------------|--------------|---------------|---------------|
| **Pay at First** | `PENDING` | Before kitchen | → `CONFIRMED` | Staff marks complete |
| **Pay at Last** | `CONFIRMED` | After served | → `COMPLETED` | Automatic on payment |

---

### Related Endpoints

- [Create Order](#create-order-from-customer-portal) - Initial order creation
- [Get QR Code Info](#get-qr-code-information) - Check restaurant payment timing
- [Get Order Details](#get-order-details) - Fetch order status
- [Get Customer Orders](#get-customer-orders) - List all customer orders

---

---

## Super Admin Dashboard & Analytics

**SUPER ADMIN ONLY** - These endpoints provide comprehensive business intelligence, multi-restaurant management, and growth analytics for platform administrators.

**Base Path**: `/api/super-admin/dashboard`  
**Authentication**: **JWT Required (SUPER_ADMIN role only)**  
**All Data**: **COMPLETED orders only** (paid orders)

---

### Quick Reference

| Endpoint | Purpose | Key Metrics |
|----------|---------|-------------|
| `GET /overview` | Platform-wide overview | Total revenue, restaurants, customers, growth |
| `GET /restaurant-performance` | Compare all restaurants | Rankings, performance scores, revenue |
| `GET /revenue-trends` | Revenue over time | Trends with custom granularity |
| `GET /customer-analytics` | Customer insights | Lifetime value, retention, segments |
| `GET /menu-performance` | Best/worst items | Top sellers across all restaurants |
| `GET /payment-insights` | Payment preferences | Method distribution and trends |
| `GET /business-health` | Platform health score | Overall health with recommendations |
| `GET /growth-opportunities` | Expansion opportunities | Underperforming areas, inactive customers |

---

### 1. Super Admin Overview

```http
GET /super-admin/dashboard/overview?period={period}
Authorization: Bearer {super-admin-token}
```

**Purpose**: High-level metrics across all restaurants

**Query Parameters**:
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `period` | enum | `today` | `today`, `week`, `month`, `year` |

**Response**:
```json
{
  "period": "today",
  "dateRange": {
    "startDate": "2025-12-16T00:00:00.000Z",
    "endDate": "2025-12-16T23:59:59.999Z"
  },
  "overview": {
    "totalRestaurants": 25,
    "activeRestaurants": 23,
    "inactiveRestaurants": 2,
    "totalRevenue": 450000.00,
    "revenueGrowth": 15.5,
    "totalOrders": 1500,
    "orderGrowth": 12.3,
    "averageOrderValue": 300.00,
    "totalCustomers": 5000,
    "newCustomers": 150
  }
}
```

**Business Use**:
- Track overall platform growth
- Monitor restaurant activation
- Identify revenue trends
- Track customer acquisition

**Examples**:
```bash
# Today's overview
GET /super-admin/dashboard/overview?period=today

# This week
GET /super-admin/dashboard/overview?period=week

# This month
GET /super-admin/dashboard/overview?period=month

# This year
GET /super-admin/dashboard/overview?period=year
```

---

### 2. Restaurant Performance Comparison

```http
GET /super-admin/dashboard/restaurant-performance?period={period}
Authorization: Bearer {super-admin-token}
```

**Purpose**: Compare all restaurants side-by-side with rankings

**Query Parameters**:
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `period` | enum | `week` | `today`, `week`, `month`, `year` |

**Response**:
```json
{
  "period": "week",
  "dateRange": {
    "startDate": "2025-12-09T00:00:00.000Z",
    "endDate": "2025-12-16T23:59:59.999Z"
  },
  "restaurants": [
    {
      "rank": 1,
      "restaurantId": "uuid-1",
      "restaurantName": "Pizza Palace",
      "revenue": 125000.00,
      "orders": 450,
      "averageOrderValue": 277.78,
      "itemsSold": 1350,
      "uniqueCustomers": 320,
      "revenuePerCustomer": 390.63,
      "performanceScore": 95.5
    },
    {
      "rank": 2,
      "restaurantName": "Burger House",
      "revenue": 98000.00,
      "performanceScore": 82.3
    }
  ],
  "summary": {
    "totalRestaurants": 23,
    "totalRevenue": 450000.00,
    "totalOrders": 1500,
    "averageRevenuePerRestaurant": 19565.22
  }
}
```

**Business Use**:
- Identify top performers
- Find underperforming restaurants
- Benchmark performance
- Allocate resources effectively

**Key Metrics**:
- **Performance Score**: 0-100 score based on revenue and orders
- **Revenue Per Customer**: Customer value indicator
- **Rank**: Position among all restaurants

---

### 3. Revenue Trends

```http
GET /super-admin/dashboard/revenue-trends?period={period}&granularity={granularity}&restaurantId={id}
Authorization: Bearer {super-admin-token}
```

**Purpose**: Track revenue over time with customizable granularity

**Query Parameters**:
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `period` | enum | `month` | `week`, `month`, `quarter`, `year` |
| `granularity` | enum | `daily` | `hourly`, `daily`, `weekly`, `monthly` |
| `restaurantId` | UUID | All | Specific restaurant ID |

**Response**:
```json
{
  "period": "month",
  "granularity": "daily",
  "dateRange": {
    "startDate": "2025-11-16T00:00:00.000Z",
    "endDate": "2025-12-16T23:59:59.999Z"
  },
  "trends": [
    {
      "period": "2025-12-01",
      "revenue": 15000.00,
      "orders": 50
    },
    {
      "period": "2025-12-02",
      "revenue": 18000.00,
      "orders": 60
    }
  ],
  "summary": {
    "totalRevenue": 450000.00,
    "totalOrders": 1500,
    "averageRevenue": 15000.00,
    "peakPeriod": {
      "period": "2025-12-15",
      "revenue": 25000.00,
      "orders": 85
    }
  }
}
```

**Business Use**:
- Identify revenue patterns
- Forecast future revenue
- Spot seasonal trends
- Plan marketing campaigns

**Granularity Options**:
- **Hourly**: Best for today/week analysis
- **Daily**: Best for month/quarter analysis
- **Weekly**: Best for quarter/year analysis
- **Monthly**: Best for year+ analysis

---

### 4. Customer Analytics

```http
GET /super-admin/dashboard/customer-analytics?period={period}
Authorization: Bearer {super-admin-token}
```

**Purpose**: Deep insights into customer behavior and lifetime value

**Query Parameters**:
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `period` | enum | `month` | `week`, `month`, `quarter`, `year` |

**Response**:
```json
{
  "period": "month",
  "dateRange": {
    "startDate": "2025-11-16T00:00:00.000Z",
    "endDate": "2025-12-16T23:59:59.999Z"
  },
  "summary": {
    "totalCustomers": 5000,
    "activeCustomers": 1200,
    "newCustomers": 150,
    "returningCustomers": 1050,
    "retentionRate": 87.5,
    "averageCustomerLifetimeValue": 4500.00
  },
  "topCustomers": [
    {
      "customerId": "uuid-1",
      "customerName": "John Doe",
      "customerPhone": "+94771234567",
      "totalOrders": 45,
      "totalSpent": 13500.00,
      "averageOrderValue": 300.00,
      "firstOrderDate": "2025-01-15T10:00:00.000Z",
      "lastOrderDate": "2025-12-15T18:00:00.000Z",
      "customerLifetimeValue": 15000.00
    }
  ],
  "segments": {
    "highValue": 250,
    "mediumValue": 800,
    "lowValue": 3950
  }
}
```

**Business Use**:
- Identify VIP customers
- Calculate customer lifetime value
- Measure retention rate
- Segment customers for marketing

**Customer Segments**:
- **High Value**: LKR 10,000+ lifetime value
- **Medium Value**: LKR 5,000-10,000 lifetime value
- **Low Value**: < LKR 5,000 lifetime value

---

### 5. Menu Performance

```http
GET /super-admin/dashboard/menu-performance?period={period}&limit={limit}
Authorization: Bearer {super-admin-token}
```

**Purpose**: Identify best and worst performing menu items across all restaurants

**Query Parameters**:
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `period` | enum | `month` | `week`, `month`, `quarter` |
| `limit` | number | `20` | Number of top/bottom items |

**Response**:
```json
{
  "period": "month",
  "dateRange": {
    "startDate": "2025-11-16T00:00:00.000Z",
    "endDate": "2025-12-16T23:59:59.999Z"
  },
  "topPerformers": [
    {
      "menuId": "uuid-1",
      "menuName": "Chicken Biryani",
      "restaurantName": "Spice Garden",
      "categoryName": "Main Course",
      "quantity": 850,
      "revenue": 127500.00,
      "orders": 450,
      "averagePrice": 150.00
    }
  ],
  "lowPerformers": [
    {
      "menuName": "Salad Bowl",
      "quantity": 15,
      "revenue": 750.00
    }
  ],
  "summary": {
    "totalItems": 450,
    "totalRevenue": 450000.00,
    "totalQuantitySold": 15000
  }
}
```

**Business Use**:
- Identify trending items
- Remove underperforming items
- Optimize menu offerings
- Cross-sell popular items

---

### 6. Payment Insights

```http
GET /super-admin/dashboard/payment-insights?period={period}
Authorization: Bearer {super-admin-token}
```

**Purpose**: Analyze payment preferences and trends

**Query Parameters**:
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `period` | enum | `month` | `week`, `month`, `quarter`, `year` |

**Response**:
```json
{
  "period": "month",
  "dateRange": {
    "startDate": "2025-11-16T00:00:00.000Z",
    "endDate": "2025-12-16T23:59:59.999Z"
  },
  "paymentMethods": [
    {
      "method": "cashier",
      "count": 850,
      "revenue": 255000.00,
      "percentage": 56.67,
      "restaurantCount": 20,
      "averageTransactionValue": 300.00
    },
    {
      "method": "cash",
      "count": 450,
      "revenue": 135000.00,
      "percentage": 30.00,
      "restaurantCount": 23,
      "averageTransactionValue": 300.00
    },
    {
      "method": "card",
      "count": 200,
      "revenue": 60000.00,
      "percentage": 13.33,
      "restaurantCount": 15,
      "averageTransactionValue": 300.00
    }
  ],
  "summary": {
    "totalRevenue": 450000.00,
    "totalTransactions": 1500,
    "mostPopularMethod": "cashier"
  }
}
```

**Business Use**:
- Understand payment preferences
- Optimize payment options
- Reduce transaction costs
- Improve checkout experience

---

### 7. Business Health Score

```http
GET /super-admin/dashboard/business-health
Authorization: Bearer {super-admin-token}
```

**Purpose**: Overall health metrics for the platform with actionable recommendations

**Response**:
```json
{
  "overallScore": 78.5,
  "breakdown": {
    "restaurantActivity": {
      "score": 92.0,
      "activeRestaurants": 23,
      "totalRestaurants": 25
    },
    "customerEngagement": {
      "score": 75.0,
      "activeCustomers": 3750,
      "totalCustomers": 5000
    },
    "orderVolume": {
      "score": 68.5,
      "recentOrders": 685,
      "target": 1000
    }
  },
  "recommendations": [
    "Focus on increasing order volume through promotions and marketing",
    "Launch customer retention and re-engagement campaigns"
  ]
}
```

**Business Use**:
- Monitor platform health
- Get actionable recommendations
- Track key performance indicators
- Identify areas for improvement

**Health Score Breakdown**:
- **Restaurant Activity** (30%): Active vs total restaurants
- **Customer Engagement** (40%): Active vs total customers
- **Order Volume** (30%): Recent orders vs target

**Score Interpretation**:
- **90-100**: Excellent - Platform is thriving
- **70-89**: Good - Minor improvements needed
- **50-69**: Fair - Significant improvements needed
- **< 50**: Poor - Urgent action required

---

### 8. Growth Opportunities

```http
GET /super-admin/dashboard/growth-opportunities
Authorization: Bearer {super-admin-token}
```

**Purpose**: Identify underperforming restaurants, inactive customers, and expansion opportunities

**Response**:
```json
{
  "opportunities": {
    "underperformingRestaurants": [
      {
        "restaurantId": "uuid-1",
        "restaurantName": "Cafe Corner",
        "thisMonthOrders": 5,
        "lastMonthOrders": 25,
        "growth": -80.0
      }
    ],
    "inactiveCustomers": 1250,
    "potentialRevenueLoss": 375000.00
  },
  "recommendations": [
    "Focus on marketing for underperforming restaurants",
    "Launch re-engagement campaign for inactive customers",
    "Consider loyalty programs to increase customer retention"
  ]
}
```

**Business Use**:
- Identify struggling restaurants
- Re-engage inactive customers
- Calculate revenue opportunities
- Prioritize growth initiatives

**Key Metrics**:
- **Underperforming Restaurants**: Negative growth or < 10 orders/month
- **Inactive Customers**: No orders in 30+ days
- **Potential Revenue Loss**: Inactive customers × average order value

---

## Super Admin Use Cases

### 1. Daily Platform Monitoring

```bash
# Morning routine - Check today's performance
GET /super-admin/dashboard/overview?period=today

# Check restaurant rankings
GET /super-admin/dashboard/restaurant-performance?period=today

# Monitor business health
GET /super-admin/dashboard/business-health
```

### 2. Weekly Business Review

```bash
# Week's revenue trends
GET /super-admin/dashboard/revenue-trends?period=week&granularity=daily

# Customer analytics
GET /super-admin/dashboard/customer-analytics?period=week

# Payment insights
GET /super-admin/dashboard/payment-insights?period=week
```

### 3. Monthly Strategy Planning

```bash
# Month's overview
GET /super-admin/dashboard/overview?period=month

# Restaurant performance comparison
GET /super-admin/dashboard/restaurant-performance?period=month

# Menu performance analysis
GET /super-admin/dashboard/menu-performance?period=month&limit=50

# Growth opportunities
GET /super-admin/dashboard/growth-opportunities
```

### 4. Quarterly Business Review

```bash
# Quarter revenue trends
GET /super-admin/dashboard/revenue-trends?period=quarter&granularity=weekly

# Customer lifetime value
GET /super-admin/dashboard/customer-analytics?period=quarter

# Payment trends
GET /super-admin/dashboard/payment-insights?period=quarter
```

---

## Business Intelligence Insights

### Revenue Optimization

**Identify Peak Periods**:
```bash
GET /super-admin/dashboard/revenue-trends?period=month&granularity=hourly
```
→ Schedule promotions during slow hours

**Top Performers**:
```bash
GET /super-admin/dashboard/restaurant-performance?period=month
```
→ Replicate success strategies

### Customer Retention

**Retention Rate**:
```bash
GET /super-admin/dashboard/customer-analytics?period=month
```
→ Launch loyalty programs if < 70%

**Inactive Customers**:
```bash
GET /super-admin/dashboard/growth-opportunities
```
→ Re-engagement campaigns

### Menu Optimization

**Best Sellers**:
```bash
GET /super-admin/dashboard/menu-performance?period=month&limit=20
```
→ Promote top items, remove low performers

### Payment Strategy

**Payment Preferences**:
```bash
GET /super-admin/dashboard/payment-insights?period=month
```
→ Optimize payment options, reduce costs

---

## Error Responses

### Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Forbidden (Non-Super Admin)
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

---

**Last Updated**: 2025-12-16  
**Version**: 1.0

---

## S3 Image Upload & Management

**Secure image storage for restaurants, menus, and categories using AWS S3**

**Base Path**: `/api/upload`  
**Authentication**: **JWT Required**  
**Roles**: SUPER_ADMIN, TENANT_ADMIN, MANAGER

---

### Features

✅ **Secure S3 Storage** - Images stored in AWS S3 with encryption  
✅ **Automatic Validation** - File type, size, and format validation  
✅ **Signed URLs** - Temporary secure URLs for image access  
✅ **CloudFront Support** - CDN integration for fast delivery  
✅ **Organized Structure** - Folder-based organization by type and restaurant  
✅ **Database Integration** - Image URLs and keys stored in database  

---

### Quick Reference

| Endpoint | Method | Purpose | Max Size | Allowed Types |
|----------|--------|---------|----------|---------------|
| `/upload/restaurant` | POST | Upload restaurant logo/banner | 5MB | JPG, PNG, WEBP |
| `/upload/menu` | POST | Upload menu item image | 5MB | JPG, PNG, WEBP |
| `/upload/category` | POST | Upload category image | 5MB | JPG, PNG, WEBP |
| `/upload/multiple` | POST | Upload multiple images | 5MB each | JPG, PNG, WEBP |
| `/upload/:key` | DELETE | Delete image by key | - | - |

---

### S3 Folder Structure

```
dineflow-images/
├── restaurants/
│   ├── {restaurantId}/
│   │   ├── 1702345678-abc123def456.jpg (logo)
│   │   └── 1702345679-xyz789uvw012.jpg (banner)
├── menus/
│   ├── {restaurantId}/
│   │   ├── 1702345680-menu001.jpg
│   │   └── 1702345681-menu002.png
└── categories/
    ├── {restaurantId}/
    │   ├── 1702345682-cat001.jpg
    │   └── 1702345683-cat002.webp
```

---

### 1. Upload Restaurant Image

```http
POST /upload/restaurant
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Purpose**: Upload restaurant logo or banner image

**Form Data**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | File | Yes | Image file (JPG, PNG, WEBP) |
| `restaurantId` | String | Yes | Restaurant UUID |

**Response**:
```json
{
  "key": "restaurants/uuid-123/1702345678-abc123def456.jpg",
  "url": "https://dineflow-images.s3.us-east-1.amazonaws.com/restaurants/uuid-123/1702345678-abc123def456.jpg?X-Amz-Algorithm=...",
  "publicUrl": "https://your-cloudfront-domain.cloudfront.net/restaurants/uuid-123/1702345678-abc123def456.jpg",
  "bucket": "dineflow-images",
  "size": 245678,
  "contentType": "image/jpeg"
}
```

**Usage**:
```bash
curl -X POST "http://localhost:4001/api/upload/restaurant" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/logo.jpg" \
  -F "restaurantId=uuid-123"
```

**Then Update Restaurant**:
```bash
# Save the returned key and publicUrl to database
PATCH /restaurants/uuid-123
{
  "logo": "https://your-cloudfront-domain.cloudfront.net/restaurants/uuid-123/1702345678-abc123def456.jpg",
  "logoKey": "restaurants/uuid-123/1702345678-abc123def456.jpg"
}
```

---

### 2. Upload Menu Item Image

```http
POST /upload/menu
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Purpose**: Upload menu item image

**Form Data**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | File | Yes | Menu item image |
| `restaurantId` | String | Yes | Restaurant UUID |

**Response**:
```json
{
  "key": "menus/uuid-123/1702345680-menu001.jpg",
  "url": "https://dineflow-images.s3.us-east-1.amazonaws.com/menus/uuid-123/1702345680-menu001.jpg?X-Amz-Algorithm=...",
  "publicUrl": "https://your-cloudfront-domain.cloudfront.net/menus/uuid-123/1702345680-menu001.jpg",
  "bucket": "dineflow-images",
  "size": 189234,
  "contentType": "image/jpeg"
}
```

**Usage**:
```bash
curl -X POST "http://localhost:4001/api/upload/menu" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/burger.jpg" \
  -F "restaurantId=uuid-123"
```

**Then Update Menu Item**:
```bash
PATCH /menus/menu-uuid
{
  "image": "https://your-cloudfront-domain.cloudfront.net/menus/uuid-123/1702345680-menu001.jpg",
  "imageKey": "menus/uuid-123/1702345680-menu001.jpg"
}
```

---

### 3. Upload Category Image

```http
POST /upload/category
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Purpose**: Upload category image

**Form Data**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | File | Yes | Category image |
| `restaurantId` | String | Yes | Restaurant UUID |

**Response**:
```json
{
  "key": "categories/uuid-123/1702345682-cat001.jpg",
  "url": "https://dineflow-images.s3.us-east-1.amazonaws.com/categories/uuid-123/1702345682-cat001.jpg?X-Amz-Algorithm=...",
  "publicUrl": "https://your-cloudfront-domain.cloudfront.net/categories/uuid-123/1702345682-cat001.jpg",
  "bucket": "dineflow-images",
  "size": 156789,
  "contentType": "image/jpeg"
}
```

**Usage**:
```bash
curl -X POST "http://localhost:4001/api/upload/category" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/desserts.jpg" \
  -F "restaurantId=uuid-123"
```

---

### 4. Upload Multiple Images

```http
POST /upload/multiple
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Purpose**: Upload multiple images at once (max 10)

**Form Data**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `images` | File[] | Yes | Array of image files |
| `folder` | String | Yes | Target folder: `restaurants`, `menus`, or `categories` |
| `restaurantId` | String | Yes | Restaurant UUID |

**Response**:
```json
[
  {
    "key": "menus/uuid-123/1702345680-menu001.jpg",
    "url": "https://...",
    "publicUrl": "https://...",
    "bucket": "dineflow-images",
    "size": 189234,
    "contentType": "image/jpeg"
  },
  {
    "key": "menus/uuid-123/1702345681-menu002.jpg",
    "url": "https://...",
    "publicUrl": "https://...",
    "bucket": "dineflow-images",
    "size": 234567,
    "contentType": "image/jpeg"
  }
]
```

**Usage**:
```bash
curl -X POST "http://localhost:4001/api/upload/multiple" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "images=@/path/to/image3.jpg" \
  -F "folder=menus" \
  -F "restaurantId=uuid-123"
```

---

### 5. Delete Image

```http
DELETE /upload/:key
Authorization: Bearer {token}
```

**Purpose**: Delete an image from S3

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | String | Yes | S3 key (URL encoded) |

**Response**:
```json
{
  "message": "Image deleted successfully",
  "key": "menus/uuid-123/1702345680-menu001.jpg"
}
```

**Usage**:
```bash
# Delete by key
curl -X DELETE "http://localhost:4001/api/upload/menus%2Fuuid-123%2F1702345680-menu001.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Important**: Always delete the old image when updating:
```bash
# 1. Upload new image
POST /upload/menu

# 2. Update database with new URL and key
PATCH /menus/menu-uuid

# 3. Delete old image
DELETE /upload/{old-key}
```

---

## Database Schema Updates

### Restaurant Entity

```typescript
{
  id: string;
  name: string;
  logo: string;           // S3 public URL
  logoKey: string;        // S3 key for deletion
  banner: string;         // S3 public URL
  bannerKey: string;      // S3 key for deletion
  // ... other fields
}
```

### Menu Entity

```typescript
{
  id: string;
  name: string;
  image: string;          // S3 public URL
  imageKey: string;       // S3 key for deletion
  // ... other fields
}
```

### Category Entity

```typescript
{
  id: string;
  name: string;
  image: string;          // S3 public URL
  imageKey: string;       // S3 key for deletion
  // ... other fields
}
```

---

## File Validation

### Allowed File Types
- **JPEG** (`.jpg`, `.jpeg`)
- **PNG** (`.png`)
- **WebP** (`.webp`)

### File Size Limit
- **Maximum**: 5MB per file
- **Recommended**: 1-2MB for optimal performance

### File Naming
- **Automatic**: System generates secure filenames
- **Format**: `{timestamp}-{random-hash}.{extension}`
- **Example**: `1702345678-abc123def456.jpg`

---

## Security Features

### 1. Authentication
- JWT token required for all uploads
- Role-based access control (SUPER_ADMIN, TENANT_ADMIN, MANAGER)

### 2. Validation
- File type validation (MIME type + extension)
- File size validation (max 5MB)
- Restaurant ownership validation

### 3. Secure URLs
- **Signed URLs**: Temporary access (1 hour expiry)
- **CloudFront**: CDN with HTTPS
- **S3 Encryption**: Server-side encryption enabled

### 4. Organized Storage
- Restaurant-specific folders
- Prevents cross-restaurant access
- Easy cleanup and management

---

## Environment Variables

Add these to your `.env` file:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=dineflow-images
AWS_CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
```

---

## AWS S3 Setup Guide

### 1. Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://dineflow-images --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket dineflow-images \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket dineflow-images \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### 2. Set CORS Policy

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 3. Set Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::dineflow-images/*"
    }
  ]
}
```

### 4. Create IAM User

```bash
# Create user
aws iam create-user --user-name dineflow-s3-user

# Attach policy
aws iam attach-user-policy \
  --user-name dineflow-s3-user \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Create access key
aws iam create-access-key --user-name dineflow-s3-user
```

### 5. Setup CloudFront (Optional but Recommended)

- Create CloudFront distribution
- Set origin to S3 bucket
- Enable HTTPS
- Set cache behavior
- Copy CloudFront domain to `.env`

---

## Complete Workflow Examples

### Upload Restaurant Logo

```bash
# 1. Upload image
curl -X POST "http://localhost:4001/api/upload/restaurant" \
  -H "Authorization: Bearer TOKEN" \
  -F "image=@logo.jpg" \
  -F "restaurantId=uuid-123"

# Response:
{
  "key": "restaurants/uuid-123/1702345678-abc.jpg",
  "publicUrl": "https://cdn.example.com/restaurants/uuid-123/1702345678-abc.jpg"
}

# 2. Update restaurant
curl -X PATCH "http://localhost:4001/api/restaurants/uuid-123" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "logo": "https://cdn.example.com/restaurants/uuid-123/1702345678-abc.jpg",
    "logoKey": "restaurants/uuid-123/1702345678-abc.jpg"
  }'
```

### Upload Menu Item Image

```bash
# 1. Upload image
curl -X POST "http://localhost:4001/api/upload/menu" \
  -H "Authorization: Bearer TOKEN" \
  -F "image=@burger.jpg" \
  -F "restaurantId=uuid-123"

# 2. Create/Update menu item
curl -X POST "http://localhost:4001/api/menus" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Classic Burger",
    "price": 12.99,
    "image": "https://cdn.example.com/menus/uuid-123/burger.jpg",
    "imageKey": "menus/uuid-123/burger.jpg",
    "restaurantId": "uuid-123"
  }'
```

### Replace Existing Image

```bash
# 1. Upload new image
POST /upload/menu
# Get new key and URL

# 2. Update menu item with new image
PATCH /menus/menu-uuid
{
  "image": "new-url",
  "imageKey": "new-key"
}

# 3. Delete old image
DELETE /upload/{old-key}
```

---

## Error Responses

### File Too Large
```json
{
  "statusCode": 400,
  "message": "File size exceeds maximum limit of 5MB"
}
```

### Invalid File Type
```json
{
  "statusCode": 400,
  "message": "Invalid file type. Allowed types: image/jpeg, image/jpg, image/png, image/webp"
}
```

### Missing Restaurant ID
```json
{
  "statusCode": 400,
  "message": "Restaurant ID is required"
}
```

### Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

**Last Updated**: 2025-12-16  
**Version**: 1.0

---

## Menu & Category List/Search APIs

**Complete guide for listing, searching, and filtering menus and categories**

**All image URLs are automatically included in responses** ✅

---

### Menu List APIs

#### 1. Get All Menus (with Search & Filters)

```http
GET /menus?restaurantId={id}&search={term}&sortBy={field}&sortOrder={order}&page={page}&limit={limit}
Authorization: Bearer {token}
```

**Purpose**: List all menus with advanced search and filtering

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `restaurantId` | UUID | Yes* | - | Restaurant ID (*Required for SUPER_ADMIN) |
| `search` | String | No | - | Search in name, description, note |
| `sortBy` | String | No | `createdAt` | Sort field: `name`, `price`, `createdAt` |
| `sortOrder` | String | No | `DESC` | Sort order: `ASC` or `DESC` |
| `page` | Number | No | `1` | Page number |
| `limit` | Number | No | `10` | Items per page |

**Response**:
```json
{
  "data": [
    {
      "id": "menu-uuid",
      "name": "Classic Burger",
      "description": "Juicy beef patty with fresh vegetables",
      "note": "Can be made vegetarian",
      "price": 12.99,
      "image": "https://cdn.example.com/menus/restaurant-uuid/burger.jpg",
      "imageKey": "menus/restaurant-uuid/burger.jpg",
      "discount": 0,
      "quantityAvailable": 50,
      "isAvailable": true,
      "preparationTime": 15,
      "availableFrom": "11:00",
      "availableTo": "22:00",
      "restaurantId": "restaurant-uuid",
      "categoryId": "category-uuid",
      "category": {
        "id": "category-uuid",
        "name": "Main Course",
        "code": "MAIN",
        "description": "Main dishes",
        "image": "https://cdn.example.com/categories/restaurant-uuid/main.jpg",
        "imageKey": "categories/restaurant-uuid/main.jpg"
      },
      "createdAt": "2025-12-16T10:00:00.000Z",
      "updatedAt": "2025-12-16T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

**Examples**:
```bash
# Get all menus for a restaurant
GET /menus?restaurantId=uuid-123

# Search for "burger"
GET /menus?restaurantId=uuid-123&search=burger

# Sort by price (ascending)
GET /menus?restaurantId=uuid-123&sortBy=price&sortOrder=ASC

# Paginate (page 2, 20 items)
GET /menus?restaurantId=uuid-123&page=2&limit=20

# Combined: Search + Sort + Paginate
GET /menus?restaurantId=uuid-123&search=chicken&sortBy=price&sortOrder=ASC&page=1&limit=10
```

---

#### 2. Get Menus by Restaurant

```http
GET /menus/restaurant/:restaurantId
Authorization: Bearer {token}
```

**Purpose**: Get all menus for a specific restaurant

**Response**: Same as above (includes images)

**Examples**:
```bash
# Get all menus
GET /menus/restaurant/uuid-123

# With pagination
GET /menus/restaurant/uuid-123?page=1&limit=20

# With search
GET /menus/restaurant/uuid-123?search=pizza

# With filters
GET /menus/restaurant/uuid-123?search=burger&sortBy=price&sortOrder=ASC
```

---

#### 3. Get Menu Items (Public - Customer Portal)

```http
GET /menus/items?restaurantId={id}&category={categoryId}
```

**Purpose**: Public endpoint for customer portal (no auth required)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `restaurantId` | UUID | Yes | Restaurant ID |
| `category` | UUID/String | No | Category ID or "all" |

**Response**:
```json
[
  {
    "id": "menu-uuid",
    "name": "Margherita Pizza",
    "description": "Classic tomato and mozzarella",
    "price": 14.99,
    "image": "https://cdn.example.com/menus/restaurant-uuid/pizza.jpg",
    "imageKey": "menus/restaurant-uuid/pizza.jpg",
    "discount": 10,
    "isAvailable": true,
    "preparationTime": 20,
    "category": {
      "id": "category-uuid",
      "name": "Pizza",
      "image": "https://cdn.example.com/categories/restaurant-uuid/pizza.jpg"
    }
  }
]
```

**Examples**:
```bash
# Get all items
GET /menus/items?restaurantId=uuid-123

# Get items by category
GET /menus/items?restaurantId=uuid-123&category=category-uuid

# Get all categories
GET /menus/items?restaurantId=uuid-123&category=all
```

---

#### 4. Get Menus by Food Court (Multi-Restaurant)

```http
GET /menus/food-court?tenantId={id}
X-Tenant-ID: {tenantId}
```

**Purpose**: Get menus from all restaurants in a food court

**Headers**:
- `X-Tenant-ID`: Tenant identifier (or use query param)

**Response**:
```json
[
  {
    "id": "menu-uuid",
    "name": "Chicken Tikka",
    "price": 16.99,
    "image": "https://cdn.example.com/menus/restaurant-1/tikka.jpg",
    "restaurant": {
      "id": "restaurant-uuid",
      "name": "Indian Kitchen",
      "logo": "https://cdn.example.com/restaurants/restaurant-1/logo.jpg"
    },
    "category": {
      "name": "Indian",
      "image": "https://cdn.example.com/categories/restaurant-1/indian.jpg"
    }
  }
]
```

**Examples**:
```bash
# Using header
curl -H "X-Tenant-ID: tenant-uuid" \
  http://localhost:4001/api/menus/food-court

# Using query param
GET /menus/food-court?tenantId=tenant-uuid
```

---

#### 5. Get Menus by Tenant

```http
GET /menus/tenant?tenantId={id}&restaurantId={id}
X-Tenant-ID: {tenantId}
```

**Purpose**: Get menus for a tenant, optionally filtered by restaurant

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | UUID | Yes* | Tenant ID (*or use header) |
| `restaurantId` | UUID | No | Filter by restaurant |

**Examples**:
```bash
# All menus in tenant
GET /menus/tenant?tenantId=tenant-uuid

# Specific restaurant in tenant
GET /menus/tenant?tenantId=tenant-uuid&restaurantId=restaurant-uuid
```

---

#### 6. Get Single Menu

```http
GET /menus/:id?restaurantId={id}
Authorization: Bearer {token}
```

**Purpose**: Get detailed information for a single menu item

**Response**:
```json
{
  "id": "menu-uuid",
  "name": "Deluxe Burger",
  "description": "Premium beef with special sauce",
  "note": "Contains nuts",
  "price": 18.99,
  "image": "https://cdn.example.com/menus/restaurant-uuid/deluxe-burger.jpg",
  "imageKey": "menus/restaurant-uuid/deluxe-burger.jpg",
  "discount": 5,
  "quantityAvailable": 30,
  "isAvailable": true,
  "preparationTime": 20,
  "availableFrom": "12:00",
  "availableTo": "23:00",
  "category": {
    "id": "category-uuid",
    "name": "Burgers",
    "description": "All types of burgers",
    "image": "https://cdn.example.com/categories/restaurant-uuid/burgers.jpg",
    "imageKey": "categories/restaurant-uuid/burgers.jpg"
  },
  "restaurant": {
    "id": "restaurant-uuid",
    "name": "Burger House",
    "logo": "https://cdn.example.com/restaurants/restaurant-uuid/logo.jpg",
    "banner": "https://cdn.example.com/restaurants/restaurant-uuid/banner.jpg"
  }
}
```

---

### Category List APIs

#### 1. Get All Categories

```http
GET /categories?restaurantId={id}
Authorization: Bearer {token}
```

**Purpose**: List all categories for a restaurant

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `restaurantId` | UUID | Yes* | Restaurant ID (*Required for SUPER_ADMIN) |

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "category-uuid",
      "name": "Starters",
      "code": "STRT",
      "description": "Appetizers and starters",
      "image": "https://cdn.example.com/categories/restaurant-uuid/starters.jpg",
      "imageKey": "categories/restaurant-uuid/starters.jpg",
      "restaurantId": "restaurant-uuid",
      "createdAt": "2025-12-16T10:00:00.000Z",
      "updatedAt": "2025-12-16T10:00:00.000Z"
    },
    {
      "id": "category-uuid-2",
      "name": "Main Course",
      "code": "MAIN",
      "description": "Main dishes",
      "image": "https://cdn.example.com/categories/restaurant-uuid/main.jpg",
      "imageKey": "categories/restaurant-uuid/main.jpg",
      "restaurantId": "restaurant-uuid",
      "createdAt": "2025-12-16T10:00:00.000Z",
      "updatedAt": "2025-12-16T10:00:00.000Z"
    }
  ]
}
```

**Examples**:
```bash
# Get all categories
GET /categories?restaurantId=uuid-123

# For non-admin users (automatic)
GET /categories
```

---

#### 2. Get Single Category

```http
GET /categories/:id?restaurantId={id}
Authorization: Bearer {token}
```

**Purpose**: Get detailed information for a single category

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "category-uuid",
    "name": "Desserts",
    "code": "DSRT",
    "description": "Sweet treats and desserts",
    "image": "https://cdn.example.com/categories/restaurant-uuid/desserts.jpg",
    "imageKey": "categories/restaurant-uuid/desserts.jpg",
    "restaurantId": "restaurant-uuid",
    "createdAt": "2025-12-16T10:00:00.000Z",
    "updatedAt": "2025-12-16T10:00:00.000Z"
  }
}
```

---

#### 3. Get Restaurants by Category

```http
GET /categories/restaurants?categoryId={id}&categoryName={name}&tenantId={id}
Authorization: Bearer {token}
```

**Purpose**: Find all restaurants that have items in a specific category

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categoryId` | UUID | No* | Category ID |
| `categoryName` | String | No* | Category name (case-insensitive) |
| `tenantId` | UUID | No | Filter by tenant |

*Either `categoryId` or `categoryName` must be provided

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "restaurant-uuid",
      "name": "Pizza Palace",
      "logo": "https://cdn.example.com/restaurants/restaurant-uuid/logo.jpg",
      "banner": "https://cdn.example.com/restaurants/restaurant-uuid/banner.jpg",
      "address": {
        "lane": "123 Main St",
        "city": "Colombo",
        "district": "Western",
        "country": "Sri Lanka"
      },
      "contactEmail": "info@pizzapalace.com",
      "contactPhoneNumber": "+94771234567",
      "openTime": "10:00",
      "closeTime": "22:00",
      "status": "active",
      "isActive": true,
      "paymentTiming": "pay_at_last"
    }
  ]
}
```

**Examples**:
```bash
# By category ID
GET /categories/restaurants?categoryId=category-uuid

# By category name
GET /categories/restaurants?categoryName=Pizza

# Filter by tenant
GET /categories/restaurants?categoryName=Pizza&tenantId=tenant-uuid
```

---

### Search & Filter Examples

#### Search Menus by Name
```bash
GET /menus?restaurantId=uuid-123&search=chicken
```

#### Filter by Price Range (using sortBy)
```bash
# Get cheapest items first
GET /menus?restaurantId=uuid-123&sortBy=price&sortOrder=ASC

# Get most expensive first
GET /menus?restaurantId=uuid-123&sortBy=price&sortOrder=DESC
```

#### Get Available Items Only
```bash
# Filter in your frontend based on isAvailable: true
GET /menus?restaurantId=uuid-123
```

#### Search + Sort + Paginate
```bash
GET /menus?restaurantId=uuid-123&search=burger&sortBy=price&sortOrder=ASC&page=1&limit=10
```

#### Get Items by Category
```bash
GET /menus/items?restaurantId=uuid-123&category=category-uuid
```

---

### Customer Portal Usage

#### 1. Browse Restaurant Menu
```bash
# Get all categories
GET /categories?restaurantId=uuid-123

# Get items by category
GET /menus/items?restaurantId=uuid-123&category=category-uuid

# Get all items
GET /menus/items?restaurantId=uuid-123&category=all
```

#### 2. Search Menu
```bash
# Search for items
GET /menus?restaurantId=uuid-123&search=pizza

# Filter by category
GET /menus/items?restaurantId=uuid-123&category=pizza-category-uuid
```

#### 3. View Item Details
```bash
# Get single item
GET /menus/menu-uuid?restaurantId=uuid-123
```

---

### Restaurant Portal Usage

#### 1. Manage Menu
```bash
# List all menus
GET /menus?restaurantId=uuid-123

# Search menus
GET /menus?restaurantId=uuid-123&search=burger

# Sort by price
GET /menus?restaurantId=uuid-123&sortBy=price&sortOrder=ASC

# Paginate
GET /menus?restaurantId=uuid-123&page=1&limit=20
```

#### 2. Manage Categories
```bash
# List categories
GET /categories?restaurantId=uuid-123

# Get category details
GET /categories/category-uuid?restaurantId=uuid-123
```

---

### Image URLs in Responses

All list endpoints automatically include image URLs:

#### Menu Response:
```json
{
  "image": "https://cdn.example.com/menus/restaurant-uuid/burger.jpg",
  "imageKey": "menus/restaurant-uuid/burger.jpg"
}
```

#### Category Response:
```json
{
  "image": "https://cdn.example.com/categories/restaurant-uuid/starters.jpg",
  "imageKey": "categories/restaurant-uuid/starters.jpg"
}
```

#### Restaurant Response:
```json
{
  "logo": "https://cdn.example.com/restaurants/restaurant-uuid/logo.jpg",
  "logoKey": "restaurants/restaurant-uuid/logo.jpg",
  "banner": "https://cdn.example.com/restaurants/restaurant-uuid/banner.jpg",
  "bannerKey": "restaurants/restaurant-uuid/banner.jpg"
}
```

---

### Frontend Integration Examples

#### React - Menu List with Images
```typescript
const MenuList = () => {
  const [menus, setMenus] = useState([]);

  useEffect(() => {
    axios.get('/menus', {
      params: {
        restaurantId: 'uuid-123',
        search: searchTerm,
        sortBy: 'price',
        sortOrder: 'ASC',
        page: 1,
        limit: 20
      }
    }).then(res => setMenus(res.data.data));
  }, []);

  return (
    <div>
      {menus.map(menu => (
        <div key={menu.id}>
          <img src={menu.image} alt={menu.name} />
          <h3>{menu.name}</h3>
          <p>{menu.price}</p>
        </div>
      ))}
    </div>
  );
};
```

#### React - Category List with Images
```typescript
const CategoryList = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios.get('/categories', {
      params: { restaurantId: 'uuid-123' }
    }).then(res => setCategories(res.data.data));
  }, []);

  return (
    <div>
      {categories.map(category => (
        <div key={category.id}>
          <img src={category.image} alt={category.name} />
          <h3>{category.name}</h3>
        </div>
      ))}
    </div>
  );
};
```

---

### Role-Based Access

#### SUPER_ADMIN:
- ✅ Can access any restaurant (must provide `restaurantId`)
- ✅ Can search/filter across all restaurants

#### TENANT_ADMIN / MANAGER:
- ✅ Can only access their own restaurant
- ✅ `restaurantId` automatically set to their restaurant
- ❌ Cannot access other restaurants

#### WAITER / KITCHEN_STAFF:
- ✅ Read-only access to their restaurant's menus
- ✅ Can view categories and items

#### PUBLIC (No Auth):
- ✅ Can access `/menus/items` (customer portal)
- ✅ Can access `/menus/food-court`
- ✅ Can access `/menus/tenant`

---

**Last Updated**: 2025-12-16  
**Version**: 1.0

---

## Order Analytics Summary API

### Get Order Analytics Summary
```http
GET /orders/analytics/summary?restaurantId={restaurantId}&startDate=2025-12-01&endDate=2025-12-18&orderType=dine_in&status=completed&paymentMethod=card
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`

**Description**: Get essential order analytics summary with flexible filters. Returns only key metrics needed for summary cards.

**Query Parameters**:
- `restaurantId` (UUID, required for non-super-admin): Restaurant ID
- `period` (enum, optional): Time period - `today`, `last7days`, `last30days`, `total` (default: `last7days`)
- `startDate` (string, optional): Custom start date (YYYY-MM-DD format)
- `endDate` (string, optional): Custom end date (YYYY-MM-DD format)
- `orderType` (enum, optional): Filter by type - `dine_in`, `takeaway` (default: all)
- `status` (enum, optional): Filter by status - `pending`, `confirmed`, `preparing`, `ready`, `served`, `completed`, `cancelled` (default: `completed`)
- `paymentMethod` (enum, optional): Filter by payment - `cash`, `card`, `qr`, `cashier` (default: all)

**Response**:
```json
{
  "summary": {
    "totalOrders": 152,
    "totalRevenue": 4352.75,
    "averageOrderValue": 28.64
  },
  "dateRange": {
    "startDate": "2025-12-01T00:00:00.000Z",
    "endDate": "2025-12-18T23:59:59.999Z"
  },
  "filters": {
    "orderType": "dine_in",
    "status": "completed",
    "paymentMethod": "card"
  }
}
```

**Important Notes**:
- ✅ **Revenue Calculation**: Only counts COMPLETED orders for accurate revenue
- ✅ **Optimized Performance**: Only fetches necessary fields
- ✅ **Flexible Filtering**: Combine multiple filters for detailed analysis
- ✅ **Date Range Support**: Use predefined periods or custom date ranges

**Example Requests**:
```http
# Basic request (last 7 days, completed orders)
GET /orders/analytics/summary?restaurantId=xxx

# Custom date range
GET /orders/analytics/summary?restaurantId=xxx&startDate=2025-01-01&endDate=2025-12-18

# Filter by dine-in orders only
GET /orders/analytics/summary?restaurantId=xxx&orderType=dine_in

# Filter by card payments
GET /orders/analytics/summary?restaurantId=xxx&paymentMethod=card

# All filters combined
GET /orders/analytics/summary?restaurantId=xxx&startDate=2025-12-01&endDate=2025-12-18&orderType=dine_in&status=completed&paymentMethod=card
```

---

## Orders with Review Information

### Get Orders List
```http
GET /orders?restaurantId={restaurantId}&page=1&limit=10&status=completed
Authorization: Bearer your-access-token
```

**Required Role**: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `WAITER`, `KITCHEN_STAFF`

**Description**: Retrieve paginated list of orders with review information included.

**Query Parameters**:
- `restaurantId` (UUID, required for non-super-admin): Restaurant ID
- `status` (enum, optional): Filter by order status
- `paymentStatus` (enum, optional): Filter by payment status
- `date` (string, optional): Filter by order creation date (ISO string)
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)

**Response** (with review information):
```json
{
  "data": [
    {
      "id": "order-uuid",
      "orderNumber": "#4523313",
      "tableNo": "T5",
      "customerName": "John Doe",
      "customerPhone": "+1234567890",
      "customer": {
        "id": "customer-uuid",
        "name": "John Doe",
        "phone": "+1234567890"
      },
      "orderType": "dine_in",
      "status": "completed",
      "totalAmount": 45.50,
      "paymentMethod": "card",
      "paymentStatus": "paid",
      "restaurant": {
        "id": "restaurant-uuid",
        "name": "Pizza Palace"
      },
      "itemsByCategory": [...],
      "hasReview": true,
      "review": {
        "id": "review-uuid",
        "rating": 5,
        "comment": "Excellent food and service!",
        "createdAt": "2025-12-18T10:30:00.000Z"
      },
      "createdAt": "2025-12-18T09:00:00.000Z",
      "updatedAt": "2025-12-18T10:00:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

**New Fields**:
- `hasReview` (boolean): Indicates if order has a customer review
- `review` (object|null): Review details if exists
  - `id` (string): Review UUID
  - `rating` (number): Rating (1-5 stars)
  - `comment` (string): Review comment/text
  - `createdAt` (string): Review creation timestamp

**Important Notes**:
- ✅ **Order-Specific Reviews**: Only returns reviews specifically for the order (filters out general restaurant ratings)
- ✅ **Null Safety**: `review` is `null` if no review exists
- ✅ **Boolean Flag**: `hasReview` provides quick check without parsing review object

---

## Automated Table Reset Scheduler

### Overview
Automated background job that checks restaurant opening hours daily and resets tables to AVAILABLE status at opening time.

**Execution Schedule**: Every hour (cron: `0 * * * *`)  
**Timezone**: Asia/Kolkata (configurable)

### How It Works

1. **Check All Active Restaurants**: Fetches restaurants with `isActive: true` and `status: 'active'`
2. **Match Opening Time**: Compares current time with each restaurant's `openTime`
3. **Reset Tables Safely**: Resets only safe tables (see safeguards below)

### Safeguards

#### 1. Active Order Check ✅
**Prevents**: Resetting tables with ongoing orders
- Checks for orders that are NOT completed or cancelled
- Tables with active orders are skipped

#### 2. Maintenance Status Check ✅
**Prevents**: Resetting tables that need manual intervention
- Tables with status `MAINTENANCE` remain unchanged

#### 3. Only Non-Available Tables ✅
**Prevents**: Unnecessary database writes
- Only processes tables that need resetting

### Configuration

**Restaurant Setup** (required):
```typescript
{
  "openTime": "09:00",  // Required for auto-reset
  "closeTime": "22:00",
  "isActive": true,
  "status": "active"
}
```

**Timezone Configuration**:
Update in `src/table/table-reset.scheduler.ts`:
```typescript
@Cron('0 * * * *', {
  name: 'reset-tables-at-opening',
  timeZone: 'Asia/Kolkata', // Change this
})
```

### Manual Trigger

For testing or manual resets:
```typescript
const result = await tableResetScheduler.manualTableReset(restaurantId);

// Returns:
{
  "message": "Table reset completed for Pizza Palace",
  "resetCount": 5
}
```

### Example Scenario

**Time**: 09:00 (opening time)  
**Restaurant**: Pizza Palace (opens at 09:00)  
**Tables**:
- T1: OCCUPIED (no active orders) → Reset to AVAILABLE ✅
- T2: RESERVED (no active orders) → Reset to AVAILABLE ✅
- T3: OCCUPIED (has active order) → Skipped ⏭️
- T4: MAINTENANCE → Skipped ⏭️
- T5: AVAILABLE → Skipped (already available) ⏭️

**Result**: T1 and T2 reset, others unchanged

### Logging

The scheduler provides detailed logs:
```
[TableResetScheduler] Running scheduled table reset check...
[TableResetScheduler] Current time: 09:00, Checking 15 restaurants
[TableResetScheduler] Restaurant Pizza Palace (uuid) is opening now. Resetting tables...
[TableResetScheduler] Found 8 non-available tables for Pizza Palace
[TableResetScheduler] Found 2 tables with active orders
[TableResetScheduler] Skipping table T5 - has active orders
[TableResetScheduler] Skipping table T3 - in maintenance
[TableResetScheduler] Reset table T1 to AVAILABLE
[TableResetScheduler] Reset table T2 to AVAILABLE
[TableResetScheduler] Successfully reset 6 tables for Pizza Palace
[TableResetScheduler] Table reset check completed
```

### Best Practices

1. **Set Appropriate Opening Times**: Ensure all restaurants have accurate `openTime` values
2. **Monitor Logs**: Check logs regularly to ensure tables are being reset correctly
3. **Handle Edge Cases**:
   - 24-hour restaurants: Set `openTime` to a specific reset time (e.g., "06:00")
   - Variable hours: Update `openTime` when hours change
   - Holidays: Manually manage tables or update `isActive` status

---

**Last Updated**: 2025-12-18  
**Version**: 1.1

---

## Automated Order Cleanup Scheduler

### Overview
Automated background job that marks unprocessed orders older than 1 day as ABANDONED to prevent database accumulation and improve report accuracy.

**Execution Schedule**: Daily at 2:00 AM (cron: `0 2 * * *`)  
**Timezone**: Asia/Kolkata (configurable)

### Problem Solved
- ❌ **Before**: Database fills with 1+ year old abandoned orders
- ❌ **Before**: No cleanup mechanism
- ❌ **Before**: Reports include stale data
- ❌ **Before**: Storage costs rise unnecessarily

- ✅ **After**: Old unprocessed orders automatically marked as ABANDONED
- ✅ **After**: Clean, accurate reporting
- ✅ **After**: Better database performance
- ✅ **After**: Easy filtering of active vs abandoned orders

### How It Works

1. **Daily Check**: Runs at 2:00 AM every day
2. **Find Old Orders**: Identifies orders older than 1 day
3. **Filter Unprocessed**: Only targets orders NOT in completed/cancelled/abandoned status
4. **Mark as Abandoned**: Updates status to ABANDONED (soft delete)
5. **Detailed Logging**: Logs all actions for audit trail

### Criteria for Abandonment

An order is marked as ABANDONED if:
- ✅ Created more than 1 day ago
- ✅ Status is one of: `pending`, `confirmed`, `preparing`, `ready`, `served`
- ❌ NOT `completed`, `cancelled`, or already `abandoned`

### Order Status Flow

```
PENDING → CONFIRMED → PREPARING → READY → SERVED → COMPLETED ✅
   ↓          ↓           ↓          ↓        ↓
   └──────────┴───────────┴──────────┴────────┴──→ ABANDONED (if >1 day old)
```

### Example Scenario

**Date**: 2025-12-18 02:00 AM  
**Cutoff**: 2025-12-17 02:00 AM (1 day ago)

**Orders Found**:
- Order #1001: Created 2025-12-15, Status: PENDING → Mark as ABANDONED ✅
- Order #1002: Created 2025-12-16, Status: PREPARING → Mark as ABANDONED ✅
- Order #1003: Created 2025-12-17 10:00, Status: PENDING → Keep (< 1 day old) ⏭️
- Order #1004: Created 2025-12-10, Status: COMPLETED → Keep (already completed) ⏭️
- Order #1005: Created 2025-12-14, Status: CANCELLED → Keep (already cancelled) ⏭️

**Result**: Orders #1001 and #1002 marked as ABANDONED

### Logging

The scheduler provides detailed logs:

```
[OrderCleanupScheduler] Running abandoned orders cleanup...
[OrderCleanupScheduler] Marking orders older than 2025-12-17T02:00:00.000Z as abandoned
[OrderCleanupScheduler] Found 15 abandoned orders
[OrderCleanupScheduler] Restaurant: Pizza Palace - Marking 8 orders as abandoned
[OrderCleanupScheduler] Marked order #4523313 as ABANDONED (was pending, age: 3 days)
[OrderCleanupScheduler] Marked order #4523314 as ABANDONED (was confirmed, age: 2 days)
[OrderCleanupScheduler] Restaurant: Burger Joint - Marking 7 orders as abandoned
[OrderCleanupScheduler] Marked order #4523315 as ABANDONED (was preparing, age: 5 days)
[OrderCleanupScheduler] Successfully marked 15 orders as ABANDONED across 2 restaurants
```

### Manual Trigger (for Testing)

```typescript
// Trigger manual cleanup
const result = await orderCleanupScheduler.manualCleanup(1); // 1 day old

// Returns:
{
  "message": "Marked 15 orders as ABANDONED",
  "markedCount": 15,
  "orders": [
    {
      "id": "order-uuid",
      "orderNumber": "#4523313",
      "restaurantName": "Pizza Palace",
      "previousStatus": "pending",
      "age": 3,
      "createdAt": "2025-12-15T10:00:00.000Z"
    }
  ]
}
```

### Get Abandoned Orders Statistics

```typescript
const stats = await orderCleanupScheduler.getAbandonedOrdersStats();

// Returns:
{
  "totalAbandoned": 150,
  "byRestaurant": [
    {
      "restaurantId": "restaurant-uuid-1",
      "restaurantName": "Pizza Palace",
      "count": 85
    },
    {
      "restaurantId": "restaurant-uuid-2",
      "restaurantName": "Burger Joint",
      "count": 65
    }
  ],
  "byPreviousStatus": {}
}
```

### Filtering Abandoned Orders

**Exclude abandoned orders from reports**:
```typescript
// In analytics queries
const activeOrders = await orderRepository.find({
  where: {
    status: Not(In([OrderStatus.ABANDONED, OrderStatus.CANCELLED])),
  },
});
```

**View only abandoned orders**:
```typescript
const abandonedOrders = await orderRepository.find({
  where: {
    status: OrderStatus.ABANDONED,
  },
});
```

### Configuration

**Timezone**:
Update in `src/order-management/order-cleanup.scheduler.ts`:
```typescript
@Cron('0 2 * * *', {
  name: 'mark-abandoned-orders',
  timeZone: 'Asia/Kolkata', // Change this
})
```

**Cutoff Period**:
Modify the cutoff calculation:
```typescript
// Current: 1 day
const oneDayAgo = new Date();
oneDayAgo.setDate(oneDayAgo.getDate() - 1);

// Change to 2 days:
const twoDaysAgo = new Date();
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
```

### Benefits

#### 1. Clean Database ✅
- No accumulation of old unprocessed orders
- Better query performance
- Reduced storage costs

#### 2. Accurate Reports ✅
- Analytics exclude abandoned orders
- Revenue calculations more accurate
- Clear distinction between active and abandoned

#### 3. Easy Auditing ✅
- Abandoned orders preserved (not deleted)
- Can analyze abandonment patterns
- Historical data maintained

#### 4. Automatic Cleanup ✅
- No manual intervention required
- Runs daily automatically
- Detailed logging for monitoring

### Best Practices

1. **Monitor Logs**: Check daily logs to ensure cleanup is running
2. **Analyze Patterns**: Review abandoned orders to identify issues
3. **Adjust Cutoff**: Modify cutoff period based on business needs
4. **Filter Reports**: Always exclude ABANDONED status from active reports

### Impact on Analytics

**Before Cleanup**:
```json
{
  "totalOrders": 1500,  // Includes 500 abandoned orders
  "totalRevenue": 45000
}
```

**After Cleanup** (with proper filtering):
```json
{
  "totalOrders": 1000,  // Only active orders
  "totalRevenue": 45000  // Accurate revenue
}
```

### Order Status Enum

```typescript
enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  SERVED = 'served',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ABANDONED = 'abandoned',  // ← NEW
}
```

---

**Last Updated**: 2025-12-18  
**Version**: 1.2

---

## Analytics and Revenue Calculations - ABANDONED Orders Exclusion

### Overview
All analytics and revenue calculations automatically exclude ABANDONED orders to ensure accurate reporting and metrics.

### What Gets Excluded

**ABANDONED orders are excluded from:**
- ✅ Revenue calculations
- ✅ Order counts
- ✅ Analytics summaries
- ✅ Dashboard metrics
- ✅ Sales reports
- ✅ Customer insights
- ✅ Table occupancy stats

### Implementation Details

#### Dashboard Summary Cards
```typescript
// Today's Sales - COMPLETED orders only
status: OrderStatusEnum.COMPLETED

// Total Orders Today - Excludes cancelled and abandoned
status: Not(In([OrderStatusEnum.CANCELLED, OrderStatusEnum.ABANDONED]))
```

#### Order Analytics Summary
```typescript
// Defaults to COMPLETED orders for revenue
whereCondition.status = OrderStatusEnum.COMPLETED
```

#### Restaurant Analytics
```typescript
// All revenue queries use COMPLETED status
status: OrderStatusEnum.COMPLETED

// Order counts exclude cancelled and abandoned
status: Not(In([OrderStatusEnum.CANCELLED, OrderStatusEnum.ABANDONED]))
```

### Status Filtering Logic

**For Revenue/Sales:**
- ✅ Only `COMPLETED` orders counted
- ❌ Excludes: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `SERVED`, `CANCELLED`, `ABANDONED`

**For Order Counts:**
- ✅ Includes: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`
- ❌ Excludes: `CANCELLED`, `ABANDONED`

### Example Impact

**Before ABANDONED Status:**
```json
{
  "totalOrders": 1500,  // Includes 500 old unprocessed orders
  "totalRevenue": 45000,
  "averageOrderValue": 30
}
```

**After ABANDONED Status (with proper filtering):**
```json
{
  "totalOrders": 1000,  // Only active orders
  "totalRevenue": 45000,  // Same (only completed counted)
  "averageOrderValue": 45  // More accurate
}
```

### Affected Endpoints

#### 1. Dashboard Summary
```http
GET /dashboard/summary?restaurantId={id}
```
- Today's Sales: COMPLETED only
- Total Orders: Excludes CANCELLED and ABANDONED

#### 2. Restaurant Analytics
```http
GET /dashboard/restaurant-analytics?restaurantId={id}&period=last7days
```
- All revenue: COMPLETED only
- Order counts: Excludes CANCELLED and ABANDONED
- Customer insights: Excludes CANCELLED and ABANDONED

#### 3. Order Analytics Summary
```http
GET /orders/analytics/summary?restaurantId={id}
```
- Defaults to COMPLETED status
- Can filter by other statuses if needed

#### 4. Super Admin Dashboard
```http
GET /dashboard/super-admin/summary
GET /dashboard/super-admin/restaurant-analytics/{restaurantId}
```
- All revenue: COMPLETED only
- Platform metrics: Excludes CANCELLED and ABANDONED

### Verification Queries

**Check ABANDONED orders count:**
```sql
SELECT COUNT(*) FROM orders WHERE status = 'abandoned';
```

**Verify revenue excludes ABANDONED:**
```sql
SELECT SUM(total_amount) 
FROM orders 
WHERE status = 'completed'  -- Only completed
AND status != 'abandoned';  -- Redundant but explicit
```

**Check order counts:**
```sql
SELECT COUNT(*) 
FROM orders 
WHERE status NOT IN ('cancelled', 'abandoned');
```

### Benefits

1. **Accurate Revenue** - Only completed orders counted
2. **Clean Metrics** - No old abandoned orders inflating counts
3. **Better Insights** - Customer analytics reflect real behavior
4. **Performance** - Smaller datasets for queries
5. **Compliance** - Clear separation of active vs abandoned orders

---

**Last Updated**: 2025-12-18  
**Version**: 1.3

---

## Order Auto-Complete System

### Overview
The system automatically marks orders as **COMPLETED** when they are **SERVED** and **PAID**. This works for all payment models without requiring frontend changes.

### Auto-Complete Logic

**Trigger Conditions:**
1. Order status = `SERVED`
2. Payment status = `PAID`

**Result:** Order status automatically changes to `COMPLETED`

### Supported Workflows

#### 1. Pay-First Restaurant
```
Order → Payment → PENDING → CONFIRMED → PREPARING → READY → SERVED → COMPLETED ✅
```

#### 2. Pay-Last Restaurant
```
Order → PENDING → CONFIRMED → PREPARING → READY → SERVED → Payment → COMPLETED ✅
```

#### 3. Food Court - Pay First
```
Order → Payment → PENDING → CONFIRMED → PREPARING → READY → SERVED → COMPLETED ✅
```

#### 4. Food Court - Pay at Counter
```
Order → PENDING → CONFIRMED → PREPARING → READY → SERVED → Pay at Counter → COMPLETED ✅
```

### Integration Points

All payment processing methods now support auto-complete:

1. **Customer Portal Payment** (`customer-portal.service.ts`)
   - PENDING + PAID → CONFIRMED
   - SERVED + PAID → COMPLETED ✅

2. **Food Court Payment at Counter** (`food-court-cart.service.ts`)
   - PENDING + PAID → CONFIRMED
   - SERVED + PAID → COMPLETED ✅

3. **Staff Payment Processing** (`order-management.service.ts`)
   - PENDING + PAID → CONFIRMED
   - SERVED + PAID → COMPLETED ✅

4. **Cashier Mark as Done** (`order-management.service.ts`)
   - Accepts both PENDING and SERVED orders
   - Marks as COMPLETED ✅

5. **Order Status Update** (`order-status.service.ts`)
   - Checks for auto-complete after marking as READY
   - Triggers if payment already processed ✅

### API Endpoints

#### Bulk Auto-Complete
```http
POST /order-auto-complete/bulk-complete
Authorization: Bearer {token}
```

**Purpose:** Fix existing SERVED+PAID orders that weren't auto-completed

**Response:**
```json
{
  "completed": 15,
  "orders": ["ORD000231", "ORD000228", "ORD000225"]
}
```

**Permissions:** Super Admin, Tenant Admin, Manager

### Dashboard Impact

**Before Auto-Complete:**
- Orders stuck in SERVED status
- Revenue shows LKR 0 (only COMPLETED orders counted)
- Analytics incomplete

**After Auto-Complete:**
- Orders automatically complete
- Revenue shows correctly
- All analytics populate properly

### Benefits

1. ✅ No frontend changes needed
2. ✅ Works for all payment models
3. ✅ Accurate revenue reporting
4. ✅ Automatic table release
5. ✅ Better analytics
6. ✅ Less manual work

---

**Last Updated:** 2025-12-18  
**Version:** 1.4
