import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import CorridorMonitor from "@/pages/CorridorMonitor";
import RoutesPage from "@/pages/RoutesPage";
import IncidentsPage from "@/pages/IncidentsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<CorridorMonitor />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
