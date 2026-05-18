import { matchesEntityAwareQuery, normalizeSearchValue } from "../../utils/text";

export function filterSubscriptions(subscriptions, query) {
  return (subscriptions || []).filter((s) => {
    return matchesEntityAwareQuery({
      entity: "subscriptions",
      id: s.id,
      values: [s.id, s.plan, s.customer, s.status],
      query,
    });
  });
}

export function findSubscriptionById(subscriptions, subId) {
  const id = normalizeSearchValue(subId);
  if (!id) return null;
  return (
    (subscriptions || []).find((x) => normalizeSearchValue(x.id) === id) || null
  );
}

export function getSubscriptionStats(subscriptions) {
  const list = subscriptions || [];
  const active = list.filter((s) => s.status === "active").length;
  const pastDue = list.filter((s) => s.status === "past_due").length;
  const canceled = list.filter((s) => s.status === "canceled").length;
  const mrr = list.reduce((sum, s) => sum + (s.mrr || 0), 0);
  return { active, pastDue, canceled, mrr, count: list.length };
}
