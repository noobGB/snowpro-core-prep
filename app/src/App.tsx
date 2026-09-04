import { useEffect, useState } from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CommandPalette } from "./components/CommandPalette";
import { HomePage } from "./components/HomePage";
import { LoginGate } from "./components/LoginGate";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { SettingsPanel } from "./components/SettingsPanel";
import { applyTheme } from "./lib/theme";
import { useProgress } from "./lib/progress";
import { fetchMe } from "./lib/session";
import { Admin } from "./pages/Admin";
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

type AuthState = "loading" | "gate" | "ready";

export default function App() {
  const { settings } = useProgress();
  // "loading" until GET /api/me resolves once, at boot. "gate" whenever the server genuinely
  // requires a session and this browser doesn't have one yet -- which of HomePage (public host) or
  // the bare LoginGate (LAN, see isPrivateNetworkHost()'s own comment in server.ts) it renders is
  // decided by isPublicHost below, not by a separate AuthState (issue #123: a signed-out visitor's
  // pre-login screen is permanent, not a one-time "landing" state shown once and then dismissed --
  // see HomePage.tsx's own header comment for why that first cut was rejected). fetchMe() reports
  // authRequired: false (not "gate") for a server that has no /api/me route at all (vite dev
  // without the container, or the built files opened as plain static files), so the app renders
  // exactly as it did before this feature existed in that case, no login screen. See
  // lib/session.ts's own doc comment for the full reasoning.
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [isPublicHost, setIsPublicHost] = useState(false);
  // Issue #160: whether this instance offers "Explore the demo". Comes from the same /api/me 401
  // body as isPublicHost, so it costs no extra request on the cold visitor's critical path.
  const [guestAvailable, setGuestAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((result) => {
      if (cancelled) return;
      if (!result.authRequired || result.user) {
        setAuthState("ready");
        return;
      }
      setIsPublicHost(result.isPublicHost);
      setGuestAvailable(result.guestAvailable);
      setAuthState("gate");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Root-level, not AppShell-scoped: CommandPalette/SettingsPanel are siblings of the routed tree
  // here, not descendants of AppShell's div, and Runner's /session/:setId route bypasses AppShell
  // entirely. document.documentElement is the only place an attribute reaches all of them. Called
  // unconditionally (before the authState early returns below) to keep this hook's call order
  // stable across renders, per the rules of hooks.
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Issue #59: an emailed reset link must work from a fully logged-out browser with no session at
  // all, so it can't wait on authState resolving (that "loading" state is a same-origin fetch that
  // completes fine, but the point of this path IS having no session, so there's nothing gate-vs-
  // ready needs to decide first). Checked ahead of every authState branch below, unconditionally.
  if (window.location.pathname === "/reset-password") return <ResetPasswordPage />;

  if (authState === "loading") return null; // brief -- a same-origin fetch, not worth a spinner
  if (authState === "gate") return isPublicHost ? <HomePage guestAvailable={guestAvailable} /> : <LoginGate />;

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
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      {/* Mounted once outside the route tree so ⌘K works everywhere, including the runner. */}
      <CommandPalette />
      <SettingsPanel />
    </>
  );
}
