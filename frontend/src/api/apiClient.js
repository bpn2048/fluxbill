// src/api/apiClient.js
const RAW_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_DATA_API_BASE ||
  "http://127.0.0.1:8000";

const BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json();
}

export const api = {
  initialState() {
    return request("/api/initial-state");
  },

  listInvoices({ min_amount, max_amount } = {}) {
    const params = new URLSearchParams();
    if (min_amount !== null && min_amount !== undefined) params.set("min_amount", String(min_amount));
    if (max_amount !== null && max_amount !== undefined) params.set("max_amount", String(max_amount));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/invoices${qs}`);
  },

  createInvoice(body) {
    return request("/api/invoices", { method: "POST", body: JSON.stringify(body) });
  },

  updateInvoice(invoiceCode, body) {
    return request(`/api/invoices/${encodeURIComponent(invoiceCode)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteInvoice(invoiceCode) {
    return request(`/api/invoices/${encodeURIComponent(invoiceCode)}`, { method: "DELETE" });
  },

  addCustomer(body) {
    return request("/api/customers", { method: "POST", body: JSON.stringify(body) });
  },

  updateCustomer(customerId, body) {
    return request(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  deleteCustomer(customerId) {
    return request(`/api/customers/${encodeURIComponent(customerId)}`, { method: "DELETE" });
  },

  listSubscriptions() {
    return request("/api/subscriptions");
  },

  createSubscription(body) {
    return request("/api/subscriptions", { method: "POST", body: JSON.stringify(body) });
  },

  updateSubscription(subscriptionId, body) {
    return request(`/api/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  deleteSubscription(subscriptionId) {
    return request(`/api/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
  },

  saveSettings(body) {
    return request("/api/settings", { method: "PATCH", body: JSON.stringify(body) });
  },

  search(q, { activeTab, limitPerTab = 6, signal } = {}) {
    const params = new URLSearchParams();
    params.set("q", String(q ?? "").trim());
    if (activeTab) params.set("active_tab", String(activeTab).trim().toLowerCase());
    if (limitPerTab !== null && limitPerTab !== undefined) {
      params.set("limit_per_tab", String(limitPerTab));
    }
    return request(`/api/search?${params.toString()}`, { signal });
  },
};
