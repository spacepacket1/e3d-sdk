import { E3DError } from './errors.js';
import type { HttpClient } from './http.js';

const QUOTE_PATH = '/payments/credits/quote';
const PURCHASE_PATH = '/payments/credits/purchase';

export interface QuoteCreditsInput {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  promotionCode?: string;
  paymentMethod?: string;
}

export interface CreditPayment {
  id?: string;
  chain?: string;
  network?: string;
  chainId?: string | number;
  token?: string;
  tokenAddress?: string;
  treasuryAddress?: string;
  requiredAmount?: string | number;
  [key: string]: unknown;
}

export interface CreditQuote {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  payment: CreditPayment;
  paymentOptions?: CreditPayment[];
  [key: string]: unknown;
}

export type TransferCallback = (quote: CreditQuote) => Promise<string>;

export interface PurchaseCreditsInput {
  product: string;
  wallet: string;
  transfer: TransferCallback;
  requestedIssuedCredits?: number;
  promotionCode?: string;
  paymentMethod?: string;
  quote?: CreditQuote;
}

export interface PurchaseCreditsResult {
  creditKey: string;
  issuedCredits?: number;
  baseCredits?: number;
  paymentTxHash?: string;
  usage?: unknown;
  [key: string]: unknown;
}

interface ValidatedQuoteInput {
  product: string;
  wallet: string;
  requestedIssuedCredits: number;
  promotionCode?: string;
  paymentMethod?: string;
}

interface ValidatedPurchaseInput {
  product: string;
  wallet: string;
  transfer: TransferCallback;
  requestedIssuedCredits?: number;
  promotionCode?: string;
  paymentMethod?: string;
  quote?: CreditQuote;
}

