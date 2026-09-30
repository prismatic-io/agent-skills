import type { Me } from "../api.ts";

export const Settings = ({ me }: { me: Me }) => (
  <section>
    <h1>Settings</h1>
    <div className="panel">
      <h2>Account</h2>
      <p>
        {me.user.name} ({me.user.email}), {me.tenant.name}
      </p>
    </div>
    <div className="panel">
      <h2>Integrations</h2>
      <p>Integrations are coming soon.</p>
    </div>
  </section>
);
