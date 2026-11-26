// Resolve Indian state names for GST (CGST+SGST vs IGST).
// States can arrive as a name ("Punjab", "PUNJAB"), a GST state code ("03"),
// a Tally-style "03-Punjab", or only be known through a GSTIN, whose first two
// digits are the state code.

export const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const NAME_ALIASES = {
  orissa: 'odisha',
  pondicherry: 'puducherry',
  'new delhi': 'delhi',
  'nct of delhi': 'delhi',
  'jammu & kashmir': 'jammu and kashmir',
  'andaman & nicobar islands': 'andaman and nicobar islands',
  uttaranchal: 'uttarakhand',
};

const rawState = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value.state) return String(value.state).trim();
  return '';
};

/** Turn any state value into a canonical lowercase name, or '' if unknown. */
export const canonicalState = (value) => {
  let s = rawState(value);
  if (!s) return '';
  // "03", "03-Punjab", "03 - Punjab"
  const codeMatch = s.match(/^(\d{2})\b\s*-?\s*(.*)$/);
  if (codeMatch) {
    if (GST_STATE_CODES[codeMatch[1]]) return GST_STATE_CODES[codeMatch[1]].toLowerCase();
    s = codeMatch[2];
  }
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s || s === 'n/a' || s === 'na' || s === 'not applicable') return '';
  return NAME_ALIASES[s] || s;
};

/** State name from a GSTIN (first two digits), or ''. */
export const stateFromGstin = (gstin) => {
  if (!gstin || typeof gstin !== 'string') return '';
  const code = gstin.trim().slice(0, 2);
  return GST_STATE_CODES[code] || '';
};

/** First non-empty state among the candidates, as a display name. */
export const firstState = (...candidates) => {
  for (const c of candidates) {
    const s = rawState(c);
    if (s && canonicalState(s)) {
      const code = s.match(/^(\d{2})\b/);
      return code && GST_STATE_CODES[code[1]] ? GST_STATE_CODES[code[1]] : s;
    }
  }
  return '';
};

export const companySellerState = (company) =>
  firstState(
    company?.companyState,
    company?.contactDetails?.address?.state,
    stateFromGstin(company?.gstin)
  );

/** Buyer state for a dealer/sub-dealer doc from Ledger, SubDealer or User. */
export const partyState = (doc) =>
  doc
    ? firstState(
        doc.SDState,
        doc.LedgerState,
        doc.address?.state,
        stateFromGstin(doc.SDGSTNNumber),
        stateFromGstin(doc.LedgerGSTIN),
        stateFromGstin(doc.gstin || doc.gstNumber)
      )
    : '';

export const determineGstType = (sellerState, buyerState) => {
  const s = canonicalState(sellerState);
  const b = canonicalState(buyerState);
  if (!s || !b) return 'UNKNOWN';
  return s === b ? 'INTRA_STATE' : 'INTER_STATE';
};

/** Human-readable warnings to return with an order when GST type is uncertain. */
export const gstWarnings = (sellerState, buyerState) => {
  const warnings = [];
  if (!canonicalState(sellerState)) {
    warnings.push('Company state is missing in the company profile, so IGST was applied. Add the company state (or GSTIN) to charge CGST + SGST on same-state orders.');
  }
  if (!canonicalState(buyerState)) {
    warnings.push('The buyer\'s state is missing, so IGST was applied. Add the dealer\'s state or GSTIN.');
  }
  return warnings;
};
