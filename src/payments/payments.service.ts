import { BadGatewayException, BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CardCharge, CardChargeStatus } from '../infrastructure/database/entities/card-charge.entity';
import { round2 } from '../sales/sale-calculations';
import { ChargeDto } from './dto/payment.dto';
import { SimulatedTerminalProvider } from './providers/simulated.provider';
import { TerminalProvider } from './providers/terminal-provider';

@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');
  readonly provider: TerminalProvider;

  constructor(
    config: ConfigService,
    @InjectRepository(CardCharge) private readonly charges: Repository<CardCharge>,
  ) {
    const name = (config.get<string>('PAYMENT_PROVIDER') || 'simulated').toLowerCase();
    // Register real providers here, e.g. case 'stripe': this.provider = new StripeTerminalProvider(config); break;
    switch (name) {
      case 'simulated':
        this.provider = new SimulatedTerminalProvider();
        if (config.get<string>('NODE_ENV') === 'production') this.log.warn('PAYMENT_PROVIDER is "simulated" in production: no real card payments are taken');
        break;
      default:
        throw new Error(`Unknown PAYMENT_PROVIDER "${name}". Implement TerminalProvider and register it in payments.service.ts.`);
    }
  }

  async status() {
    return { provider: this.provider.name, ready: await this.provider.ready().catch(() => false) };
  }

  /** Takes a card payment on the terminal. Safe to repeat with the same clientRef. */
  async charge(storeId: string, userId: string, dto: ChargeDto) {
    const existing = await this.charges.findOne({ where: { storeId, clientRef: dto.clientRef } });
    if (existing) {
      if (round2(existing.amount) !== round2(dto.amount)) throw new BadRequestException('That card attempt was for a different amount. Start a new card payment.');
      return this.present(existing);
    }

    let result;
    try {
      result = await this.provider.charge({ amount: round2(dto.amount), clientRef: dto.clientRef, simulate: dto.simulate });
    } catch (e: any) {
      this.log.error(`Terminal error: ${e?.message}`);
      throw new ServiceUnavailableException('The card terminal could not be reached. Check it is on, or take cash.');
    }
    const saved = await this.charges.save(
      this.charges.create({
        storeId, userId, provider: this.provider.name, reference: result.reference, clientRef: dto.clientRef, amount: round2(dto.amount),
        status: result.status === 'approved' ? CardChargeStatus.APPROVED : CardChargeStatus.DECLINED,
        scheme: result.status === 'approved' ? result.scheme ?? null : null,
        last4: result.status === 'approved' ? result.last4 ?? null : null,
        authCode: result.status === 'approved' ? result.authCode ?? null : null,
        declineReason: result.status === 'declined' ? result.reason : null,
      }),
    );
    return this.present(saved);
  }

  private present(c: CardCharge) {
    return { status: c.status, reference: c.reference, amount: c.amount, scheme: c.scheme, last4: c.last4, message: c.declineReason };
  }

  /**
   * Inside the sale's transaction: every card payment must match an approved, unused charge from this store's
   * terminal for the same amount. Marks them as used by the sale.
   */
  async claimForSale(manager: EntityManager, storeId: string, saleId: string | null, cardPayments: { reference?: string | null; amount: number }[]): Promise<CardCharge[]> {
    const claimed: CardCharge[] = [];
    const seen = new Set<string>();
    for (const p of cardPayments) {
      if (!p.reference) throw new BadRequestException('A card payment needs a reference from the card terminal');
      if (seen.has(p.reference)) throw new BadRequestException('The same card payment cannot be used twice');
      seen.add(p.reference);
      const charge = await manager.findOne(CardCharge, { where: { storeId, reference: p.reference }, lock: { mode: 'pessimistic_write' } });
      if (!charge || charge.status !== CardChargeStatus.APPROVED) throw new BadRequestException(`Card payment ${p.reference} was not approved by the card terminal`);
      if (charge.saleId) throw new BadRequestException(`Card payment ${p.reference} has already been used for another sale`);
      if (round2(charge.amount) !== round2(p.amount)) throw new BadRequestException(`Card payment ${p.reference} was approved for ${charge.amount.toFixed(2)}, not ${p.amount.toFixed(2)}`);
      claimed.push(charge);
    }
    return claimed;
  }

  async markUsed(manager: EntityManager, charges: CardCharge[], saleId: string) {
    for (const c of charges) c.saleId = saleId;
    if (charges.length) await manager.save(CardCharge, charges);
  }

  /** Sends money back to the card that paid. Returns the provider's refund reference. */
  async refundToCard(originalReference: string, amount: number, clientRef: string): Promise<string> {
    try {
      return (await this.provider.refund({ reference: originalReference, amount: round2(amount), clientRef })).reference;
    } catch (e: any) {
      this.log.error(`Card refund failed: ${e?.message}`);
      throw new BadGatewayException('The card refund did not go through. Nothing was refunded; try again or refund another way.');
    }
  }
}
