import { query } from '../db';
import { z } from 'zod';
import { config } from '../config';

// Validation schemas
export const recordSaleTransactionSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
  propertyId: z.string().uuid('Invalid property ID format'),
  builderId: z.string().uuid('Invalid builder ID format'),
  salePrice: z.number().positive('Sale price must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
});

export const recordDesignPurchaseSchema = z.object({
  designId: z.string().uuid('Invalid design ID format'),
  userId: z.string().uuid('Invalid user ID format'),
  builderId: z.string().uuid('Invalid builder ID format'),
  amount: z.number().positive('Amount must be positive').default(config.commission.designFee),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
});

export const getTransactionsSchema = z.object({
  builderId: z.string().uuid('Invalid builder ID format').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  transactionType: z.enum(['SALE', 'DESIGN_PURCHASE']).optional(),
});

// Types
export enum TransactionType {
  SALE = 'SALE',
  DESIGN_PURCHASE = 'DESIGN_PURCHASE',
}

export interface Transaction {
  id: string;
  partnerId: string;
  propertyId?: string;
  transactionType: TransactionType;
  amount: number;
  currency: string;
  commissionRate: number;
  commissionAmount: number;
  createdAt: Date;
}

/**
 * Calculate commission rate based on sale price (tiered)
 * - < $500K: 2%
 * - $500K - $1M: 1.5%
 * - > $1M: 1%
 */
export function calculateCommissionRate(salePrice: number): number {
  if (salePrice < config.commission.tier1Threshold) {
    return config.commission.tier1Rate;
  } else if (salePrice < config.commission.tier2Threshold) {
    return config.commission.tier2Rate;
  } else {
    return config.commission.tier3Rate;
  }
}

/**
 * Check if builder qualifies for new partner commission waiver
 */
async function checkNewPartnerWaiver(builderId: string): Promise<boolean> {
  const result = await query(
    `SELECT COUNT(*) as count 
     FROM transactions 
     WHERE builder_id = $1 AND transaction_type = 'sale'`,
    [builderId]
  );

  const saleCount = parseInt(result.rows[0].count, 10);
  return saleCount < config.commission.newPartnerWaiverCount;
}

/**
 * Record a sale transaction
 */
export async function recordSaleTransaction(
  leadId: string,
  propertyId: string,
  builderId: string,
  salePrice: number,
  currency: string = 'USD'
): Promise<Transaction> {
  // Validate input
  const validated = recordSaleTransactionSchema.parse({
    leadId,
    propertyId,
    builderId,
    salePrice,
    currency,
  });

  // Check for new partner waiver
  const hasWaiver = await checkNewPartnerWaiver(validated.builderId);
  
  // Calculate commission
  const commissionRate = hasWaiver ? 0 : calculateCommissionRate(validated.salePrice);
  const platformCommission = validated.salePrice * commissionRate;
  const builderPayout = validated.salePrice - platformCommission;

  // Insert transaction
  const result = await query<any>(
    `INSERT INTO transactions (
      lead_id, 
      builder_id, 
      transaction_type, 
      gross_amount, 
      commission_rate, 
      platform_commission, 
      builder_payout, 
      currency,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING 
      id, 
      builder_id as "partnerId",
      NULL as "propertyId",
      'SALE' as "transactionType",
      gross_amount as amount,
      currency,
      commission_rate as "commissionRate",
      platform_commission as "commissionAmount",
      created_at as "createdAt"`,
    [
      validated.leadId,
      validated.builderId,
      'sale',
      validated.salePrice,
      commissionRate,
      platformCommission,
      builderPayout,
      validated.currency,
    ]
  );

  // Update lead status to CONVERTED
  await query(
    `UPDATE leads SET status = 'CONVERTED' WHERE id = $1`,
    [validated.leadId]
  );

  return result.rows[0];
}

/**
 * Record a design purchase transaction
 */
export async function recordDesignPurchase(
  designId: string,
  userId: string,
  builderId: string,
  amount: number = config.commission.designFee,
  currency: string = 'USD'
): Promise<Transaction> {
  // Validate input
  const validated = recordDesignPurchaseSchema.parse({
    designId,
    userId,
    builderId,
    amount,
    currency,
  });

  // Calculate commission (30% to platform, 70% to builder)
  const platformCommission = validated.amount * (1 - config.commission.designBuilderSplit);
  const builderPayout = validated.amount * config.commission.designBuilderSplit;
  const commissionRate = 1 - config.commission.designBuilderSplit; // 0.3 (30%)

  // Insert transaction
  const result = await query<any>(
    `INSERT INTO transactions (
      design_id,
      builder_id,
      transaction_type,
      gross_amount,
      commission_rate,
      platform_commission,
      builder_payout,
      currency,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING 
      id,
      builder_id as "partnerId",
      NULL as "propertyId",
      'DESIGN_PURCHASE' as "transactionType",
      gross_amount as amount,
      currency,
      commission_rate as "commissionRate",
      platform_commission as "commissionAmount",
      created_at as "createdAt"`,
    [
      validated.designId,
      validated.builderId,
      'design',
      validated.amount,
      commissionRate,
      platformCommission,
      builderPayout,
      validated.currency,
    ]
  );

  return result.rows[0];
}

/**
 * Get transactions with optional filters
 */
export async function getTransactions(filters: {
  builderId?: string;
  startDate?: string;
  endDate?: string;
  transactionType?: 'SALE' | 'DESIGN_PURCHASE';
}): Promise<Transaction[]> {
  // Validate filters
  const validated = getTransactionsSchema.parse(filters);

  // Build query dynamically based on filters
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (validated.builderId) {
    conditions.push(`builder_id = $${paramIndex}`);
    params.push(validated.builderId);
    paramIndex++;
  }

  if (validated.startDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(validated.startDate);
    paramIndex++;
  }

  if (validated.endDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(validated.endDate);
    paramIndex++;
  }

  if (validated.transactionType) {
    const dbType = validated.transactionType === 'SALE' ? 'sale' : 'design';
    conditions.push(`transaction_type = $${paramIndex}`);
    params.push(dbType);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<any>(
    `SELECT 
      id,
      builder_id as "partnerId",
      NULL as "propertyId",
      CASE 
        WHEN transaction_type = 'sale' THEN 'SALE'
        WHEN transaction_type = 'design' THEN 'DESIGN_PURCHASE'
      END as "transactionType",
      gross_amount as amount,
      currency,
      commission_rate as "commissionRate",
      platform_commission as "commissionAmount",
      created_at as "createdAt"
    FROM transactions
    ${whereClause}
    ORDER BY created_at DESC`,
    params
  );

  return result.rows;
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
  // Validate transactionId format
  if (!z.string().uuid().safeParse(transactionId).success) {
    throw new Error('Invalid transaction ID format');
  }

  const result = await query<any>(
    `SELECT 
      id,
      builder_id as "partnerId",
      NULL as "propertyId",
      CASE 
        WHEN transaction_type = 'sale' THEN 'SALE'
        WHEN transaction_type = 'design' THEN 'DESIGN_PURCHASE'
      END as "transactionType",
      gross_amount as amount,
      currency,
      commission_rate as "commissionRate",
      platform_commission as "commissionAmount",
      created_at as "createdAt"
    FROM transactions
    WHERE id = $1`,
    [transactionId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}
