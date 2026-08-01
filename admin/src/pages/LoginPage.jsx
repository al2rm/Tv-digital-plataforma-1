import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../context/RouterContext";
import { apiError } from "../services/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const { navigate } = useRouter();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (loginError) {
      setError(apiError(loginError, "No se pudo iniciar sesión"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-brand__mark">TV</div>
          <span>Administración inteligente</span>
        </div>
        <h1>TV Digital Pro</h1>
        <p>Marketing, ventas, clientes y WhatsApp en un solo lugar.</p>

        {error ? <div className="alert alert--error">{error}</div> : null}

        <form onSubmit={submit} className="login-form">
          <label>
            Correo
            <span className="input-with-icon">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@tvdigital.com"
                autoComplete="email"
                required
              />
            </span>
          </label>
          <label>
            Contraseña
            <span className="input-with-icon">
              <LockKeyhole size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña segura"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <button className="primary-button login-submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={19} /> : null}
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <small className="login-note">
          Todo el entretenimiento en un solo lugar.
        </small>
      </section>
    </main>
  );
}
