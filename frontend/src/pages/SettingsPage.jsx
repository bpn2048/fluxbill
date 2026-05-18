import React, { useEffect, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import StatusPill from "../components/StatusPill";

export default function SettingsPage({
  initialCompanyName = "FluxBill",
  initialInvoicePrefix = "INV",
  onSave,
}) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [invoicePrefix, setInvoicePrefix] = useState(initialInvoicePrefix);
  const [saving, setSaving] = useState(false);

  // keep inputs in sync when backend loaded values arrive
  useEffect(() => {
    setCompanyName(initialCompanyName || "FluxBill");
  }, [initialCompanyName]);

  useEffect(() => {
    setInvoicePrefix(initialInvoicePrefix || "INV");
  }, [initialInvoicePrefix]);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ companyName, invoicePrefix });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <SectionHeader
        title="settings"
        subtitle="configure branding, payment methods, taxes, and team access."
        right={
          <button className="btn" onClick={handleSave} type="button" disabled={saving}>
            {saving ? "saving..." : "save changes"}
          </button>
        }
      />

      <div className="grid2">
        <div className="card">
          <div className="cardTitle">branding</div>

          <label className="label">
            company name
            <input
              className="input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="company name"
            />
          </label>

          <label className="label">
            invoice prefix
            <input
              className="input"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              placeholder="INV"
              maxLength={10}
            />
          </label>

          <div className="muted small">
            tip: add your logo and brand colors for customer-facing invoices.
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">payments</div>

          <div className="settingRow">
            <div>
              <div className="strong">cards</div>
              <div className="muted small">visa, mastercard, rupay</div>
            </div>
            <StatusPill status="active" />
          </div>

          <div className="settingRow">
            <div>
              <div className="strong">upi</div>
              <div className="muted small">instant payments</div>
            </div>
            <StatusPill status="active" />
          </div>

          <div className="settingRow">
            <div>
              <div className="strong">netbanking</div>
              <div className="muted small">supported banks</div>
            </div>
            <StatusPill status="active" />
          </div>
        </div>
      </div>
    </div>
  );
}
