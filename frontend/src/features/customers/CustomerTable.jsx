import React, { useCallback, useMemo } from "react";
import DataTable from "../../components/DataTable";
import StatusPill from "../../components/StatusPill";
import { useRegisterTarget } from "../../assistant/useRegisterTarget";
import { filterCustomers, findCustomerById } from "./customerSelectors";

export default function CustomerTable({
  customers = [],
  query = "",
  onOpenCustomer, // (customer) => void
}) {
  const rows = useMemo(() => filterCustomers(customers, query), [customers, query]);

  const openFirst = useCallback(() => {
    if (rows.length > 0) onOpenCustomer?.(rows[0]);
  }, [rows, onOpenCustomer]);

  const openById = useCallback(
    (custId) => {
      const c = findCustomerById(customers, custId);
      if (c) onOpenCustomer?.(c);
    },
    [customers, onOpenCustomer]
  );

  // Optional assistant targets for table actions
  useRegisterTarget("customers.table.openFirst", (cmd) => {
    if (cmd?.action === "click") openFirst();
  });

  useRegisterTarget("customers.table.openById", (cmd) => {
    if (cmd?.action === "type" || cmd?.action === "click") {
      openById(cmd?.args?.customer_id ?? cmd?.args?.id ?? cmd?.args?.text ?? cmd?.text);
    }
  });

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
        <button className="btn btn-ghost" type="button" onClick={() => onOpenCustomer?.(r)}>
          open
        </button>
      ),
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />;
}
