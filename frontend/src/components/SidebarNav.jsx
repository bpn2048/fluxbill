import React, { useEffect, useMemo } from "react";
import { useAssistantRegistry } from "../assistant/AssistantRegistry";

function toTitleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .trim();
}

export default function SidebarNav({
  tabs,
  activeKey,
  onNavigate,
  prefix = "nav",
  className = "nav",
}) {
  const registry = useAssistantRegistry();
  const groupedTabs = useMemo(() => {
    const groups = [];
    const seen = new Map();

    for (const tab of tabs) {
      const groupKey = String(tab?.group || "navigation").trim() || "navigation";
      if (!seen.has(groupKey)) {
        const nextGroup = {
          key: groupKey,
          label: String(tab?.groupLabel || toTitleCase(groupKey)).trim(),
          items: [],
        };
        seen.set(groupKey, nextGroup);
        groups.push(nextGroup);
      }
      seen.get(groupKey).items.push(tab);
    }

    return groups;
  }, [tabs]);

  useEffect(() => {
    const cleanups = [];

    for (const t of tabs) {
      const targetId = `${prefix}.${t.key}`;
      const cleanup = registry.register(targetId, (cmd) => {
        if (cmd?.action === "click") onNavigate(t.key);
      });
      cleanups.push(cleanup);
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [registry, tabs, onNavigate, prefix]);

  return (
    <nav className={className} aria-label="primary">
      {groupedTabs.map((group) => (
        <div className="navSection" key={group.key}>
          {group.label ? <div className="navSectionLabel">{group.label}</div> : null}

          <div className="navSectionItems">
            {group.items.map((t) => {
              const badge = String(
                t.shortLabel || String(t.label || "").slice(0, 2).toUpperCase()
              ).trim();

              return (
                <button
                  key={t.key}
                  className={activeKey === t.key ? "navBtn navBtnActive" : "navBtn"}
                  onClick={() => onNavigate(t.key)}
                  type="button"
                >
                  <span className="navBadge" aria-hidden="true">
                    {badge}
                  </span>

                  <span className="navMeta">
                    <span className="navLabel">{t.label}</span>
                    {t.description ? <span className="navHint">{t.description}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
