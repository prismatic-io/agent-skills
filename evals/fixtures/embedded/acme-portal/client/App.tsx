import { useEffect, useState } from "react";
import { getMe, type Me } from "./api.ts";
import { setColorScheme, useColorScheme } from "./colorScheme.ts";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Login } from "./pages/Login.tsx";
import { Settings } from "./pages/Settings.tsx";

type Page = "dashboard" | "settings";

export const App = () => {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const colorScheme = useColorScheme();

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;
  if (!me) return <Login onSignedIn={setMe} />;

  return (
    <div className="layout">
      <nav className="nav">
        <strong>{me.tenant.name}</strong>
        <button type="button" onClick={() => setPage("dashboard")}>
          Dashboard
        </button>
        <button type="button" onClick={() => setPage("settings")}>
          Settings
        </button>
        <button
          type="button"
          onClick={() =>
            setColorScheme(colorScheme === "dark" ? "light" : "dark")
          }
        >
          {colorScheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </nav>
      <main className="content">
        {page === "dashboard" ? <Dashboard /> : <Settings me={me} />}
      </main>
    </div>
  );
};
