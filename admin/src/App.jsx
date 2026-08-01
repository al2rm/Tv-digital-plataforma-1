import { useEffect } from "react";
import AdminLayout from "./components/AdminLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RouterProvider, useRouter } from "./context/RouterContext";
import DashboardPage from "./pages/DashboardPage";
import LeadsPage from "./pages/LeadsPage";
import LoginPage from "./pages/LoginPage";
import PaymentsPage from "./pages/PaymentsPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import UsersPage from "./pages/UsersPage";
import WhatsAppPage from "./pages/WhatsAppPage";

const adminPages = {
  "/": DashboardPage,
  "/leads": LeadsPage,
  "/whatsapp": WhatsAppPage,
  "/usuarios": UsersPage,
  "/suscripciones": SubscriptionsPage,
  "/pagos": PaymentsPage
};

function Redirect({ to }) {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}

function AccessDenied() {
  const { logout } = useAuth();
  return (
    <main className="centered-page">
      <section className="panel-card centered-card">
        <div className="brand__mark">TV</div>
        <h1>Acceso administrativo requerido</h1>
        <p>Tu cuenta no tiene permisos para ingresar a este panel.</p>
        <button type="button" className="primary-button" onClick={logout}>
          Volver al inicio
        </button>
      </section>
    </main>
  );
}

function RoutedApplication() {
  const { path } = useRouter();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <LoginPage />;
  if (user?.rol !== "admin") return <AccessDenied />;
  if (path === "/login") return <Redirect to="/" />;

  const Page = adminPages[path] || DashboardPage;
  return (
    <AdminLayout>
      <Page />
    </AdminLayout>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <RoutedApplication />
      </AuthProvider>
    </RouterProvider>
  );
}
