export function normalizeQuery(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

// Character-order (substring) matching after whitespace normalization.
// Example: query "ab" matches "A B Corp", but not "a-x-b".
export function includesOrderedChars(value, query) {
  const q = normalizeQuery(query);
  if (!q) return true;
  return normalizeSearchValue(value).includes(q);
}

export function includesAny(haystackList, query) {
  return (haystackList || []).some((x) =>
    includesOrderedChars(x, query)
  );
}

const ENTITY_KEYWORDS = {
  invoices: ["invoice", "invoices", "inv"],
  subscriptions: ["subscription", "subscriptions", "sub"],
  customers: ["customer", "customers", "cust"],
};

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractEntityHints(query) {
  const lowered = String(query || "").trim().toLowerCase();
  if (!lowered) return new Set();

  const out = new Set();
  Object.entries(ENTITY_KEYWORDS).forEach(([entity, keywords]) => {
    const hasKeyword = keywords.some((keyword) => {
      return new RegExp(`\\b${escapeRegex(keyword)}\\b`).test(lowered);
    });
    if (hasKeyword) out.add(entity);
  });
  return out;
}

function extractReferenceDigits(query, hasEntityHints) {
  const lowered = String(query || "").trim().toLowerCase();
  if (!lowered) return null;

  const explicitMarker = /(?:\b(?:no|number)\b|#)/.test(lowered);
  if (!explicitMarker && !hasEntityHints) return null;

  const nums = lowered.match(/\d+/g) || [];
  if (nums.length === 0) return null;
  return nums[nums.length - 1];
}

function idSuffixDigits(rawId) {
  const m = String(rawId || "").trim().match(/(\d+)$/);
  if (!m) return null;
  return m[1];
}

function stripEntityNoise(query, removeDigits) {
  let out = String(query || "").toLowerCase();
  Object.values(ENTITY_KEYWORDS).forEach((keywords) => {
    keywords.forEach((keyword) => {
      out = out.replace(new RegExp(`\\b${escapeRegex(keyword)}\\b`, "g"), " ");
    });
  });
  out = out.replace(/\b(no|number)\b/g, " ").replace(/#/g, " ");
  if (removeDigits) out = out.replace(/\d+/g, " ");
  return out.replace(/\s+/g, " ").trim();
}

export function matchesEntityAwareQuery({
  entity,
  id,
  values = [],
  query,
}) {
  const raw = String(query || "").trim();
  if (!raw) return true;

  const entityKey = String(entity || "").trim().toLowerCase();
  const entityHints = extractEntityHints(raw);
  if (entityHints.size > 0 && entityKey && !entityHints.has(entityKey)) {
    return false;
  }

  const numberHint = extractReferenceDigits(raw, entityHints.size > 0);
  if (numberHint !== null) {
    const suffix = idSuffixDigits(id);
    if (suffix === null || !suffix.endsWith(numberHint)) {
      return false;
    }
  }

  const cleaned = stripEntityNoise(raw, numberHint !== null);
  if (!cleaned) {
    return true;
  }

  return includesAny(values, cleaned) || includesAny(values, raw);
}
