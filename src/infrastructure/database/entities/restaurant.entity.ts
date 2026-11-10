import { Entity, Column, Index, ManyToOne, OneToMany, OneToOne, JoinColumn, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';

export enum SmsSendMode {
  ALWAYS = 'ALWAYS',
  ASK_CASHIER = 'ASK_CASHIER',
  OFF = 'OFF',
}

@Entity('stores')
@Index(['tenantId'])
export class Restaurant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'ALWAYS', nullable: true })
  smsSendMode: SmsSendMode | string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.restaurants)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ nullable: true })
  logo: string; // S3 public URL or signed URL

  @Column({ nullable: true })
  logoKey: string; // S3 key for logo

  @Column({ nullable: true })
  banner: string; // S3 public URL for banner image

  @Column({ nullable: true })
  bannerKey: string; // S3 key for banner

  @Column({ type: 'jsonb', nullable: true })
  address: {
    lane?: string;
    city?: string;
    district?: string;
    country?: string;
  };

  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  contactPhoneNumber: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  openTime: string; // e.g., "09:00"

  @Column({ nullable: true })
  closeTime: string; // e.g., "22:00"

  @Column({ type: 'jsonb', nullable: true })
  openHours: Record<string, string>; // e.g., { "mon-fri": "10:00-22:00", "sat-sun": "09:00-23:00" }

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Column({ type: 'enum', enum: ['pay_at_first', 'pay_at_last'], default: 'pay_at_last', nullable: true })
  paymentTiming: 'pay_at_first' | 'pay_at_last';

  // Waiter Confirmation for Pay-Last Restaurants
  // When enabled, orders in pay_at_last restaurants require manual waiter confirmation before going to kitchen
  // When disabled, orders auto-confirm and go directly to kitchen (default behavior)
  // This setting only applies to pay_at_last restaurants (pay_at_first always requires payment first)
  @Column({ type: 'boolean', default: false })
  requireWaiterConfirmation: boolean;

  // Super Admin Feature Permission Controls
  @Column({ type: 'boolean', default: true })
  isRoomsEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  isLoyaltyEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  isAppearanceEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  isWhatsAppEnabled: boolean;

  // Meta WhatsApp Cloud API per-restaurant credentials (set via Embedded Signup)
  @Column({ nullable: true })
  whatsappPhoneNumberId: string; // Meta Phone Number ID

  @Column({ nullable: true })
  whatsappBusinessAccountId: string; // Meta WABA ID

  @Column({ nullable: true, select: false }) // Hidden by default — sensitive token
  whatsappAccessToken: string; // System User Access Token

  @Column({ type: 'jsonb', nullable: true })
  whatsappTemplates: {
    orderPlaced?: string;   // e.g., 'order_placed_restflow'
    orderReady?: string;    // e.g., 'order_ready_restflow'
    orderCompleted?: string; // e.g., 'order_completed_restflow'
  };

  @Column({
    type: 'jsonb',
    nullable: true,
    default: () => `'{"status":"DISCONNECTED","connectedNumber":null,"autoSendInvoice":true,"autoSendOTP":true,"autoSendLoyalty":true,"fallbackToSMS":true}'`,
  })
  whatsappConfig: {
    status?: 'CONNECTED' | 'DISCONNECTED' | 'SCAN_REQUIRED' | 'CONNECTING';
    connectedNumber?: string | null;
    connectedAt?: Date | null;
    autoSendInvoice?: boolean;
    autoSendOTP?: boolean;
    autoSendLoyalty?: boolean;
    fallbackToSMS?: boolean;
  };

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  walletBalance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  walletTotalEarned: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  walletTotalWithdrawn: number;

  @OneToMany(() => User, (user) => user.restaurant)
  users: User[];

  @Column({ nullable: true })
  primaryColor: string;

  @Column({ nullable: true })
  secondaryColor: string;

  @Column({ nullable: true })
  tertiaryColor: string;

  // Service Charge Configuration
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  serviceChargePercentage: number; // e.g., 10.00 for 10% (default: 0 = disabled)

  @Column({ type: 'boolean', default: false })
  applyServiceCharge: boolean; // Toggle to enable/disable service charge (default: disabled)

  @Column({ type: 'enum', enum: ['percentage', 'fixed'], default: 'percentage' })
  serviceChargeType: 'percentage' | 'fixed';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fixedServiceCharge: number; // For fixed amount instead of percentage

  // System Controls & KDS/POS Flags
  @Column({ type: 'boolean', default: true })
  showPOSOrderSidebar: boolean;

  @Column({ type: 'boolean', default: false })
  bypassKitchen: boolean;

  @Column({ type: 'boolean', default: false })
  kitchenBulkMode: boolean;

  @Column({ type: 'boolean', default: false })
  orderAlertsVisible: boolean;

  @Column({ type: 'boolean', default: false })
  orderAlertsMuted: boolean;

  // Audio Alert & Continuous Ringing Configuration
  @Column({ type: 'varchar', length: 50, default: 'uber_rush' })
  alertAudioRingtone: string;

  @Column({ type: 'varchar', length: 30, default: 'continuous' })
  alertAudioRingMode: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.80 })
  alertAudioVolume: number;

  @Column({ type: 'varchar', length: 30, default: 'action_only' })
  alertStopCondition: string;

  // Thermal Printer Configuration
  @Column({ type: 'boolean', default: false })
  autoPrintEnabled: boolean;

  @Column({ type: 'varchar', default: '80mm' })
  printerPaperWidth: string;

  @Column({ type: 'varchar', nullable: true })
  connectedPrinterName: string | null;


  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}