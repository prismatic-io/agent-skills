import { pathToFileURL } from "node:url";

export const reconcile = async (
  { directoryUrl, directoryToken, accessUrl, accessToken, group },
  fetcher = fetch,
) => {
  const request = async (base, token, path, method = "GET", body) => {
    const response = await fetcher(new URL(path, base), {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
    return response.status === 204 ? undefined : response.json();
  };
  const desired = new Set();
  let cursor;
  do {
    const page = await request(
      directoryUrl,
      directoryToken,
      `/v1/groups/${encodeURIComponent(group)}/members${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    for (const member of page.members) {
      if (member.enabled === true && member.kind === "employee")
        desired.add(member.id);
    }
    cursor = page.nextCursor;
  } while (cursor);

  const current = await request(
    accessUrl,
    accessToken,
    `/v1/groups/${encodeURIComponent(group)}/grants`,
  );
  const present = new Set(current.grants.map((grant) => grant.personId));
  let added = 0;
  let removed = 0;
  for (const personId of desired) {
    if (!present.has(personId)) {
      await request(
        accessUrl,
        accessToken,
        `/v1/groups/${encodeURIComponent(group)}/grants/${encodeURIComponent(personId)}`,
        "PUT",
        { managedBy: "directory-bridge" },
      );
      added++;
    }
  }
  for (const grant of current.grants) {
    if (
      grant.managedBy === "directory-bridge" &&
      !desired.has(grant.personId)
    ) {
      await request(
        accessUrl,
        accessToken,
        `/v1/groups/${encodeURIComponent(group)}/grants/${encodeURIComponent(grant.personId)}`,
        "DELETE",
      );
      removed++;
    }
  }
  return { added, removed };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await reconcile({
    directoryUrl: process.env.DIRECTORY_URL,
    directoryToken: process.env.DIRECTORY_TOKEN,
    accessUrl: process.env.ACCESS_URL,
    accessToken: process.env.ACCESS_TOKEN,
    group: process.env.GROUP_ID,
  });
  console.log(JSON.stringify(result));
}
