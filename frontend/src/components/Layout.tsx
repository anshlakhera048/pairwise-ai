import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/participants", label: "Participants" },
  { to: "/arena", label: "Dating Arena" },
  { to: "/rankings", label: "Rankings" },
];

export function Layout() {
  const [syntheticCount, setSyntheticCount] = useState<number | null>(null);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    api
      .participants({ synthetic: true })
      .then((r) => {
        if (alive) setSyntheticCount(r.participants.length);
      })
      .catch(() => {
        if (alive) setSyntheticCount(0);
      });
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose text-lg text-white shadow-sm">
              ♥
            </span>
            <span className="font-display text-2xl tracking-tight text-ink">
              Pairwise <span className="italic text-rose">AI</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-full px-3 py-2 text-sm font-medium transition sm:px-4 ${
                    isActive
                      ? "bg-ink text-cream"
                      : "text-stone-600 hover:bg-stone-200/60 hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {syntheticCount !== null && syntheticCount > 0 && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto max-w-6xl px-4 py-2 text-center text-xs font-medium text-amber-800 sm:px-6 sm:text-sm">
            Demo data — {syntheticCount} synthetic participant{syntheticCount === 1 ? "" : "s"},
            not real people.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 py-6">
        <p className="mx-auto max-w-6xl px-4 text-center text-xs text-stone-400 sm:px-6">
          Pairwise AI — agentic dating, explained. Compatibility scores are estimates, not
          guarantees.
        </p>
      </footer>
    </div>
  );
}
