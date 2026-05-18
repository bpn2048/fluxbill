import React from "react";
import SectionHeader from "../components/SectionHeader";

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

export default function ReportsPage() {
  return (
    <div className="page">
      <SectionHeader
        title="reports"
        subtitle="export revenue, collections, taxes, and reconciliation reports."
      />

      <div className="grid3">
        <div className="card">
          <div className="cardTitle">revenue summary</div>
          <div className="big">{formatMoney(1284500)}</div>
          <div className="muted small">gross revenue (last 30 days)</div>
          <div className="row mt">
            <button className="btn" type="button">open</button>
            <button className="btn btn-ghost" type="button">schedule</button>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">collections</div>
          <div className="big">{formatMoney(975000)}</div>
          <div className="muted small">payments collected (last 30 days)</div>
          <div className="row mt">
            <button className="btn" type="button">open</button>
            <button className="btn btn-ghost" type="button">compare</button>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">tax & gst</div>
          <div className="big">{formatMoney(153250)}</div>
          <div className="muted small">estimated tax (last 30 days)</div>
          <div className="row mt">
            <button className="btn" type="button">open</button>
            <button className="btn btn-ghost" type="button">download</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">notes</div>
        <div className="muted">
          connect this page to your data layer later to generate automated monthly statements and shareable links.
        </div>
      </div>
    </div>
  );
}
