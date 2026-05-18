import React, { useCallback, useMemo } from "react";
import DataTable from "../../components/DataTable";
import StatusPill from "../../components/StatusPill";
import { useRegisterTarget } from "../../assistant/useRegisterTarget";
import { filterSubscriptions, findSubscriptionById } from "./subscriptionSelectors";

function formatMoney(amount, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export default function SubscriptionTable({
  subscriptions = [],
  query = "",
  onManageSubscription, // (subscription) => void
}) {
  const rows = useMemo(() => filterSubscriptions(subscriptions, query), [subscriptions, query]);

  const manageFirst = useCallback(() => {
    if (rows.length > 0) onManageSubscription?.(rows[0]);
  }, [rows, onManageSubscription]);

  const manageById = useCallback(
    (subId) => {
      const sub = findSubscriptionById(subscriptions, subId);
      if (sub) onManageSubscription?.(sub);
    },
    [subscriptions, onManageSubscription]
  );

  // Optional assistant targets for table actions
  useRegisterTarget("subscriptions.table.manageFirst", (cmd) => {
    if (cmd?.action === "click") manageFirst();
  });

  useRegisterTarget("subscriptions.table.manageById", (cmd) => {
    if (cmd?.action === "type" || cmd?.action === "click") {
      manageById(cmd?.args?.subscription_id ?? cmd?.args?.id ?? cmd?.args?.text ?? cmd?.text);
    }
  });

  const columns = [
    { key: "id", title: "subscription" },
    { key: "customer", title: "customer" },
    { key: "plan", title: "plan" },
    { key: "mrr", title: "mrr", render: (r) => <span className="strong">{formatMoney(r.mrr)}</span> },
    { key: "status", title: "status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action",
      title: "",
      render: (r) => (
        <button className="btn btn-ghost" type="button" onClick={() => onManageSubscription?.(r)}>
          manage
        </button>
      ),
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />;
}
