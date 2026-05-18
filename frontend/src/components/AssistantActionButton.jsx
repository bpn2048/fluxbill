import React, { useCallback } from "react";
import { useRegisterTarget } from "../assistant/useRegisterTarget";

export default function AssistantActionButton({
  targetId,
  onAction,
  children,
  className = "btn",
  disabled = false,
  title,
}) {
  const handler = useCallback(
    (cmd) => {
      if (!cmd) return;
      if (cmd.action === "click") onAction?.(cmd);
    },
    [onAction]
  );

  useRegisterTarget(targetId, handler);

  return (
    <button
      className={className}
      onClick={() => onAction?.({ action: "click", target: targetId })}
      disabled={disabled}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}
