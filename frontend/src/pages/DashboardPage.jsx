import React, { useMemo } from "react";
import SectionHeader from "../components/SectionHeader";
import StatusPill from "../components/StatusPill";
import AssistantActionButton from "../components/AssistantActionButton";

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

function KpiCard({ title, value, hint }) {
  return (
    <div className="card kpi">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
    </div>
  );
}

export default function DashboardPage({
  invoices = [],
  onCreateInvoice,
  onCollectPayment,
}) {
  const stats = useMemo(() => {
    const paid = invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + (i.amount || 0), 0);

    const outstanding = invoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((s, i) => s + (i.amount || 0), 0);

    const overdue = invoices
      .filter((i) => i.status === "overdue")
      .reduce((s, i) => s + (i.amount || 0), 0);

    return { paid, outstanding, overdue, count: invoices.length };
  }, [invoices]);

  const recent = useMemo(() => {
    return [...invoices]
      .sort((a, b) => (a.created < b.created ? 1 : -1))
      .slice(0, 5);
  }, [invoices]);

  const bars = [62, 48, 70, 55, 78, 66, 84];
  const max = Math.max(...bars);

  return (
    <div className="page">
      <SectionHeader
        title="dashboard"
        subtitle="real-time billing insights across invoices, subscriptions, and collections."
        right={
          <>
            <AssistantActionButton
              targetId="action.createInvoice"
              className="btn btn-ghost"
              onAction={() => onCreateInvoice?.()}
            >
              create invoice
            </AssistantActionButton>

            {onCollectPayment ? (
              <AssistantActionButton
                targetId="action.collectPayment"
                className="btn"
                onAction={() => onCollectPayment()}
              >
                collect payment
              </AssistantActionButton>
            ) : null}
          </>
        }
      />

      <div className="grid4">
        <KpiCard title="paid this month" value={formatMoney(stats.paid)} hint="settled invoices" />
        <KpiCard title="outstanding" value={formatMoney(stats.outstanding)} hint="sent + overdue" />
        <KpiCard title="overdue" value={formatMoney(stats.overdue)} hint="needs follow-up" />
        <KpiCard title="invoices" value={String(stats.count)} hint="total in view" />
      </div>

      <div className="grid2">
        <div className="card">
          <div className="cardTitle">recent invoices</div>

          <div className="list">
            {recent.map((inv) => (
              <div className="listItem" key={inv.id}>
                <div className="listLeft">
                  <div className="row">
                    <div className="strong">{inv.id}</div>
                    <StatusPill status={inv.status} />
                  </div>
                  <div className="muted small">
                    {inv.customer} • due {inv.due} • {inv.method}
                  </div>
                </div>

                <div className="listRight">
                  <div className="strong">{formatMoney(inv.amount, inv.currency)}</div>
                  <button className="btn btn-ghost" type="button">
                    view
                  </button>
                </div>
              </div>
            ))}

            {recent.length === 0 ? (
              <div className="muted small">no invoices yet</div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">collections (last 7 days)</div>

          <div className="bars">
            {bars.map((v, i) => (
              <div className="barCol" key={i} title={`day ${i + 1}: ${v}`}>
                <div className="bar" style={{ height: `${Math.round((v / max) * 100)}%` }} />
              </div>
            ))}
          </div>

          <div className="muted small barLegend">
            <span>lower</span>
            <span>higher</span>
          </div>
        </div>
      </div>
    </div>
  );
}
