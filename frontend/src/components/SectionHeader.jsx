import React from "react";

export default function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="sectionHeader">
      <div>
        <h2 className="h2">{title}</h2>
        {subtitle ? <div className="muted">{subtitle}</div> : null}
      </div>
      {right ? <div className="sectionRight">{right}</div> : null}
    </div>
  );
}
