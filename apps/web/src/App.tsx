import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/auth-context';
import { AuthPage } from './auth/AuthPage';
import { MonitorsPage } from './monitors/MonitorsPage';
import { SettingsPage } from './settings/SettingsPage';

// Split out so Recharts only loads when a detail page is opened.
const MonitorDetailPage = lazy(() =>
  import('./monitors/MonitorDetailPage').then((m) => ({
    default: m.MonitorDetailPage,
  })),
);

function RequireAuth({ children }: { children: ReactNode }) {
  return useAuth().user ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  return useAuth().user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <AuthPage key="login" mode="login" />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <AuthPage key="register" mode="register" />
          </PublicOnly>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <MonitorsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/monitors/:id"
        element={
          <RequireAuth>
            <Suspense
              fallback={
                <p className="text-muted-foreground p-6" aria-busy="true">
                  Loading…
                </p>
              }
            >
              <MonitorDetailPage />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
