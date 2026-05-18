import React from "react";

export default function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();

  const cls =
    s === "paid" ? "pill pill-paid"
    : s === "sent" ? "pill pill-sent"
    : s === "overdue" ? "pill pill-overdue"
    : s === "draft" ? "pill pill-draft"
    : s === "active" ? "pill pill-paid"
    : s === "past_due" ? "pill pill-overdue"
    : s === "canceled" ? "pill pill-muted"
    : s === "healthy" ? "pill pill-paid"
    : s === "at_risk" ? "pill pill-overdue"
    : s === "new" ? "pill pill-sent"
    : "pill pill-muted";

  const label = String(status || "").replaceAll("_", " ");
  return <span className={cls}>{label}</span>;
}
