/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/apiClient.js";

const BillingDataContext = createContext(null);
const DEFAULT_CURRENCY = "INR";

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeInvoiceFilter(input = {}) {
  const min = input?.min_amount ?? input?.amount_min ?? null;
  const max = input?.max_amount ?? input?.amount_max ?? null;
  return {
    min_amount: min === null || min === undefined || min === "" ? null : Number(min),
    max_amount: max === null || max === undefined || max === "" ? null : Number(max),
  };
}

function normalizeCurrency(input) {
  const normalized = String(input ?? "").trim().toUpperCase();
  return normalized || DEFAULT_CURRENCY;
}

export function BillingDataProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState({ company_name: "FluxBill", invoice_prefix: "INV" });
  const [customers, setCustomers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [invoiceFilter, setInvoiceFilter] = useState({ min_amount: null, max_amount: null });

  async function refreshInvoices(filt = invoiceFilter) {
    const normalizedFilter = normalizeInvoiceFilter(filt);
    const list = await api.listInvoices(normalizedFilter);
    const inv = (list || []).map((x) => ({ ...x, id: x.id || x.code }));
    setInvoices(inv);
  }

  async function setInvoiceFilterAndRefresh(filt = {}) {
    const normalizedFilter = normalizeInvoiceFilter(filt);
    setInvoiceFilter(normalizedFilter);
    await refreshInvoices(normalizedFilter);
  }

  async function refresh() {
    setError("");
    try {
      const data = await api.initialState();
      setSettings(data.settings || { company_name: "FluxBill", invoice_prefix: "INV" });

      const cust = (data.customers || []).map((x) => ({ ...x, id: x.id || x.code }));
      const subs = (data.subscriptions || []).map((x) => ({ ...x, id: x.id || x.code }));

      setCustomers(cust);
      setSubscriptions(subs);

      // invoices are fetched separately so filters can be applied
      await refreshInvoices(invoiceFilter);
    } catch (e) {
      setError(e?.message || "failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    function onRefresh() {
      refresh();
    }

    function onSetFilter(e) {
      const filt = e?.detail || { min_amount: null, max_amount: null };
      setInvoiceFilterAndRefresh(filt).catch((err) => setError(err?.message || "failed to apply filter"));
    }

    window.addEventListener("billing:refresh", onRefresh);
    window.addEventListener("billing:setInvoiceFilter", onSetFilter);

    return () => {
      window.removeEventListener("billing:refresh", onRefresh);
      window.removeEventListener("billing:setInvoiceFilter", onSetFilter);
    };
  }, [invoiceFilter]);

  async function createInvoice(payload) {
    setError("");
    try {
      const customerNameRaw = (
        payload?.customer_name ??
        payload?.customer ??
        payload?.customerName ??
        ""
      ).trim();
      const customerName = customerNameRaw.toLowerCase();

      let customer_code = (
        payload?.customer_code ??
        payload?.customerCode ??
        payload?.customer_id ??
        payload?.customerId ??
        ""
      ).trim();

      if (!customer_code && customerName) {
        const found = customers.find((c) => (c.name || "").toLowerCase() === customerName);
        if (found) customer_code = found.id || found.code;
      }
      if (!customer_code && customers.length > 0) customer_code = customers[0].id || customers[0].code;
      if (!customer_code) throw new Error("no customers exist yet, add a customer first");

      const amount = Number(payload?.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("invoice amount must be greater than 0");
      }

      await api.createInvoice({
        customer_code,
        customer: customerNameRaw || undefined,
        customer_name: customerNameRaw || undefined,
        amount,
        currency: normalizeCurrency(payload?.currency),
        due: payload?.due || addDaysISO(14),
        method: payload?.method || "UPI",
        status: payload?.status || "draft",
      });

      await refresh();
    } catch (e) {
      setError(e?.message || "failed to create invoice");
      throw e;
    }
  }

  async function updateInvoice(payload) {
    setError("");
    try {
      const invoiceCode = (
        payload?.invoiceId ??
        payload?.invoice_id ??
        payload?.id ??
        ""
      ).trim();
      if (!invoiceCode) throw new Error("no invoice selected");

      const body = {};
      if (payload?.customer !== undefined || payload?.customer_name !== undefined) {
        body.customer = (payload?.customer ?? payload?.customer_name ?? "").trim();
      }
      if (payload?.amount !== undefined) {
        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount < 0) throw new Error("invalid invoice amount");
        body.amount = amount;
      }
      if (payload?.currency !== undefined) body.currency = normalizeCurrency(payload.currency);
      if (payload?.status !== undefined) body.status = String(payload.status || "").trim().toLowerCase();
      if (payload?.due !== undefined) body.due = payload.due;
      if (payload?.method !== undefined) body.method = String(payload.method || "").trim();

      await api.updateInvoice(invoiceCode, body);
      await refresh();
    } catch (e) {
      setError(e?.message || "failed to update invoice");
      throw e;
    }
  }

  async function deleteInvoice(payload) {
    setError("");
    try {
      const invoiceCode = (
        payload?.invoiceId ??
        payload?.invoice_id ??
        payload?.id ??
        ""
      ).trim();
      if (!invoiceCode) throw new Error("no invoice selected");
      await api.deleteInvoice(invoiceCode);
      await refresh();
    } catch (e) {
      setError(e?.message || "failed to delete invoice");
      throw e;
    }
  }

  async function addCustomer(payload) {
    setError("");
    try {
      const name = (payload?.name || "").trim();
      if (!name) throw new Error("customer name is required");

      await api.addCustomer({
        name,
        tier: payload?.tier || "SMB",
        status: payload?.status || "new",
      });

      await refresh();
    } catch (e) {
      setError(e?.message || "failed to add customer");
      throw e;
    }
  }

  async function updateCustomer(payload) {
    setError("");
    try {
      const customerId = (
        payload?.customer_id ??
        payload?.customerId ??
        payload?.id ??
        ""
      ).trim();
      if (!customerId) throw new Error("customer id is required");

      const body = {};
      if (payload?.name !== undefined) body.name = String(payload.name || "").trim();
      if (payload?.tier !== undefined) body.tier = payload.tier;
      if (payload?.status !== undefined) body.status = payload.status;
      if (payload?.invoices !== undefined) body.invoices = Number(payload.invoices ?? 0);

      await api.updateCustomer(customerId, body);
      await refresh();
    } catch (e) {
      setError(e?.message || "failed to update customer");
      throw e;
    }
  }

  async function deleteCustomer(payload) {
    setError("");
    try {
      const customerId = (
        payload?.customer_id ??
        payload?.customerId ??
        payload?.id ??
        ""
      ).trim();
      if (!customerId) throw new Error("customer id is required");

      await api.deleteCustomer(customerId);
      await refresh();
    } catch (e) {
      setError(e?.message || "failed to delete customer");
      throw e;
    }
  }

  async function createSubscription(payload) {
    setError("");
    try {
      const customer = (
        payload?.customer ??
        payload?.customer_name ??
        payload?.customerName ??
        ""
      ).trim();
      if (!customer) throw new Error("customer is required");

      await api.createSubscription({
        customer,
        plan: payload?.plan || "Starter",
        mrr: Number(payload?.mrr ?? 0),
        status: payload?.status || "active",
      });

      await refresh();
    } catch (e) {
      setError(e?.message || "failed to create subscription");
      throw e;
    }
  }

  async function updateSubscription(payload) {
    setError("");
    try {
      const subscriptionId = (
        payload?.subscription_id ??
        payload?.subscriptionId ??
        payload?.id ??
        ""
      ).trim();
      if (!subscriptionId) throw new Error("subscription id is required");

      const body = {};
      if (payload?.plan !== undefined) body.plan = payload.plan;
      if (payload?.customer !== undefined || payload?.customer_name !== undefined) {
        body.customer = (payload?.customer ?? payload?.customer_name ?? "").trim();
      }
      if (payload?.mrr !== undefined) body.mrr = Number(payload.mrr ?? 0);
      if (payload?.status !== undefined) body.status = payload.status;

      await api.updateSubscription(subscriptionId, body);
      await refresh();
    } catch (e) {
      setError(e?.message || "failed to update subscription");
      throw e;
    }
  }

  async function deleteSubscription(payload) {
    setError("");
    try {
      const subscriptionId = (
        payload?.subscription_id ??
        payload?.subscriptionId ??
        payload?.id ??
        ""
      ).trim();
      if (!subscriptionId) throw new Error("subscription id is required");

      await api.deleteSubscription(subscriptionId);
      await refresh();
    } catch (e) {
      setError(e?.message || "failed to delete subscription");
      throw e;
    }
  }

  async function saveSettings(payload) {
    setError("");
    try {
      const saved = await api.saveSettings(payload);
      setSettings(saved);
      await refresh();
    } catch (e) {
      setError(e?.message || "failed to save settings");
      throw e;
    }
  }

  const value = useMemo(() => {
    return {
      loading,
      error,
      settings,
      invoices,
      subscriptions,
      customers,

      invoiceFilter,

      refresh,
      refreshInvoices,
      setInvoiceFilter: setInvoiceFilterAndRefresh,

      createInvoice,
      updateInvoice,
      deleteInvoice,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      createSubscription,
      updateSubscription,
      deleteSubscription,
      saveSettings,
    };
  }, [
    loading,
    error,
    settings,
    invoices,
    subscriptions,
    customers,
    invoiceFilter,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    saveSettings,
  ]);

  return <BillingDataContext.Provider value={value}>{children}</BillingDataContext.Provider>;
}

export function useBillingData() {
  const ctx = useContext(BillingDataContext);
  if (!ctx) throw new Error("useBillingData must be used inside BillingDataProvider");
  return ctx;
}
