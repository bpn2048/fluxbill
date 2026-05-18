import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/apiClient";
import { useRegisterTarget } from "../assistant/useRegisterTarget";
import "./SearchBox.css";

const DEFAULT_TABS = ["invoices", "customers", "subscriptions"];

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTabOrder(value) {
  const incoming = toArray(value)
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
  const known = incoming.filter((tab) => DEFAULT_TABS.includes(tab));
  const missing = DEFAULT_TABS.filter((tab) => !known.includes(tab));
  return [...known, ...missing];
}

function resolveTabFromResult(item, fallbackTab) {
  const rawTab = String(item?.tab || "").trim().toLowerCase();
  if (DEFAULT_TABS.includes(rawTab)) {
    return rawTab;
  }

  const rawTarget = String(item?.target || "").trim().toLowerCase();
  if (rawTarget.startsWith("field.search.")) {
    const parsed = rawTarget.slice("field.search.".length).trim();
    if (DEFAULT_TABS.includes(parsed)) {
      return parsed;
    }
  }

  const fallback = String(fallbackTab || "").trim().toLowerCase();
  return DEFAULT_TABS.includes(fallback) ? fallback : "";
}

export default function SearchBox({
  value,
  onChange,
  placeholder = "search invoices, customers, plans...",
  targetId = "field.search",
  className = "search",
  hasResultsForText,
  activeTab,
  showSlideout,
  limitPerTab = 6,
  onResultSelect,
}) {
  const query = String(value ?? "").trim();
  const isGlobalSearch = targetId === "field.search";
  const slideoutEnabled = Boolean(showSlideout ?? isGlobalSearch);
  const shouldRenderSlideout = slideoutEnabled && query.length > 0;
  const requestIdRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [tabOrder, setTabOrder] = useState(DEFAULT_TABS);
  const [byTab, setByTab] = useState({
    invoices: [],
    customers: [],
    subscriptions: [],
  });
  const [counts, setCounts] = useState({
    returnedTotal: 0,
    matchedTotal: 0,
  });

  const handler = useCallback(
    (cmd) => {
      if (!cmd) return;
      if (cmd.action === "type") {
        const text = cmd.args?.text ?? cmd.text ?? "";
        onChange(text);
        if (typeof hasResultsForText === "function") {
          return Boolean(hasResultsForText(text));
        }
        return true;
      }
      if (cmd.action === "click") {
        // optional: if you want focus behavior later, pass an inputRef and call ref.current.focus()
        return true;
      }
      return false;
    },
    [onChange, hasResultsForText]
  );

  useRegisterTarget(targetId, handler);

  useEffect(() => {
    if (!slideoutEnabled) {
      return;
    }

    if (!query) {
      requestIdRef.current += 1;
      setLoading(false);
      setSearchError("");
      setTabOrder(DEFAULT_TABS);
      setByTab({
        invoices: [],
        customers: [],
        subscriptions: [],
      });
      setCounts({
        returnedTotal: 0,
        matchedTotal: 0,
      });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const ctrl = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");

      try {
        const data = await api.search(query, {
          activeTab,
          limitPerTab,
          signal: ctrl.signal,
        });
        if (requestIdRef.current !== requestId) {
          return;
        }

        const incomingByTab = typeof data?.by_tab === "object" && data?.by_tab ? data.by_tab : {};
        const normalizedByTab = {
          invoices: toArray(incomingByTab.invoices),
          customers: toArray(incomingByTab.customers),
          subscriptions: toArray(incomingByTab.subscriptions),
        };

        setByTab(normalizedByTab);
        setTabOrder(normalizeTabOrder(data?.tab_order));
        setCounts({
          returnedTotal: Number(data?.counts?.returned_total ?? 0),
          matchedTotal: Number(data?.counts?.matched_total ?? 0),
        });
      } catch (err) {
        if (ctrl.signal.aborted || requestIdRef.current !== requestId) {
          return;
        }
        setSearchError(err?.message || "failed to fetch search results");
        setByTab({
          invoices: [],
          customers: [],
          subscriptions: [],
        });
        setCounts({
          returnedTotal: 0,
          matchedTotal: 0,
        });
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [slideoutEnabled, query, activeTab, limitPerTab]);

  const renderedCount = useMemo(() => {
    return tabOrder.reduce((acc, tab) => acc + toArray(byTab[tab]).length, 0);
  }, [byTab, tabOrder]);

  function renderSummary() {
    if (loading) return "searching...";
    if (searchError) return "results unavailable";
    if (renderedCount === 0) return "no matches";
    if (counts.matchedTotal > renderedCount) {
      return `${renderedCount} shown (${counts.matchedTotal} matched)`;
    }
    return `${renderedCount} results`;
  }

  function handleResultClick(item, sectionTab) {
    const tab = resolveTabFromResult(item, sectionTab);
    if (typeof onResultSelect === "function") {
      onResultSelect({
        ...item,
        tab,
      });
    }
    onChange("");
  }

  return (
    <div className="searchBoxWrap">
      <input
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />

      {shouldRenderSlideout ? (
        <aside className="searchSlideout" role="region" aria-label="search results panel">
          <div className="searchSlideoutHeader">
            <div>
              <div className="searchSlideoutTitle">search results</div>
              <div className="searchSlideoutMeta">{renderSummary()}</div>
            </div>
            <button className="searchSlideoutClear" type="button" onClick={() => onChange("")}>
              clear
            </button>
          </div>

          {searchError ? (
            <div className="searchSlideoutState searchSlideoutError">{searchError}</div>
          ) : null}

          {!loading && !searchError && renderedCount === 0 ? (
            <div className="searchSlideoutState">no data matches this search.</div>
          ) : null}

          {!searchError
            ? tabOrder.map((tab) => {
              const items = toArray(byTab[tab]);
              if (items.length === 0) return null;

              return (
                <section key={tab} className="searchSlideoutSection">
                  <div className="searchSlideoutSectionTitle">{tab}</div>
                  <div className="searchSlideoutList">
                    {items.map((item, idx) => {
                      const title = String(item?.title || item?.id || "record");
                      const subtitle = [item?.id, item?.subtitle].filter(Boolean).join(" | ");
                      return (
                        <button
                          className="searchSlideoutItemBtn"
                          key={`${tab}-${String(item?.id || title)}-${idx}`}
                          type="button"
                          onClick={() => handleResultClick(item, tab)}
                        >
                          <div className="searchSlideoutItemTitleRow">
                            <div className="searchSlideoutItemTitle">{title}</div>
                            <span className="searchSlideoutTabPill">{String(item?.tab || tab)}</span>
                          </div>
                          <div className="searchSlideoutItemSubtitle">{subtitle}</div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
            : null}
        </aside>
      ) : null}
    </div>
  );
}
