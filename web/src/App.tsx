import { AnimatePresence } from "motion/react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/Login";
import Modules from "@/pages/Modules";
import Users from "@/pages/Users";
import TransactionsOverview from "@/pages/transactions/Overview";
import Entries from "@/pages/transactions/Entries";
import Categories from "@/pages/transactions/Categories";
import Fixed from "@/pages/transactions/Fixed";
import GoalBudget from "@/pages/transactions/GoalBudget";
import WorkoutOverview from "@/pages/workout/Overview";
import Sessions from "@/pages/workout/Sessions";
import SessionDetail from "@/pages/workout/SessionDetail";
import Exercises from "@/pages/workout/Exercises";

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  const location = useLocation();
  return (
    // Keyed on pathname so the outgoing page can animate out before the next
    // one animates in.
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Modules />} />

        <Route path="/transactions" element={<TransactionsOverview />} />
        <Route path="/transactions/entries" element={<Entries />} />
        <Route path="/transactions/categories" element={<Categories />} />
        <Route path="/transactions/fixed" element={<Fixed />} />
        <Route path="/transactions/goals" element={<GoalBudget kind="goal" />} />
        <Route path="/transactions/budgets" element={<GoalBudget kind="budget" />} />

        <Route path="/workout" element={<WorkoutOverview />} />
        <Route path="/workout/sessions" element={<Sessions />} />
        <Route path="/workout/sessions/:id" element={<SessionDetail />} />
        <Route path="/workout/exercises" element={<Exercises />} />

        <Route
          path="/users"
          element={
            <AdminOnly>
              <Users />
            </AdminOnly>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function Gate() {
  const { ready, user } = useAuth();

  // Hold the paper background while the stored session is checked, so there's
  // no flash of the login screen for an already-signed-in user.
  if (!ready) return <div className="min-h-dvh bg-paper" />;
  if (!user) return <Login />;
  return <AppRoutes />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
