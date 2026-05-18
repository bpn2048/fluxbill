import React, { useCallback, useMemo } from "react";
import DataTable from "../../components/DataTable";
import StatusPill from "../../components/StatusPill";
import { useRegisterTarget } from "../../assistant/useRegisterTarget";
import { filterInvoices, findInvoiceById } from "./invoiceSelectors";

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

export default function InvoiceTable({
  invoices = [],
  query = "",
  onOpenInvoice, // (invoice) => void
}) {
  const rows = useMemo(() => filterInvoices(invoices, query), [invoices, query]);

  const openFirst = useCallback(() => {
    if (rows.length > 0) onOpenInvoice?.(rows[0]);
  }, [rows, onOpenInvoice]);

  const openById = useCallback(
    (invoiceId) => {
      const inv = findInvoiceById(invoices, invoiceId);
      if (inv) onOpenInvoice?.(inv);
    },
    [invoices, onOpenInvoice]
  );

  // Optional assistant targets for table actions
  useRegisterTarget("invoices.table.openFirst", (cmd) => {
    if (cmd?.action === "click") openFirst();
  });

  useRegisterTarget("invoices.table.openById", (cmd) => {
    if (cmd?.action === "type" || cmd?.action === "click") {
      openById(cmd?.args?.invoice_id ?? cmd?.args?.id ?? cmd?.args?.text ?? cmd?.text);
    }
  });

  const columns = [
    { key: "id", title: "invoice" },
    { key: "customer", title: "customer" },
    {
      key: "amount",
      title: "amount",
      render: (r) => <span className="strong">{formatMoney(r.amount, r.currency)}</span>,
    },
    { key: "created", title: "created" },
    { key: "due", title: "due" },
    { key: "status", title: "status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action",
      title: "",
      render: (r) => (
        <button className="btn btn-ghost" type="button" onClick={() => onOpenInvoice?.(r)}>
          open
        </button>
      ),
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />;
}
