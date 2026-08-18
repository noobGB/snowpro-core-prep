import { useEffect } from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsPanel } from "./components/SettingsPanel";
import { applyTheme } from "./lib/theme";
import { useProgress } from "./lib/progress";
import { Analytics } from "./pages/Analytics";
import { Dashboard } from "./pages/Dashboard";
import { Flashcards } from "./pages/Flashcards";
import { MockExams } from "./pages/MockExams";
import { Notes } from "./pages/Notes";
import { NotFound } from "./pages/NotFound";
import { Practice } from "./pages/Practice";
import { Resources } from "./pages/Resources";
import { Runner } from "./pages/Runner";
import { Results } from "./pages/Results";
import { Setup } from "./pages/Setup";
import { StudyPlan } from "./pages/StudyPlan";

/** Layout route: everything except the session runner gets the sidebar shell. */
function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  const { settings } = useProgress();

  // Root-level, not AppShell-scoped: CommandPalette/SettingsPanel are siblings of the routed tree
  // here, not descendants of AppShell's div, and Runner's /session/:setId route bypasses AppShell
  // entirely. document.documentElement is the only place an attribute reaches all of them.
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  return (
    <>
      <Routes>
        {/* The session runner hides the sidebar (spec §6.4: "nothing competes with the questions"). */}
        <Route path="/session/:setId" element={<Runner />} />

        <Route element={<ShellLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notes/:domainId" element={<Notes />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/results/:attemptId" element={<Results />} />
          <Route path="/mocks" element={<MockExams />} />
          <Route path="/drill" element={<Flashcards />} />
          <Route path="/plan" element={<StudyPlan />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      {/* Mounted once outside the route tree so ⌘K works everywhere, including the runner. */}
      <CommandPalette />
      <SettingsPanel />
    </>
  );
}
