import {
  BarChart3,
  CreditCard,
  LogOut,
  Menu,
  MessageCircle,
  Radio,
  RefreshCw,
  Users,
  X
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AppLink } from "../context/RouterContext";

const navigation = [
  { to: "/", label: "Resumen", icon: BarChart3, end: true },
  { to: "/leads", label: "Ventas CRM", icon: Radio },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/usuarios", label: "Clientes", icon: Users },
  { to: "/suscripciones", label: "Suscripciones", icon: RefreshCw },
  { to: "/pagos", label: "Pagos", icon: CreditCard }
];

export default function AdminLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setMenuOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu />
      </button>

      {menuOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Cerrar menú"
        />
      ) : null}

      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="brand">
          <div className="brand__mark">TV</div>
          <div>
            <strong>TV Digital Pro</strong>
            <span>Centro de operaciones</span>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <AppLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link--active" : ""}`
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </AppLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span>{user?.nombre?.[0]?.toUpperCase() || "A"}</span>
            <div>
              <strong>{user?.nombre || "Administrador"}</strong>
              <small>{user?.email}</small>
            </div>
          </div>
          <button type="button" className="logout-button" onClick={logout}>
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-brand">TV Digital Pro</div>
        {children}
      </main>
    </div>
  );
}
