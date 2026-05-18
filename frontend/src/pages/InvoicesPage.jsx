import React, { useEffect, useMemo, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import { matchesEntityAwareQuery } from "../utils/text";

const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "draft" },
  { value: "sent", label: "sent" },
  { value: "paid", label: "paid" },
  { value: "overdue", label: "overdue" },
];

const INVOICE_METHOD_OPTIONS = [
  { value: "-", label: "-" },
  { value: "UPI", label: "UPI" },
  { value: "Card", label: "Card" },
  { value: "NetBanking", label: "NetBanking" },
  { value: "Bank Transfer", label: "Bank Transfer" },
  { value: "Cash", label: "Cash" },
  { value: "Cheque", label: "Cheque" },
];

const STATUS_PROGRESS = {
  draft: 28,
  sent: 64,
  overdue: 82,
  paid: 100,
};

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

function formatDateLabel(value) {
  if (!value) return "not scheduled";
  const parsed = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function getDueState(value) {
  if (!value) return "No due date";

  const due = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(due.getTime())) return String(value);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diff < 0) {
    return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
  }
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due in 1 day";
  return `Due in ${diff} days`;
}

function isDueWithinWeek(value) {
  if (!value) return false;
  const due = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  return diff >= 0 && diff <= 7;
}

function getPriorityLabel(invoice) {
  const status = String(invoice?.status || "").toLowerCase();
  if (status === "paid") return "Settled";
  if (status === "overdue") return "Immediate follow-up";
  if (isDueWithinWeek(invoice?.due)) return "Due this week";
  if (status === "draft") return "Needs approval";
  return "In collection";
}

