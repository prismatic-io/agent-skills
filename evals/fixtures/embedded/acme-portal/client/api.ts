export interface Me {
  user: { id: string; email: string; name: string; role: "admin" | "member" };
  tenant: { id: string; name: string };
}

export const apiFetch = async <T,>(path: string, init?: RequestInit) => {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return (response.status === 204 ? undefined : await response.json()) as T;
};

export const getMe = () => apiFetch<Me>("/me");

export const login = (email: string, password: string) =>
  apiFetch<void>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
