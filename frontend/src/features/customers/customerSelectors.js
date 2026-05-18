import { matchesEntityAwareQuery, normalizeSearchValue } from "../../utils/text";

export function filterCustomers(customers, query) {
  return (customers || []).filter((c) => {
    return matchesEntityAwareQuery({
      entity: "customers",
      id: c.id,
      values: [c.id, c.name, c.tier, c.status],
      query,
    });
  });
}

export function findCustomerById(customers, custId) {
  const id = normalizeSearchValue(custId);
  if (!id) return null;
  return (
    (customers || []).find((x) => normalizeSearchValue(x.id) === id) || null
  );
}

export function getCustomerStats(customers) {
  const list = customers || [];
  const healthy = list.filter((c) => c.status === "healthy").length;
  const atRisk = list.filter((c) => c.status === "at_risk").length;
  const newlyAdded = list.filter((c) => c.status === "new").length;
  return { healthy, atRisk, newlyAdded, count: list.length };
}
