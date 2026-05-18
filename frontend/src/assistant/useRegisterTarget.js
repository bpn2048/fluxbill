import { useEffect } from "react";
import { useAssistantRegistry } from "./AssistantRegistry";

export function useRegisterTarget(targetId, handler) {
  const registry = useAssistantRegistry();

  useEffect(() => {
    return registry.register(targetId, handler);
  }, [registry, targetId, handler]);
}
