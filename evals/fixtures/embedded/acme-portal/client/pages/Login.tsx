import { type FormEvent, useState } from "react";
import { getMe, login, type Me } from "../api.ts";

export const Login = ({ onSignedIn }: { onSignedIn: (me: Me) => void }) => {
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("password")));
      onSignedIn(await getMe());
    } catch {
      setError("Invalid email or password");
    }
  };

  return (
    <form className="content" onSubmit={submit}>
      <h1>Sign in</h1>
      <input name="email" type="email" placeholder="Email" />
      <input name="password" type="password" placeholder="Password" />
      <button type="submit">Sign in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
};