export default function InvoicesPage({
  invoices = [],
  query = "",
  onNewInvoice,
  onUpdateInvoice,
  invoiceFilter,
  onSetInvoiceFilter,
}) {
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filterError, setFilterError] = useState("");
  const [filterSubmitting, setFilterSubmitting] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [invoiceForm, setInvoiceForm] = useState({
    customer: "",
    amount: "",
    currency: "INR",
    status: "draft",
    due: "",
    method: "-",
  });
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const rows = useMemo(() => {
    return invoices.filter((invoice) => {
      return matchesEntityAwareQuery({
        entity: "invoices",
        id: invoice.id,
        values: [invoice.id, invoice.customer, invoice.status, invoice.method],
        query,
      });
    });
  }, [invoices, query]);

  const hasActiveFilter = useMemo(() => {
    const min = invoiceFilter?.min_amount;
    const max = invoiceFilter?.max_amount;
    return Number.isFinite(min) || Number.isFinite(max);
  }, [invoiceFilter]);

  const stats = useMemo(() => {
    const total = rows.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const paid = rows
      .filter((invoice) => String(invoice.status || "").toLowerCase() === "paid")
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const outstanding = rows
      .filter((invoice) => {
        const status = String(invoice.status || "").toLowerCase();
        return status === "sent" || status === "overdue" || status === "draft";
      })
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const dueSoonCount = rows.filter((invoice) => {
      const status = String(invoice.status || "").toLowerCase();
      return status !== "paid" && isDueWithinWeek(invoice.due);
    }).length;

    return {
      total,
      paid,
      outstanding,
      dueSoonCount,
    };
  }, [rows]);

  const selectedInvoice = useMemo(() => {
    return rows.find((invoice) => invoice.id === selectedInvoiceId) || rows[0] || null;
  }, [rows, selectedInvoiceId]);

  const selectionSummary = useMemo(() => {
    if (query) {
      return `${rows.length} invoice${rows.length === 1 ? "" : "s"} match "${query}"`;
    }
    return `${rows.length} invoice${rows.length === 1 ? "" : "s"} in the current view`;
  }, [query, rows.length]);

  useEffect(() => {
    const min = invoiceFilter?.min_amount;
    const max = invoiceFilter?.max_amount;
    setMinAmount(Number.isFinite(min) ? String(min) : "");
    setMaxAmount(Number.isFinite(max) ? String(max) : "");
  }, [invoiceFilter]);

  useEffect(() => {
    if (rows.length === 0) {
      if (selectedInvoiceId !== "") {
        setSelectedInvoiceId("");
      }
      return;
    }

    const exists = rows.some((invoice) => invoice.id === selectedInvoiceId);
    if (!exists) {
      setSelectedInvoiceId(rows[0].id);
    }
  }, [rows, selectedInvoiceId]);

  function parseAmount(value) {
    const text = String(value || "").replace(/,/g, "").trim();
    if (!text) return null;
    const amount = Number(text);
    if (!Number.isFinite(amount)) return Number.NaN;
    return amount;
  }

  async function applyFilters(event) {
    event.preventDefault();
    if (filterSubmitting) return;

    const min = parseAmount(minAmount);
    const max = parseAmount(maxAmount);

    if (Number.isNaN(min) || (min !== null && min < 0)) {
      setFilterError("min amount must be a valid number");
      return;
    }
    if (Number.isNaN(max) || (max !== null && max < 0)) {
      setFilterError("max amount must be a valid number");
      return;
    }
    if (min !== null && max !== null && min > max) {
      setFilterError("min amount cannot be greater than max amount");
      return;
    }

    setFilterSubmitting(true);
    setFilterError("");
    try {
      await onSetInvoiceFilter?.({ min_amount: min, max_amount: max });
    } catch (e) {
      setFilterError(e?.message || "failed to apply filters");
    } finally {
      setFilterSubmitting(false);
    }
  }

  async function clearFilters() {
    if (filterSubmitting) return;

    setFilterSubmitting(true);
    setFilterError("");
    try {
      await onSetInvoiceFilter?.({ min_amount: null, max_amount: null });
      setMinAmount("");
      setMaxAmount("");
    } catch (e) {
      setFilterError(e?.message || "failed to clear filters");
    } finally {
      setFilterSubmitting(false);
    }
  }

  function openInvoiceEditor(row) {
    const invoiceStatusValues = INVOICE_STATUS_OPTIONS.map((x) => x.value);
    const invoiceMethodValues = INVOICE_METHOD_OPTIONS.map((x) => x.value);

    const rawStatus = String(row?.status || "draft").trim().toLowerCase();
    const normalizedStatus = invoiceStatusValues.includes(rawStatus) ? rawStatus : "draft";
    const rawMethod = String(row?.method || "-").trim();
    const methodInsensitive = invoiceMethodValues.find(
      (value) => String(value).toLowerCase() === rawMethod.toLowerCase()
    );
    const normalizedMethod = invoiceMethodValues.includes(rawMethod)
      ? rawMethod
      : methodInsensitive || "-";

    setEditError("");
    setEditingInvoice(row);
    setInvoiceForm({
      customer: String(row?.customer || ""),
      amount: String(row?.amount ?? ""),
      currency: String(row?.currency || "INR"),
      status: normalizedStatus,
      due: String(row?.due || ""),
      method: normalizedMethod,
    });
  }

  function closeInvoiceEditor() {
    if (editSubmitting) return;
    setEditingInvoice(null);
    setEditError("");
  }

  async function submitInvoiceEditor(event) {
    event.preventDefault();
    if (!editingInvoice || editSubmitting) return;

    const amount = Number(String(invoiceForm.amount || "").replace(/,/g, "").trim());
    if (!Number.isFinite(amount) || amount < 0) {
      setEditError("amount must be 0 or higher");
      return;
    }

    const customer = String(invoiceForm.customer || "").trim();
    if (!customer) {
      setEditError("customer is required");
      return;
    }

    setEditSubmitting(true);
    setEditError("");
    try {
      await onUpdateInvoice?.({
        invoice_id: editingInvoice.id,
        customer,
        amount: Math.round(amount),
        currency: String(invoiceForm.currency || "INR").trim().toUpperCase(),
        status: String(invoiceForm.status || "draft").trim().toLowerCase(),
        due: String(invoiceForm.due || "").trim() || undefined,
        method: String(invoiceForm.method || "-").trim() || "-",
      });
      setEditingInvoice(null);
    } catch (e) {
      setEditError(e?.message || "failed to update invoice");
    } finally {
      setEditSubmitting(false);
    }
  }

  const columns = [
    { key: "id", title: "invoice" },
    { key: "customer", title: "customer" },
    {
      key: "amount",
      title: "amount",
      render: (row) => <span className="strong">{formatMoney(row.amount, row.currency)}</span>,
    },
    {
      key: "due",
      title: "due",
      render: (row) => formatDateLabel(row.due),
    },
    { key: "status", title: "status", render: (row) => <StatusPill status={row.status} /> },
    { key: "method", title: "method" },
    {
      key: "action",
      title: "",
      render: (row) => (
        <button
          className="btn btn-ghost"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openInvoiceEditor(row);
          }}
        >
          edit
        </button>
      ),
    },
  ];

  const selectedStatus = String(selectedInvoice?.status || "").toLowerCase();
  const selectedProgress = STATUS_PROGRESS[selectedStatus] ?? 50;

  return (
    <div className="page invoicePage">
      <SectionHeader
        title="invoices"
        subtitle="Create, track, and collect payments from a table-first workspace with a compact invoice summary."
        right={
          <>
            {hasActiveFilter ? (
              <button className="btn btn-ghost" onClick={clearFilters} type="button" disabled={filterSubmitting}>
                clear filters
              </button>
            ) : null}
            <button className="btn" onClick={() => onNewInvoice?.()} type="button">
              new invoice
            </button>
          </>
        }
      />

      <div className="grid4">
        <div className="card kpi">
          <div className="kpi-title">total billed</div>
          <div className="kpi-value">{formatMoney(stats.total)}</div>
          <div className="kpi-hint">{selectionSummary}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-title">collected</div>
          <div className="kpi-value">{formatMoney(stats.paid)}</div>
          <div className="kpi-hint">settled invoices in this view</div>
        </div>
        <div className="card kpi">
          <div className="kpi-title">open balance</div>
          <div className="kpi-value">{formatMoney(stats.outstanding)}</div>
          <div className="kpi-hint">draft, sent, and overdue invoices</div>
        </div>
        <div className="card kpi">
          <div className="kpi-title">due this week</div>
          <div className="kpi-value">{String(stats.dueSoonCount)}</div>
          <div className="kpi-hint">unpaid invoices needing attention</div>
        </div>
      </div>

      <div className="invoiceWorkspace invoiceWorkspaceTableFirst">
        <div className="invoiceQueueColumn">
          <div className="invoiceTableHeader">
            <div>
              <div className="cardTitle">invoice queue</div>
              <div className="muted small">{selectionSummary}</div>
            </div>
            {selectedInvoice ? (
              <span className="pill pill-muted invoiceSelectionPill">selected {selectedInvoice.id}</span>
            ) : null}
          </div>

          <form className="invoiceFilterBar" onSubmit={applyFilters}>
            <div className="invoiceFilterFields">
              <input
                aria-label="minimum amount"
                className="input invoiceFilterInput"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="enter minimum amount"
                inputMode="numeric"
              />

              <input
                aria-label="maximum amount"
                className="input invoiceFilterInput"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="enter maximum amount"
                inputMode="numeric"
              />
            </div>

            {filterError ? <div className="appModalError">{filterError}</div> : null}

            <div className="invoiceFilterActions invoiceFilterActionsInline">
              <button className="btn btn-ghost" onClick={clearFilters} type="button" disabled={filterSubmitting}>
                reset
              </button>
              <button className="btn" type="submit" disabled={filterSubmitting}>
                {filterSubmitting ? "applying..." : "apply"}
              </button>
            </div>
          </form>

          <DataTable
            className="card tableWrap invoiceQueueTable"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelectedInvoiceId(row.id)}
            rowClassName={(row) => {
              const classNames = ["tableRowInteractive"];
              if (selectedInvoice?.id === row.id) classNames.push("tableRowSelected");
              return classNames.join(" ");
            }}
          />
        </div>

        <aside className="invoiceSchematicColumn">
          {selectedInvoice ? (
            <div className="card invoiceSchematic">
              <div className="invoiceSchematicHeader">
                <div>
                  <div className="invoiceEyebrow">selected invoice</div>
                  <div className="invoiceSchematicTitle">{selectedInvoice.id}</div>
                </div>
                <StatusPill status={selectedInvoice.status} />
              </div>

              <div className="invoiceSchematicAmount">
                {formatMoney(selectedInvoice.amount, selectedInvoice.currency)}
              </div>
              <div className="invoiceSchematicNote">
                {selectedInvoice.customer} • {getDueState(selectedInvoice.due)}
              </div>

              <div className="invoiceSchematicGrid">
                <div className="invoiceMiniStat">
                  <div className="invoiceMiniStatLabel">customer</div>
                  <div className="invoiceMiniStatValue">{selectedInvoice.customer || "Unknown"}</div>
                </div>
                <div className="invoiceMiniStat">
                  <div className="invoiceMiniStatLabel">due date</div>
                  <div className="invoiceMiniStatValue">{formatDateLabel(selectedInvoice.due)}</div>
                </div>
                <div className="invoiceMiniStat">
                  <div className="invoiceMiniStatLabel">created</div>
                  <div className="invoiceMiniStatValue">{formatDateLabel(selectedInvoice.created)}</div>
                </div>
                <div className="invoiceMiniStat">
                  <div className="invoiceMiniStatLabel">payment method</div>
                  <div className="invoiceMiniStatValue">{selectedInvoice.method || "-"}</div>
                </div>
              </div>

              <div className="invoiceSchematicSection">
                <div className="invoiceSignalHeader">
                  <span className="invoiceOverviewLabel">priority</span>
                  <span className="invoiceOverviewValue">{getPriorityLabel(selectedInvoice)}</span>
                </div>

                <div className="invoiceSignalHeader">
                  <span className="invoiceOverviewLabel">settlement progress</span>
                  <span className="invoiceOverviewValue">{selectedProgress}%</span>
                </div>

                <div className="invoiceSignalTrack" aria-hidden="true">
                  <div className="invoiceSignalFill" style={{ width: `${selectedProgress}%` }} />
                </div>
              </div>

              <button className="btn" onClick={() => openInvoiceEditor(selectedInvoice)} type="button">
                edit invoice
              </button>
            </div>
          ) : (
            <div className="card invoiceEmptyState">
              No invoice is selected yet. Clear the filters or start a new invoice to populate this view.
            </div>
          )}
        </aside>
      </div>

      {editingInvoice ? (
        <div className="appModalOverlay" role="presentation" onClick={closeInvoiceEditor}>
          <div
            className="appModalCard"
            role="dialog"
            aria-modal="true"
            aria-label={`edit invoice ${editingInvoice.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="appModalTitle">edit invoice {editingInvoice.id}</div>

            <form className="appModalForm" onSubmit={submitInvoiceEditor}>
              <label className="label">
                customer
                <input
                  className="input"
                  value={invoiceForm.customer}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, customer: e.target.value }))}
                  placeholder="Acme Industries"
                  autoFocus
                />
              </label>
              <label className="label">
                amount
                <input
                  className="input"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))}
                  inputMode="numeric"
                />
              </label>
              <label className="label">
                currency
                <input
                  className="input"
                  value={invoiceForm.currency}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, currency: e.target.value }))}
                  placeholder="INR"
                />
              </label>
              <label className="label">
                status
                <select
                  className="input"
                  value={invoiceForm.status}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {INVOICE_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                due date
                <input
                  className="input"
                  type="date"
                  value={invoiceForm.due}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, due: e.target.value }))}
                />
              </label>
              <label className="label">
                method
                <select
                  className="input"
                  value={invoiceForm.method}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, method: e.target.value }))}
                >
                  {INVOICE_METHOD_OPTIONS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>

              {editError ? <div className="appModalError">{editError}</div> : null}

              <div className="appModalActions">
                <button className="btn btn-ghost" type="button" onClick={closeInvoiceEditor} disabled={editSubmitting}>
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
