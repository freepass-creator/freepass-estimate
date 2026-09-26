// FreePass Estimate role/capability policy.
// This is a product feature gate, not server authentication.
// Any sensitive backend authorization belongs to Integration/Auth.

export const ROLE_GUEST = 'guest';
export const ROLE_STAFF = 'staff';

export const ROLE_FEATURES = Object.freeze({
  configure_vehicle: Object.freeze([ROLE_GUEST, ROLE_STAFF]),
  configure_public_conditions: Object.freeze([ROLE_GUEST, ROLE_STAFF]),
  share_quote: Object.freeze([ROLE_GUEST, ROLE_STAFF]),
  requote_shared_quote: Object.freeze([ROLE_GUEST, ROLE_STAFF]),

  edit_internal_credit: Object.freeze([ROLE_STAFF]),
  edit_internal_finance_terms: Object.freeze([ROLE_STAFF]),
  edit_delivery_region: Object.freeze([ROLE_STAFF]),
  edit_staff_identity: Object.freeze([ROLE_STAFF]),
  send_official_quote: Object.freeze([ROLE_STAFF]),
  share_signature_link: Object.freeze([ROLE_STAFF]),
});

export function normalizeRole(role) {
  return role === ROLE_STAFF ? ROLE_STAFF : ROLE_GUEST;
}

export function roleCan(role, feature) {
  const allowed = ROLE_FEATURES[feature];
  if (!allowed) return false;
  return allowed.includes(normalizeRole(role));
}

export function rolePolicy(role) {
  const normalized = normalizeRole(role);
  return Object.freeze({
    role: normalized,
    isStaff: normalized === ROLE_STAFF,
    canConfigureVehicle: roleCan(normalized, 'configure_vehicle'),
    canConfigurePublicConditions: roleCan(normalized, 'configure_public_conditions'),
    canShareQuote: roleCan(normalized, 'share_quote'),
    canRequoteSharedQuote: roleCan(normalized, 'requote_shared_quote'),
    canEditInternalCredit: roleCan(normalized, 'edit_internal_credit'),
    canEditInternalFinanceTerms: roleCan(normalized, 'edit_internal_finance_terms'),
    canEditDeliveryRegion: roleCan(normalized, 'edit_delivery_region'),
    canEditStaffIdentity: roleCan(normalized, 'edit_staff_identity'),
    canSendOfficialQuote: roleCan(normalized, 'send_official_quote'),
    canShareSignatureLink: roleCan(normalized, 'share_signature_link'),
  });
}


export function conditionDefaultsForRole(role, {
  staffDeposit = 10,
  guestDeposit = 0,
  prepay = 0,
  credit = '중신용',
} = {}) {
  const normalized = normalizeRole(role);
  return Object.freeze({
    credit,
    dep: normalized === ROLE_STAFF ? staffDeposit : guestDeposit,
    pre: prepay,
  });
}
