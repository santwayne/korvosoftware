// frontend/src/utils/gst.ts
export type GstType = 'INTRA_STATE' | 'INTER_STATE' | 'UNKNOWN';

export const DEFAULT_GST_RATE = 18;

const safeNumber = (value: number | string | undefined | null, fallback = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

export const extractState = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.toString().trim();
};

// GST state codes: the first two digits of a GSTIN. Kept in step with
// backend/services/gstState.js.
const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

const NAME_ALIASES: Record<string, string> = {
  orissa: 'odisha',
  pondicherry: 'puducherry',
  'new delhi': 'delhi',
  'nct of delhi': 'delhi',
  'jammu & kashmir': 'jammu and kashmir',
  'andaman & nicobar islands': 'andaman and nicobar islands',
  uttaranchal: 'uttarakhand',
};

/** Canonical lowercase state name; accepts names, "03" and "03-Punjab". */
const normalizeState = (value?: string | null): string => {
  let s = extractState(value);
  if (!s) return '';
  const codeMatch = s.match(/^(\d{2})\b\s*-?\s*(.*)$/);
  if (codeMatch) {
    if (GST_STATE_CODES[codeMatch[1]]) return GST_STATE_CODES[codeMatch[1]].toLowerCase();
    s = codeMatch[2];
  }
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s || s === 'n/a' || s === 'na') return '';
  return NAME_ALIASES[s] || s;
};

export const stateFromGstin = (gstin?: string | null): string => {
  if (!gstin || typeof gstin !== 'string') return '';
  return GST_STATE_CODES[gstin.trim().slice(0, 2)] || '';
};

/** Seller state from the company profile: state, address state, then GSTIN. */
export const companySellerState = (company: any): string => {
  if (!company || typeof company !== 'object') return '';
  return (
    extractState(company.companyState) ||
    extractState(company?.contactDetails?.address?.state) ||
    stateFromGstin(company.gstin)
  );
};

/** Buyer state for a dealer (Ledger) or sub-dealer, including from its GSTIN. */
export const partyState = (party: any): string => {
  if (!party || typeof party !== 'object') return '';
  return (
    extractState(party.SDState) ||
    extractState(party.LedgerState) ||
    extractState(party?.address?.state) ||
    stateFromGstin(party.SDGSTNNumber) ||
    stateFromGstin(party.LedgerGSTIN) ||
    stateFromGstin(party.gstin)
  );
};

export const determineGstType = (
  sellerState?: string | null,
  buyerState?: string | null
): GstType => {
  const normalizedSeller = normalizeState(sellerState);
  const normalizedBuyer = normalizeState(buyerState);

  if (!normalizedSeller || !normalizedBuyer) {
    return 'UNKNOWN';
  }

  return normalizedSeller === normalizedBuyer ? 'INTRA_STATE' : 'INTER_STATE';
};

export interface GstComputationInput {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  gstRate?: number;
  gstType: GstType;
}

export interface GstComputationResult {
  baseAmount: number;
  discountAmount: number;
  taxableValue: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTaxAmount: number;
  lineTotal: number;
}

export const computeGstBreakdown = ({
  quantity,
  unitPrice,
  discountPercent = 0,
  gstRate = DEFAULT_GST_RATE,
  gstType,
}: GstComputationInput): GstComputationResult => {
  const qty = Math.max(0, safeNumber(quantity, 0));
  const price = Math.max(0, safeNumber(unitPrice, 0));
  const discountRate = Math.max(0, safeNumber(discountPercent, 0));
  const normalizedGstRate = Math.max(0, safeNumber(gstRate, DEFAULT_GST_RATE));

  const baseAmount = qty * price;
  const discountAmount = (baseAmount * discountRate) / 100;
  const taxableValue = Math.max(0, baseAmount - discountAmount);

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;

  if (gstType === 'INTRA_STATE') {
    cgstRate = normalizedGstRate / 2;
    sgstRate = normalizedGstRate / 2;
  } else if (gstType === 'INTER_STATE') {
    igstRate = normalizedGstRate;
  } else {
    igstRate = normalizedGstRate;
  }

  const cgstAmount = (taxableValue * cgstRate) / 100;
  const sgstAmount = (taxableValue * sgstRate) / 100;
  const igstAmount = (taxableValue * igstRate) / 100;
  const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
  const lineTotal = taxableValue + totalTaxAmount;

  return {
    baseAmount,
    discountAmount,
    taxableValue,
    gstRate: normalizedGstRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalTaxAmount,
    lineTotal,
  };
};

