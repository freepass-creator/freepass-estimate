// FreePass new-car configuration resolver.
// Separates immutable vehicle identity from manufacturer configuration axes
// that can change through a paid option (AWD/4WD, seat count, etc.).

const S = (v) => String(v ?? '').trim();

export function driveClass(v) {
  const s = S(v).toUpperCase();
  if (/AWD|4WD|4MATIC|4MOTION|XDRIVE|QUATTRO|HTRAC|사륜/.test(s)) return 'all';
  if (/FWD|전륜/.test(s)) return 'front';
  if (/RWD|후륜/.test(s)) return 'rear';
  if (/2WD/.test(s)) return 'two';
  return '';
}

export function optionAxisEffect(option) {
  const name = S(option?.name);
  if (!name) return null;

  // Only the option NAME defines a configuration axis.
  // Descriptions often mention seats/drive as explanatory text and must not mutate identity.
  const seat = /^(\d{1,2})\s*인승(?:\b|\s|\(|$)/.exec(name);
  if (seat) return { axis: 'seats', value: Number(seat[1]) };

  if (/^(?:전자식\s*)?(?:AWD|4WD)\b/i.test(name)
      || /^HTRAC\b/i.test(name)
      || /^(?:듀얼\s*모터\s*)4WD\b/i.test(name)) {
    return { axis: 'drivetrain', value: 'all' };
  }
  if (/^2WD\b/i.test(name)) return { axis: 'drivetrain', value: 'two' };
  return null;
}

export function configurationAxes(trim, optionsMaster, selectedOptionIds) {
  const base = trim?._base_axes || {};
  const out = {
    drivetrain: base.drivetrain || '',
    seats: base.seats ?? null,
    body_configuration: base.body_configuration || '',
  };
  const axisOptionIds = [];

  for (const id of selectedOptionIds || []) {
    const opt = optionsMaster?.[id];
    const effect = optionAxisEffect(opt);
    if (!effect) continue;
    axisOptionIds.push(id);
    if (effect.axis === 'drivetrain') out.drivetrain = effect.value;
    if (effect.axis === 'seats') out.seats = effect.value;
  }

  return { ...out, axisOptionIds };
}

function candidateDriveClass(candidate) {
  const raw = S(candidate?.drivetrain);
  if (['all','two','front','rear'].includes(raw)) return raw;
  return driveClass(raw || candidate?.group || '');
}
function candidateDriveMatches(candidate, wanted) {
  if (!wanted) return true;
  const got = candidateDriveClass(candidate);
  if (wanted === 'all') return got === 'all';
  if (wanted === 'two') return got === 'two' || got === 'front' || got === 'rear' || got === '';
  return got === wanted;
}

export function resolveCanonicalIdentity(trim, optionsMaster, selectedOptionIds) {
  const axes = configurationAxes(trim, optionsMaster, selectedOptionIds);
  let candidates = [...(trim?._canonical_candidates || [])];

  if (axes.seats != null) {
    const exact = candidates.filter((c) => Number(c.seats) === Number(axes.seats));
    if (exact.length) candidates = exact;
  }
  if (axes.drivetrain) {
    const exact = candidates.filter((c) => candidateDriveMatches(c, axes.drivetrain));
    if (exact.length) candidates = exact;
  }
  if (axes.body_configuration) {
    const exact = candidates.filter((c) => S(c.body_configuration) === S(axes.body_configuration));
    if (exact.length) candidates = exact;
  }

  const exactTrim = candidates.filter((c) => c.trim_match === true);
  if (exactTrim.length === 1) {
    return { level: 'trim', ...axes, candidate: exactTrim[0] };
  }
  if (candidates.length === 1) {
    return { level: 'trim', ...axes, candidate: candidates[0] };
  }

  const families = new Map();
  for (const c of candidates) {
    const k = [c.master_id, c.powertrain_seq, c.sub_model, c.powertrain].join('|');
    if (!families.has(k)) families.set(k, c);
  }
  if (families.size === 1) {
    return { level: 'powertrain', ...axes, candidate: [...families.values()][0] };
  }

  return { level: 'configuration_family', ...axes, candidate: null, candidates };
}

export function resolveProviderCandidate(providerCandidates, axes) {
  let candidates = [...(providerCandidates || [])];
  if (axes?.seats != null) {
    const exact = candidates.filter((c) => c.seats != null && Number(c.seats) === Number(axes.seats));
    if (exact.length) candidates = exact;
    else {
      const generic = candidates.filter((c) => c.seats == null);
      if (generic.length) candidates = generic;
    }
  }
  if (axes?.drivetrain) {
    const exact = candidates.filter((c) => {
      const got = candidateDriveClass(c);
      return got && candidateDriveMatches(c, axes.drivetrain);
    });
    if (exact.length) candidates = exact;
    else {
      const generic = candidates.filter((c) => !candidateDriveClass(c));
      if (generic.length) candidates = generic;
    }
  }

  const trimExact = candidates.filter((c) => c.trim_match === true);
  if (trimExact.length === 1) return trimExact[0];
  if (candidates.length === 1) return candidates[0];
  return null;
}

export function absorbedAxisOptionIds(trim, optionsMaster, selectedOptionIds, providerCandidate) {
  if (!providerCandidate) return [];
  const { axisOptionIds } = configurationAxes(trim, optionsMaster, selectedOptionIds);
  return axisOptionIds.filter((id) => {
    const effect = optionAxisEffect(optionsMaster?.[id]);
    if (!effect) return false;
    if (effect.axis === 'drivetrain') return candidateDriveMatches(providerCandidate, effect.value);
    if (effect.axis === 'seats') return Number(providerCandidate.seats) === Number(effect.value);
    return false;
  });
}
