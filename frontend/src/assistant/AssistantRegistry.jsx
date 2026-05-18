/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useRef } from "react";

const AssistantRegistryContext = createContext(null);

/*
  Registry idea:
  - Components register handlers for targets like "field.search", "nav.invoices"
  - AssistantWidget dispatches backend commands to the right handler
  - No DOM querySelector, only state updates via component handlers
*/

export function AssistantRegistryProvider({ children }) {
  const handlersRef = useRef(new Map()); // targetId -> handler(cmd)

  const api = useMemo(() => {
    return {
      register(targetId, handler) {
        if (!targetId || typeof handler !== "function") return () => {};
        handlersRef.current.set(targetId, handler);
        return () => handlersRef.current.delete(targetId);
      },

      dispatch(cmd) {
        if (!cmd || !cmd.action || cmd.action === "none") return false;
        const targetId = cmd.target;
        if (!targetId) return false;

        const handler = handlersRef.current.get(targetId);
        if (!handler) return false;

        try {
          const result = handler(cmd);
          return result !== false;
        } catch {
          return false;
        }
      },

      has(targetId) {
        return handlersRef.current.has(targetId);
      },

      listTargets() {
        return Array.from(handlersRef.current.keys());
      },
    };
  }, []);

  return (
    <AssistantRegistryContext.Provider value={api}>
      {children}
    </AssistantRegistryContext.Provider>
  );
}

export function useAssistantRegistry() {
  const ctx = useContext(AssistantRegistryContext);
  if (!ctx) {
    throw new Error("AssistantRegistryProvider is missing. Wrap <App /> in it.");
  }
  return ctx;
}
