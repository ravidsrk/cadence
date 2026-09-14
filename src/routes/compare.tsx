import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/compare")({
  component: CompareLayout,
});

function CompareLayout() {
  return <Outlet />;
}