function badRequest(message: string): E3DError {
  return new E3DError(message, 'BAD_REQUEST');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateTrimmedString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw badRequest(`${field} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw badRequest(`${field} must be a non-empty string`);
  }
  return trimmed;
}

function validateOptionalNonEmptyString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw badRequest(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw badRequest(`${field} must be a non-empty string when provided`);
  }
  return trimmed;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function validateRequestedIssuedCredits(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return value;
}

function validateTransfer(value: unknown): TransferCallback {
  if (typeof value !== 'function') {
    throw badRequest('transfer must be a function');
  }
  return value as TransferCallback;
}

function buildQuoteBody(request: ValidatedQuoteInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    product: request.product,
    wallet: request.wallet,
    requestedIssuedCredits: request.requestedIssuedCredits,
  };
  if (request.promotionCode !== undefined) {
    body.promotionCode = request.promotionCode;
  }
  return body;
}

function buildPurchaseBody(request: ValidatedPurchaseInput, quote: CreditQuote, txHash: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    product: request.product,
    wallet: request.wallet,
    txHash,
  };

  if (request.promotionCode !== undefined) {
    body.promotionCode = request.promotionCode;
  }

  const paymentId = normalizeOptionalString(quote.payment.id);
  if (paymentId !== undefined) {
    body.paymentMethod = paymentId;
  } else if (request.paymentMethod !== undefined) {
    body.paymentMethod = request.paymentMethod;
  }

  const paymentChain = normalizeOptionalString(quote.payment.chain);
  if (paymentChain !== undefined) {
    body.paymentChain = paymentChain;
  }

  return body;
}

function sanitizePayment(payment: unknown): CreditPayment | undefined {
  if (!isRecord(payment)) return undefined;
  return { ...payment } as CreditPayment;
}

function sanitizePaymentOptions(value: unknown): CreditPayment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const payments = value
    .map((entry) => sanitizePayment(entry))
    .filter((entry): entry is CreditPayment => entry !== undefined);
  return payments.length > 0 ? payments : undefined;
}

function hasNonEmptyValue(value: unknown): boolean {
  return value !== undefined && value !== null && !(typeof value === 'string' && !value.trim());
}

function getQuoteRequiredAmountFallback(quote: Record<string, unknown>): unknown {
  return quote.requiredWE3D ?? quote.requiredWe3d ?? quote.requiredE3D ?? quote.requiredE3d;
}

function resolveRequiredAmount(payment: CreditPayment, quote: Record<string, unknown>): CreditPayment {
  if (hasNonEmptyValue(payment.requiredAmount)) {
    return payment;
  }

  const fallback = getQuoteRequiredAmountFallback(quote);
  if (!hasNonEmptyValue(fallback)) {
    throw badRequest('quote payment requiredAmount is missing');
  }

  return { ...payment, requiredAmount: fallback as string | number };
}

function matchesPaymentSelector(payment: CreditPayment, selector: string): boolean {
  return [payment.id, payment.chain, payment.token].some((value) => normalizeOptionalString(value) === selector);
}

function selectPayment(
  rawQuote: Record<string, unknown>,
  payment: CreditPayment | undefined,
  paymentOptions: CreditPayment[] | undefined,
  selector: string | undefined,
): CreditPayment {
  if (selector !== undefined) {
    const matched = paymentOptions?.find((option) => matchesPaymentSelector(option, selector));
    if (!matched) {
      throw badRequest('paymentMethod did not match any available payment option');
    }
    return resolveRequiredAmount({ ...matched }, rawQuote);
  }

  if (payment !== undefined) {
    return resolveRequiredAmount({ ...payment }, rawQuote);
  }

  const firstOption = paymentOptions?.[0];
  if (firstOption !== undefined) {
    return resolveRequiredAmount({ ...firstOption }, rawQuote);
  }

  throw badRequest('quote payment is missing');
}

function normalizeQuoteResponse(rawQuote: unknown, request: ValidatedQuoteInput): CreditQuote {
  if (!isRecord(rawQuote)) {
    throw badRequest('quote response must be an object');
  }

  const paymentOptions = sanitizePaymentOptions(rawQuote.paymentOptions);
  const serverPayment = sanitizePayment(rawQuote.payment);
  const payment = selectPayment(rawQuote, serverPayment, paymentOptions, request.paymentMethod);

  const quote: CreditQuote = {
    ...rawQuote,
    product: normalizeOptionalString(rawQuote.product) ?? request.product,
    wallet: normalizeOptionalString(rawQuote.wallet) ?? request.wallet,
    requestedIssuedCredits:
      typeof rawQuote.requestedIssuedCredits === 'number'
      && Number.isFinite(rawQuote.requestedIssuedCredits)
      && Number.isInteger(rawQuote.requestedIssuedCredits)
      && rawQuote.requestedIssuedCredits > 0
        ? rawQuote.requestedIssuedCredits
        : request.requestedIssuedCredits,
    payment,
  };

  if (paymentOptions !== undefined) {
    quote.paymentOptions = paymentOptions;
  } else {
    delete quote.paymentOptions;
  }

  return quote;
}

function validateSuppliedQuote(rawQuote: CreditQuote, request: ValidatedPurchaseInput): CreditQuote {
  if (!isRecord(rawQuote)) {
    throw badRequest('quote must be an object');
  }

  const quoteProduct = validateTrimmedString(rawQuote.product, 'quote.product');
  const quoteWallet = validateTrimmedString(rawQuote.wallet, 'quote.wallet');
  const quoteCredits = validateRequestedIssuedCredits(rawQuote.requestedIssuedCredits, 'quote.requestedIssuedCredits');

  if (quoteProduct !== request.product) {
    throw badRequest('quote.product must match purchase product');
  }
  if (quoteWallet !== request.wallet) {
    throw badRequest('quote.wallet must match purchase wallet');
  }
  if (request.requestedIssuedCredits !== undefined && request.requestedIssuedCredits !== quoteCredits) {
    throw badRequest('requestedIssuedCredits must match the supplied quote');
  }

  const paymentOptions = sanitizePaymentOptions(rawQuote.paymentOptions);
  const serverPayment = sanitizePayment(rawQuote.payment);
  const payment = selectPayment(rawQuote, serverPayment, paymentOptions, request.paymentMethod);

  const normalizedQuote: CreditQuote = {
    ...rawQuote,
    product: quoteProduct,
    wallet: quoteWallet,
    requestedIssuedCredits: quoteCredits,
    payment,
  };

  if (paymentOptions !== undefined) {
    normalizedQuote.paymentOptions = paymentOptions;
  } else {
    delete normalizedQuote.paymentOptions;
  }

  return normalizedQuote;
}

function normalizePurchaseResult(rawResult: unknown): PurchaseCreditsResult {
  if (!isRecord(rawResult)) {
    throw badRequest('purchase response must be an object');
  }

  return {
    ...rawResult,
    creditKey: validateTrimmedString(rawResult.creditKey, 'creditKey'),
  };
}

function validateQuoteInput(input: QuoteCreditsInput): ValidatedQuoteInput {
  const validated: ValidatedQuoteInput = {
    product: validateTrimmedString(input.product, 'product'),
    wallet: validateTrimmedString(input.wallet, 'wallet'),
    requestedIssuedCredits: validateRequestedIssuedCredits(input.requestedIssuedCredits, 'requestedIssuedCredits'),
  };

  const promotionCode = validateOptionalNonEmptyString(input.promotionCode, 'promotionCode');
  if (promotionCode !== undefined) {
    validated.promotionCode = promotionCode;
  }

  const paymentMethod = validateOptionalNonEmptyString(input.paymentMethod, 'paymentMethod');
  if (paymentMethod !== undefined) {
    validated.paymentMethod = paymentMethod;
  }

  return validated;
}

function validatePurchaseInput(input: PurchaseCreditsInput): ValidatedPurchaseInput {
  const validated: ValidatedPurchaseInput = {
    product: validateTrimmedString(input.product, 'product'),
    wallet: validateTrimmedString(input.wallet, 'wallet'),
    transfer: validateTransfer(input.transfer),
  };

  if (input.requestedIssuedCredits !== undefined) {
    validated.requestedIssuedCredits = validateRequestedIssuedCredits(input.requestedIssuedCredits, 'requestedIssuedCredits');
  }

  const promotionCode = validateOptionalNonEmptyString(input.promotionCode, 'promotionCode');
  if (promotionCode !== undefined) {
    validated.promotionCode = promotionCode;
  }

  const paymentMethod = validateOptionalNonEmptyString(input.paymentMethod, 'paymentMethod');
  if (paymentMethod !== undefined) {
    validated.paymentMethod = paymentMethod;
  }

  if (input.quote !== undefined) {
    validated.quote = input.quote;
  }

  return validated;
}

export class PaymentsModule {
  constructor(private readonly http: HttpClient) {}

  async quoteCredits(request: QuoteCreditsInput): Promise<CreditQuote> {
    const validated = validateQuoteInput(request);
    const response = await this.http.post<Record<string, unknown>>(QUOTE_PATH, {
      body: buildQuoteBody(validated),
    });
    return normalizeQuoteResponse(response, validated);
  }

  async purchaseCredits(request: PurchaseCreditsInput): Promise<PurchaseCreditsResult> {
    const validated = validatePurchaseInput(request);
    const quote = validated.quote !== undefined
      ? validateSuppliedQuote(validated.quote, validated)
      : await this.quoteForPurchase(validated);
    const txHash = validateTrimmedString(await validated.transfer(quote), 'txHash');
    const response = await this.http.post<Record<string, unknown>>(PURCHASE_PATH, {
      body: buildPurchaseBody(validated, quote, txHash),
    });
    return normalizePurchaseResult(response);
  }

  private async quoteForPurchase(request: ValidatedPurchaseInput): Promise<CreditQuote> {
    if (request.requestedIssuedCredits === undefined) {
      throw badRequest('requestedIssuedCredits is required when quote is not supplied');
    }

    return this.quoteCredits({
      product: request.product,
      wallet: request.wallet,
      requestedIssuedCredits: request.requestedIssuedCredits,
      ...(request.promotionCode !== undefined ? { promotionCode: request.promotionCode } : {}),
      ...(request.paymentMethod !== undefined ? { paymentMethod: request.paymentMethod } : {}),
    });
  }
}
