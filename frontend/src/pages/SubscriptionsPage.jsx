import React, { useState, useMemo } from "react";
import SectionHeader from "../components/SectionHeader";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import { matchesEntityAwareQuery } from "../utils/text";

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "active", label: "active" },
  { value: "past_due", label: "past due" },
  { value: "canceled", label: "canceled" },
];

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

export default function SubscriptionsPage({
  subscriptions = [],
  query = "",
  onCreatePlan,
  onUpdateSubscription,
}) {
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    customer: "",
    plan: "Starter",
    mrr: "",
    status: "active",
  });
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const rows = useMemo(() => {
    return subscriptions.filter((s) => {
      return matchesEntityAwareQuery({
        entity: "subscriptions",
        id: s.id,
        values: [s.id, s.plan, s.customer, s.status],
        query,
      });
    });
  }, [subscriptions, query]);

  function openSubscriptionEditor(row) {
    const subscriptionStatusValues = SUBSCRIPTION_STATUS_OPTIONS.map((x) => x.value);
    const rawStatus = String(row?.status || "active").trim().toLowerCase();
    const normalizedStatus = subscriptionStatusValues.includes(rawStatus) ? rawStatus : "active";

    setEditError("");
    setEditingSubscription(row);
    setSubscriptionForm({
      customer: String(row?.customer || ""),
      plan: String(row?.plan || "Starter"),
      mrr: String(row?.mrr ?? ""),
      status: normalizedStatus,
    });
  }

  function closeSubscriptionEditor() {
    if (editSubmitting) return;
    setEditingSubscription(null);
    setEditError("");
  }

  async function submitSubscriptionEditor(event) {
    event.preventDefault();
    if (!editingSubscription || editSubmitting) return;

    const customer = String(subscriptionForm.customer || "").trim();
    if (!customer) {
      setEditError("customer is required");
      return;
    }

    const mrr = Number(String(subscriptionForm.mrr || "").replace(/,/g, "").trim());
    if (!Number.isFinite(mrr) || mrr < 0) {
      setEditError("mrr must be 0 or higher");
      return;
    }

    setEditSubmitting(true);
    setEditError("");
    try {
      await onUpdateSubscription?.({
        subscription_id: editingSubscription.id,
        customer,
        plan: String(subscriptionForm.plan || "Starter").trim() || "Starter",
        mrr: Math.round(mrr),
        status: String(subscriptionForm.status || "active").trim() || "active",
      });
      setEditingSubscription(null);
    } catch (e) {
      setEditError(e?.message || "failed to update subscription");
    } finally {
      setEditSubmitting(false);
    }
  }

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
        <button className="btn btn-ghost" type="button" onClick={() => openSubscriptionEditor(r)}>
          manage
        </button>
      ),
    },
  ];

  return (
    <div className="page">
      <SectionHeader
        title="subscriptions"
        subtitle="manage recurring billing, upgrades, and dunning."
        right={
          <>
            <button className="btn" onClick={() => onCreatePlan?.()} type="button">
              create plan
            </button>
          </>
        }
      />

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />

      {editingSubscription ? (
        <div className="appModalOverlay" role="presentation" onClick={closeSubscriptionEditor}>
          <div
            className="appModalCard"
            role="dialog"
            aria-modal="true"
            aria-label={`edit subscription ${editingSubscription.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="appModalTitle">edit subscription {editingSubscription.id}</div>

            <form className="appModalForm" onSubmit={submitSubscriptionEditor}>
              <label className="label">
                customer id
                <input
                  className="input"
                  value={subscriptionForm.customer}
                  onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, customer: e.target.value }))}
                  placeholder="CUST-0001"
                  autoFocus
                />
              </label>
              <label className="label">
                plan
                <input
                  className="input"
                  value={subscriptionForm.plan}
                  onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, plan: e.target.value }))}
                  placeholder="Starter"
                />
              </label>
              <label className="label">
                mrr
                <input
                  className="input"
                  value={subscriptionForm.mrr}
                  onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, mrr: e.target.value }))}
                  inputMode="numeric"
                />
              </label>
              <label className="label">
                status
                <select
                  className="input"
                  value={subscriptionForm.status}
                  onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {SUBSCRIPTION_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              {editError ? <div className="appModalError">{editError}</div> : null}

              <div className="appModalActions">
                <button className="btn btn-ghost" type="button" onClick={closeSubscriptionEditor} disabled={editSubmitting}>
                  cancel
                </button>
                <button className="btn" type="submit" disabled={editSubmitting}>
                  {editSubmitting ? "saving..." : "save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
