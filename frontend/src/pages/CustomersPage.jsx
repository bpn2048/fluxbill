import React, { useCallback, useMemo, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import SearchBox from "../components/SearchBox";
import { matchesEntityAwareQuery } from "../utils/text";

const CUSTOMER_TIER_OPTIONS = [
  { value: "SMB", label: "SMB" },
  { value: "Mid-market", label: "Mid-market" },
  { value: "Enterprise", label: "Enterprise" },
];

const CUSTOMER_HEALTH_OPTIONS = [
  { value: "new", label: "new" },
  { value: "active", label: "active" },
  { value: "at_risk", label: "at risk" },
  { value: "healthy", label: "healthy" },
];

function matchesCustomer(c, rawQuery) {
  return matchesEntityAwareQuery({
    entity: "customers",
    id: c.id,
    values: [c.id, c.name, c.tier, c.status],
    query: rawQuery,
  });
}

export default function CustomersPage({
  customers = [],
  query = "",
  onAddCustomer,
  onUpdateCustomer,
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    tier: "SMB",
    invoices: "0",
    status: "new",
  });
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const hasCustomerResultsForText = useCallback(
    (text) => {
      return customers.some((c) => matchesCustomer(c, text));
    },
    [customers]
  );

  const rows = useMemo(() => {
    const usePageSearch = String(customerSearch || "").trim() !== "";
    if (usePageSearch) {
      return customers.filter((c) => matchesCustomer(c, customerSearch));
    }
    return customers.filter((c) => matchesCustomer(c, query));
  }, [customers, query, customerSearch]);

  function openCustomerEditor(row) {
    const customerTierValues = CUSTOMER_TIER_OPTIONS.map((x) => x.value);
    const customerHealthValues = CUSTOMER_HEALTH_OPTIONS.map((x) => x.value);

    const rawTier = String(row?.tier || "SMB").trim();
    const normalizedTier = customerTierValues.includes(rawTier) ? rawTier : "SMB";
    const rawHealth = String(row?.status || "new").trim().toLowerCase();
    const normalizedHealth = customerHealthValues.includes(rawHealth) ? rawHealth : "new";

    setEditError("");
    setEditingCustomer(row);
    setCustomerForm({
      name: String(row?.name || ""),
      tier: normalizedTier,
      invoices: String(row?.invoices ?? 0),
      status: normalizedHealth,
    });
  }

  function closeCustomerEditor() {
    if (editSubmitting) return;
    setEditingCustomer(null);
    setEditError("");
  }

  async function submitCustomerEditor(event) {
    event.preventDefault();
    if (!editingCustomer || editSubmitting) return;

    const name = String(customerForm.name || "").trim();
    if (!name) {
      setEditError("customer name is required");
      return;
    }

    const invoices = Number(String(customerForm.invoices || "").replace(/,/g, "").trim());
    if (!Number.isFinite(invoices) || invoices < 0) {
      setEditError("invoices must be 0 or higher");
      return;
    }

    setEditSubmitting(true);
    setEditError("");
    try {
      await onUpdateCustomer?.({
        customer_id: editingCustomer.id,
        name,
        tier: String(customerForm.tier || "SMB").trim() || "SMB",
        invoices: Math.round(invoices),
        status: String(customerForm.status || "new").trim() || "new",
      });
      setEditingCustomer(null);
    } catch (e) {
      setEditError(e?.message || "failed to update customer");
    } finally {
      setEditSubmitting(false);
    }
  }

  const columns = [
    { key: "name", title: "customer" },
    { key: "id", title: "id" },
    { key: "tier", title: "tier" },
    { key: "invoices", title: "invoices" },
    { key: "status", title: "health", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action",
      title: "",
      render: (r) => (
        <button className="btn btn-ghost" type="button" onClick={() => openCustomerEditor(r)}>
          open
        </button>
      ),
    },
  ];

  return (
    <div className="page">
      <SectionHeader
        title="customers"
        subtitle="keep customer profiles, billing settings, and payment methods updated."
        right={
          <div className="customersPageActions">
            <div className="customersPageSearchWrap">
              <SearchBox
                value={customerSearch}
                onChange={setCustomerSearch}
                placeholder="search customers..."
                targetId="field.search.customers"
                className="input customersPageSearch"
                hasResultsForText={hasCustomerResultsForText}
              />
            </div>
            <button className="btn customersPageAddBtn" onClick={() => onAddCustomer?.()} type="button">
              add customer
            </button>
          </div>
        }
      />

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />

      {editingCustomer ? (
        <div className="appModalOverlay" role="presentation" onClick={closeCustomerEditor}>
          <div
            className="appModalCard"
            role="dialog"
            aria-modal="true"
            aria-label={`edit customer ${editingCustomer.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="appModalTitle">edit customer {editingCustomer.id}</div>

            <form className="appModalForm" onSubmit={submitCustomerEditor}>
              <label className="label">
                name
                <input
                  className="input"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="label">
                tier
                <select
                  className="input"
                  value={customerForm.tier}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, tier: e.target.value }))}
                >
                  {CUSTOMER_TIER_OPTIONS.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                invoices count
                <input
                  className="input"
                  value={customerForm.invoices}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, invoices: e.target.value }))}
                  inputMode="numeric"
                />
              </label>
              <label className="label">
                health
                <select
                  className="input"
                  value={customerForm.status}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {CUSTOMER_HEALTH_OPTIONS.map((health) => (
                    <option key={health.value} value={health.value}>
                      {health.label}
                    </option>
                  ))}
                </select>
              </label>

              {editError ? <div className="appModalError">{editError}</div> : null}

              <div className="appModalActions">
                <button className="btn btn-ghost" type="button" onClick={closeCustomerEditor} disabled={editSubmitting}>
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
