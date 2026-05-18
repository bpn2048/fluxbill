import React from "react";

export default function DataTable({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowClassName,
  className = "card tableWrap",
}) {
  function handleRowKeyDown(event, row, index) {
    if (!onRowClick) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onRowClick(row, index);
  }

  return (
    <div className={className}>
      <div className="tableScroll">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.title}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={rowKey ? rowKey(r, idx) : idx}
                className={rowClassName ? rowClassName(r, idx) : undefined}
                onClick={onRowClick ? () => onRowClick(r, idx) : undefined}
                onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, r, idx) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>
                ))}
              </tr>
            ))}

            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={columns.length} className="emptyCell">
                  no results
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
