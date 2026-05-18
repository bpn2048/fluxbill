import { matchesEntityAwareQuery, normalizeSearchValue } from "../../utils/text";

export function filterInvoices(invoices, query) {
  return (invoices || []).filter((i) => {
    return matchesEntityAwareQuery({
      entity: "invoices",
      id: i.id,
      values: [i.id, i.customer, i.status, i.method],
      query,
    });
  });
}

export function getInvoiceStats(invoices) {
  const list = invoices || [];
  const paid = list.filter((i) => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0);
  const outstanding = list
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + (i.amount || 0), 0);
  const overdue = list.filter((i) => i.status === "overdue").reduce((s, i) => s + (i.amount || 0), 0);

  return { paid, outstanding, overdue, count: list.length };
}

export function getRecentInvoices(invoices, limit = 5) {
  return [...(invoices || [])]
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .slice(0, limit);
}

export function findInvoiceById(invoices, invoiceId) {
  const id = normalizeSearchValue(invoiceId);
  if (!id) return null;
  return (
    (invoices || []).find((x) => normalizeSearchValue(x.id) === id) || null
  );
}
