import type { AiRoute } from "@claims/shared";

export function RouteBadge({ route }: { route: AiRoute }) {
  return route === "ON_DEVICE" ? (
    <span className="route device">Processed on this device</span>
  ) : (
    <span className="route cloud">Processed using cloud AI</span>
  );
}
