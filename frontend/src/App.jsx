import React, { useCallback, useMemo, useState } from "react";
import "./App.css";

import AssistantWidget from "./assistant/AssistantWidget.jsx";

import SearchBox from "./components/SearchBox.jsx";
import SidebarNav from "./components/SidebarNav.jsx";

import DashboardPage from "./pages/DashboardPage.jsx";
import InvoicesPage from "./pages/InvoicesPage.jsx";
import SubscriptionsPage from "./pages/SubscriptionsPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

import { useBillingData } from "./data/BillingDataProvider.jsx";

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeId(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function pickFirst(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return undefined;
}

const FORM_MODAL = {
  NONE: "none",
  INVOICE: "invoice",
  CUSTOMER: "customer",
  SUBSCRIPTION: "subscription",
};

export default function App() {
  const tabs = useMemo(() => {
    return [
      {
        key: "dashboard",
        label: "dashboard",
        shortLabel: "DB",
        description: "overview and health",
        group: "workspace",
        groupLabel: "workspace",
      },
      {
        key: "invoices",
        label: "invoices",
        shortLabel: "IV",
        description: "billing queue",
        group: "workspace",
      },
      {
        key: "subscriptions",
        label: "subscriptions",
        shortLabel: "SU",
        description: "recurring revenue",
        group: "workspace",
      },
      {
        key: "customers",
        label: "customers",
        shortLabel: "CU",
        description: "accounts and tiers",
        group: "workspace",
      },
      {
        key: "reports",
        label: "reports",
        shortLabel: "RP",
        description: "snapshots and exports",
        group: "workspace",
      },
      {
        key: "settings",
        label: "settings",
        shortLabel: "ST",
        description: "workspace controls",
        group: "system",
        groupLabel: "system",
      },
    ];
  }, []);

  const [active, setActive] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [formModal, setFormModal] = useState(FORM_MODAL.NONE);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ customerId: "", amount: "" });
  const [customerForm, setCustomerForm] = useState({ name: "", tier: "", health: "" });
  const [subscriptionForm, setSubscriptionForm] = useState({
    customerRef: "",
    plan: "",
    mrr: "",
    status: "",
  });

  const {
    loading,
    error,
    settings,

    invoices,
    subscriptions,
    customers,

    createInvoice,
    updateInvoice,
    deleteInvoice,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    invoiceFilter,
    setInvoiceFilter,

    saveSettings,
  } = useBillingData();

  const company = useMemo(() => {
    return {
      name: settings?.company_name || "FluxBill",
      tagline: "billing & subscription management",
      email: "support@fluxbill.example",
      invoicePrefix: settings?.invoice_prefix || "INV",
    };
  }, [settings]);

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }, []);

  const handleSearchResultSelect = useCallback((result) => {
    const tab = String(result?.tab || "").trim().toLowerCase();
    if (!tab) return;
    setActive(tab);
  }, []);

  function closeFormModal() {
    if (formSubmitting) return;
    setFormModal(FORM_MODAL.NONE);
    setFormError("");
  }

  function handleCreateInvoice() {
    setFormError("");
    setInvoiceForm({ customerId: "", amount: "" });
    setFormModal(FORM_MODAL.INVOICE);
  }

  function handleAddCustomer() {
    setFormError("");
    setCustomerForm({ name: "", tier: "", health: "" });
    setFormModal(FORM_MODAL.CUSTOMER);
  }

  function handleCreatePlan() {
    setFormError("");
    setSubscriptionForm({ customerRef: "", plan: "", mrr: "", status: "" });
    setFormModal(FORM_MODAL.SUBSCRIPTION);
  }

  async function submitInvoiceForm(event) {
    event.preventDefault();
    if (formSubmitting) return;

    const customerCode = normalizeId(invoiceForm.customerId);
    if (!customerCode) {
      setFormError("company/customer id is required");
      return;
    }

    const amount = Number(String(invoiceForm.amount || "").replace(/,/g, "").trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("invoice amount must be greater than 0");
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    try {
      await createInvoice({
        customer_code: customerCode,
        amount: Math.round(amount),
        currency: "INR",
      });
      setActive("invoices");
      setFormModal(FORM_MODAL.NONE);
    } catch (e) {
      setFormError(e?.message || "failed to create invoice");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function submitCustomerForm(event) {
    event.preventDefault();
    if (formSubmitting) return;

    const name = String(customerForm.name || "").trim();
    if (!name) {
      setFormError("customer name is required");
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    try {
      await addCustomer({
        name,
        tier: String(customerForm.tier || "").trim() || "SMB",
        invoices: 0,
        status: String(customerForm.health || "").trim() || "new",
      });
      setActive("customers");
      setFormModal(FORM_MODAL.NONE);
    } catch (e) {
      setFormError(e?.message || "failed to add customer");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function submitSubscriptionForm(event) {
    event.preventDefault();
    if (formSubmitting) return;

    const customerRef = String(subscriptionForm.customerRef || "").trim();
    if (!customerRef) {
      setFormError("customer id or name is required");
      return;
    }

    const rawMrr = String(subscriptionForm.mrr || "").replace(/,/g, "").trim();
    const mrr = rawMrr === "" ? 0 : Number(rawMrr);
    if (!Number.isFinite(mrr) || mrr < 0) {
      setFormError("mrr must be 0 or higher");
      return;
    }

    const customerId = normalizeId(customerRef);
    const customerNameFromId = customerId
      ? customers.find((c) => normalizeId(c.id || c.code) === customerId)?.name
      : "";

    setFormSubmitting(true);
    setFormError("");
    try {
      await createSubscription({
        customer: customerNameFromId || customerRef,
        plan: String(subscriptionForm.plan || "").trim() || "Starter",
        mrr: Math.round(mrr),
        status: String(subscriptionForm.status || "").trim() || "active",
      });
      setActive("subscriptions");
      setFormModal(FORM_MODAL.NONE);
    } catch (e) {
      setFormError(e?.message || "failed to create subscription");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleSaveSettings(payload) {
    // payload expected: { companyName, invoicePrefix } from SettingsPage
    try {
      await saveSettings({
        company_name: payload.companyName,
        invoice_prefix: payload.invoicePrefix,
      });
      setActive("settings");
    } catch {
      // provider error state already set
    }
  }

  async function handleAssistantCommand(cmd) {
    if (!cmd?.action || cmd.action === "none") return false;
    const args = cmd.args || {};
    const action = String(cmd.action || "").trim().toLowerCase();

    function resolveCustomerId() {
      const directId = normalizeId(
        pickFirst(args.customer_id, args.customerId, args.customer_code, args.customerCode, args.id),
      );
      if (directId) return directId;

      const requestedName = normalizeText(
        pickFirst(args.name, args.customer_name, args.customerName, args.customer),
      );
      if (!requestedName) return "";

      const exact = customers.find((c) => normalizeText(c.name) === requestedName);
      if (exact) return normalizeId(exact.id || exact.code);

      const partial = customers.find((c) => {
        const name = normalizeText(c.name);
        return name.includes(requestedName) || requestedName.includes(name);
      });
      return partial ? normalizeId(partial.id || partial.code) : "";
    }

    function resolveSubscriptionId() {
      const directId = normalizeId(
        pickFirst(args.subscription_id, args.subscriptionId, args.sub_id, args.subscription, args.id),
      );
      if (directId) return directId;

      const requested = normalizeText(args.subscription);
      if (!requested) return "";

      const exact = subscriptions.find((s) => normalizeText(s.id) === requested);
      if (exact) return normalizeId(exact.id);

      const partial = subscriptions.find((s) => normalizeText(s.id).includes(requested));
      return partial ? normalizeId(partial.id) : "";
    }

    function resolveInvoiceId() {
      return normalizeId(
        pickFirst(args.invoice_id, args.invoiceId, args.invoice, args.code, args.id),
      );
    }

    if (action === "create_invoice") {
      const amount = Number(pickFirst(args.amount, args.total, args.value) ?? 0);
      await createInvoice({
        customer_code: pickFirst(args.customer_code, args.customerCode, args.customer_id, args.customerId),
        customer_name: pickFirst(args.customer_name, args.customerName, args.customer, args.name),
        amount: Number.isFinite(amount) && amount > 0 ? amount : 25000,
        currency: pickFirst(args.currency, args.ccy, "INR"),
        status: pickFirst(args.status, "draft"),
        method: pickFirst(args.method, "UPI"),
        due: args.due,
      });
      setActive("invoices");
      return true;
    }

    if (action === "update_invoice") {
      const invoiceId = resolveInvoiceId();
      if (!invoiceId) {
        throw new Error("invoice id is required for update");
      }
      await updateInvoice({
        invoice_id: invoiceId,
        customer_name: pickFirst(args.customer_name, args.customerName, args.customer),
        amount: pickFirst(args.amount, args.total, args.value),
        currency: pickFirst(args.currency, args.ccy),
        status: args.status,
        due: args.due,
        method: args.method,
      });
      setActive("invoices");
      return true;
    }

    if (action === "delete_invoice") {
      const invoiceId = resolveInvoiceId();
      if (!invoiceId) {
        throw new Error("invoice id is required for delete");
      }
      await deleteInvoice({ invoice_id: invoiceId });
      setActive("invoices");
      return true;
    }

    if (action === "filter_invoices") {
      await setInvoiceFilter({
        min_amount: pickFirst(args.min_amount, args.amount_min),
        max_amount: pickFirst(args.max_amount, args.amount_max),
      });
      setActive("invoices");
      return true;
    }

    if (action === "create_customer") {
      const customerName = String(
        pickFirst(args.name, args.customer_name, args.customerName, args.customer) || "",
      ).trim();
      if (!customerName) {
        throw new Error("customer name is required");
      }
      await addCustomer({
        name: customerName,
        tier: pickFirst(args.tier, "SMB"),
        status: pickFirst(args.status, "new"),
      });
      setActive("customers");
      return true;
    }

    if (action === "delete_customer") {
      const customerId = resolveCustomerId();
      if (!customerId) {
        throw new Error("customer id or name is required for delete");
      }
      await deleteCustomer({ customer_id: customerId });
      setActive("customers");
      return true;
    }

    if (action === "create_subscription") {
      const customerCode = normalizeId(
        pickFirst(args.customer_code, args.customerCode, args.customer_id, args.customerId),
      );
      const customerNameFromCode = customerCode
        ? customers.find((c) => normalizeId(c.id || c.code) === customerCode)?.name
        : undefined;

      await createSubscription({
        customer: pickFirst(args.customer_name, args.customerName, args.customer, customerNameFromCode),
        plan: pickFirst(args.plan, "Starter"),
        mrr: pickFirst(args.mrr, args.amount, 0),
        status: pickFirst(args.status, "active"),
      });
      setActive("subscriptions");
      return true;
    }

    if (action === "delete_subscription") {
      const subscriptionId = resolveSubscriptionId();
      if (!subscriptionId) {
        throw new Error("subscription id is required for delete");
      }
      await deleteSubscription({ subscription_id: subscriptionId });
      setActive("subscriptions");
      return true;
    }

    return false;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebarPanel">
          <div className="brandCard">
            <div className="brandCardIcon" aria-hidden="true">
              FB
            </div>
            <div className="brandText">
              <div className="brandName">{company.name}</div>
              <div className="muted small">{company.tagline}</div>
            </div>
          </div>

          <SidebarNav
            tabs={tabs}
            activeKey={active}
            onNavigate={setActive}
            className="nav nav-vertical"
          />
        </div>

        <div className="sidebarBottom">
          <div className="card sidebarPromo">
            <div className="cardTitle">billing control</div>
            <div className="muted">
              Invoice prefix <span className="strong">{company.invoicePrefix}</span> is active across
              your billing workspace.
            </div>
            <button className="btn btn-ghost" onClick={() => setActive("settings")} type="button">
              open settings
            </button>
          </div>

          <div className="sidebarProfile">
            <div className="sidebarAvatar" aria-hidden="true">
              AD
            </div>
            <div className="sidebarProfileMeta">
              <div className="strong">admin workspace</div>
              <div className="muted small">{company.email}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="appContent">
        <header className="topbar">
          <div className="topbarMeta">
            <div className="topbarEyebrow">billing workspace</div>
          </div>

          <div className="topbarSearch">
            <SearchBox
              value={query}
              onChange={setQuery}
              activeTab={active}
              onResultSelect={handleSearchResultSelect}
            />
          </div>

          <div className="topbarActions">
            <span className="pill pill-muted topbarDate">{todayLabel}</span>
            <button className="btn btn-ghost" title="alerts" aria-label="alerts" type="button">
              alerts
            </button>
            <button className="btn" title="account" aria-label="account" type="button">
              admin
            </button>
          </div>
        </header>

        <main className="main">
          <div className="mainInner">
            {loading ? (
              <div className="card">
                <div className="cardTitle">loading</div>
                <div className="muted">fetching data from database...</div>
              </div>
            ) : null}

            {error ? (
              <div className="card errorCard">
                <div className="cardTitle">data error</div>
                <div className="errorText">{error}</div>
              </div>
            ) : null}

            {!loading && active === "dashboard" ? (
              <DashboardPage invoices={invoices} onCreateInvoice={handleCreateInvoice} />
            ) : null}

            {!loading && active === "invoices" ? (
              <InvoicesPage
                invoices={invoices}
                query={query}
                onNewInvoice={handleCreateInvoice}
                onUpdateInvoice={updateInvoice}
                invoiceFilter={invoiceFilter}
                onSetInvoiceFilter={setInvoiceFilter}
              />
            ) : null}

            {!loading && active === "subscriptions" ? (
              <SubscriptionsPage
                subscriptions={subscriptions}
                query={query}
                onCreatePlan={handleCreatePlan}
                onUpdateSubscription={updateSubscription}
              />
            ) : null}

            {!loading && active === "customers" ? (
              <CustomersPage
                customers={customers}
                query={query}
                onAddCustomer={handleAddCustomer}
                onUpdateCustomer={updateCustomer}
              />
            ) : null}

            {!loading && active === "reports" ? <ReportsPage /> : null}

            {!loading && active === "settings" ? (
              <SettingsPage
                initialCompanyName={company.name}
                initialInvoicePrefix={company.invoicePrefix}
                onSave={handleSaveSettings}
              />
            ) : null}
          </div>
        </main>

        <footer className="footer">
          <div>
            <div className="strong">{company.name}</div>
            <div className="muted small">
              (c) {new Date().getFullYear()} {company.name}. all rights reserved.
            </div>
          </div>

          <div className="footerLinks">
            <button className="linkBtn" type="button">
              privacy
            </button>
            <button className="linkBtn" type="button">
              terms
            </button>
            <button className="linkBtn" type="button">
              status
            </button>
            <span className="pill pill-muted">contact: {company.email}</span>
          </div>
        </footer>
      </div>

      {formModal !== FORM_MODAL.NONE ? (
        <div className="appModalOverlay" role="presentation" onClick={closeFormModal}>
          <div
            className="appModalCard"
            role="dialog"
            aria-modal="true"
            aria-label={
              formModal === FORM_MODAL.INVOICE
                ? "create invoice"
                : formModal === FORM_MODAL.CUSTOMER
                  ? "add customer"
                  : "create plan"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="appModalTitle">
              {formModal === FORM_MODAL.INVOICE
                ? "new invoice"
                : formModal === FORM_MODAL.CUSTOMER
                  ? "add customer"
                  : "create plan"}
            </div>

            {formModal === FORM_MODAL.INVOICE ? (
              <form className="appModalForm" onSubmit={submitInvoiceForm}>
                <label className="label">
                  company/customer id
                  <input
                    className="input"
                    value={invoiceForm.customerId}
                    onChange={(e) => setInvoiceForm((prev) => ({ ...prev, customerId: e.target.value }))}
                    placeholder="CUS-0001"
                    autoFocus
                  />
                </label>
                <label className="label">
                  amount
                  <input
                    className="input"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="45000"
                    inputMode="numeric"
                  />
                </label>

                {formError ? <div className="appModalError">{formError}</div> : null}

                <div className="appModalActions">
                  <button className="btn btn-ghost" onClick={closeFormModal} type="button" disabled={formSubmitting}>
                    cancel
                  </button>
                  <button className="btn" type="submit" disabled={formSubmitting}>
                    {formSubmitting ? "saving..." : "create invoice"}
                  </button>
                </div>
              </form>
            ) : null}

            {formModal === FORM_MODAL.CUSTOMER ? (
              <form className="appModalForm" onSubmit={submitCustomerForm}>
                <label className="label">
                  customer name
                  <input
                    className="input"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="acme industries"
                    autoFocus
                  />
                </label>
                <label className="label">
                  tier
                  <input
                    className="input"
                    value={customerForm.tier}
                    onChange={(e) => setCustomerForm((prev) => ({ ...prev, tier: e.target.value }))}
                    placeholder="SMB"
                  />
                </label>
                <label className="label">
                  health
                  <input
                    className="input"
                    value={customerForm.health}
                    onChange={(e) => setCustomerForm((prev) => ({ ...prev, health: e.target.value }))}
                    placeholder="new"
                  />
                </label>

                {formError ? <div className="appModalError">{formError}</div> : null}

                <div className="appModalActions">
                  <button className="btn btn-ghost" onClick={closeFormModal} type="button" disabled={formSubmitting}>
                    cancel
                  </button>
                  <button className="btn" type="submit" disabled={formSubmitting}>
                    {formSubmitting ? "saving..." : "add customer"}
                  </button>
                </div>
              </form>
            ) : null}

            {formModal === FORM_MODAL.SUBSCRIPTION ? (
              <form className="appModalForm" onSubmit={submitSubscriptionForm}>
                <label className="label">
                  customer id or name
                  <input
                    className="input"
                    value={subscriptionForm.customerRef}
                    onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, customerRef: e.target.value }))}
                    placeholder="CUS-0001"
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
                    placeholder="12000"
                    inputMode="numeric"
                  />
                </label>
                <label className="label">
                  status
                  <input
                    className="input"
                    value={subscriptionForm.status}
                    onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, status: e.target.value }))}
                    placeholder="active"
                  />
                </label>

                {formError ? <div className="appModalError">{formError}</div> : null}

                <div className="appModalActions">
                  <button className="btn btn-ghost" onClick={closeFormModal} type="button" disabled={formSubmitting}>
                    cancel
                  </button>
                  <button className="btn" type="submit" disabled={formSubmitting}>
                    {formSubmitting ? "saving..." : "create plan"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      <AssistantWidget activeTab={active} onCommand={handleAssistantCommand} />
    </div>
  );
}
