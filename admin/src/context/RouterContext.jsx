import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

const RouterContext = createContext(null);

const currentPath = () => {
  const path = window.location.pathname || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
};

export function RouterProvider({ children }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((target, options = {}) => {
    if (
      typeof target !== "string" ||
      !target.startsWith("/") ||
      target.startsWith("//") ||
      target.includes("\\")
    ) {
      throw new Error("Ruta interna inválida");
    }

    const nextPath = target.length > 1 ? target.replace(/\/+$/, "") : "/";
    if (options.replace) {
      window.history.replaceState(null, "", nextPath);
    } else {
      window.history.pushState(null, "", nextPath);
    }
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export const useRouter = () => {
  const value = useContext(RouterContext);
  if (!value) throw new Error("useRouter debe usarse dentro de RouterProvider");
  return value;
};

export function AppLink({ to, end = false, className, children, ...props }) {
  const { path, navigate } = useRouter();
  const isActive = end
    ? path === to
    : path === to || (to !== "/" && path.startsWith(`${to}/`));
  const resolvedClassName =
    typeof className === "function" ? className({ isActive }) : className;

  const onClick = (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
    props.onClick?.(event);
  };

  return (
    <a {...props} href={to} className={resolvedClassName} onClick={onClick}>
      {children}
    </a>
  );
}
