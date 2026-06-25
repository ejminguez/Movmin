import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import CorridorMonitor from "@/pages/CorridorMonitor";
import RouteAnalyticsPage from "@/pages/RouteAnalyticsPage";
import IncidentsPage from "@/pages/IncidentsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SettingsPage from "@/pages/SettingsPage";
import ScenarioPage from "@/pages/ScenarioPage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <CorridorMonitor /> },
      { path: "route-analytics", element: <RouteAnalyticsPage /> },
      { path: "scenarios", element: <ScenarioPage /> },
      { path: "incidents", element: <IncidentsPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
