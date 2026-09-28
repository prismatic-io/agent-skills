import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const legacy = fileURLToPath(
  new URL(
    "./fixtures/migrations/bespoke-mime-extraction/input/legacy/",
    import.meta.url,
  ),
);
const run = async (message: Buffer | string) => {
  const directory = await mkdtemp(join(tmpdir(), "mime-source-"));
  try {
    const input = join(directory, "message.eml");
    const output = join(directory, "output");
    await writeFile(input, message);
    const result = spawnSync(
      "python3",
      [join(legacy, "email-unpack.py"), "-d", output, input],
      {
        encoding: "utf8",
        timeout: 10_000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      },
    );
    assert.ifError(result.error);
    const files = Object.fromEntries(
      await Promise.all(
        (await readdir(output)).map(
          async (name): Promise<[string, Buffer]> => [
            name,
            await readFile(join(output, name)),
          ],
        ),
      ),
    );
    return { result, files };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
const part = (headers: string, body: string) => `${headers}\n\n${body}\n`;
const multipart = (parts: string[]) =>
  `Content-Type: multipart/mixed; boundary=x\n\n${parts.map((p) => `--x\n${p}`).join("")}--x--\n`;

test("MIME source decodes ordinary binary and includes unnamed content", async () => {
  const { result, files } = await run(
    await readFile(join(legacy, "example.eml")),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(files, {
    "part-001.txt": Buffer.from("Please process the attached packet."),
    "packet.bin": Buffer.from([0, 1, 65, 66, 10]),
  });
});
test("MIME source traverses nested parts, replaces names and counts named parts", async () => {
  const { result, files } = await run(
    multipart([
      part(
        "Content-Type: multipart/alternative; boundary=i",
        `--i\n${part('Content-Type: text/plain\nContent-Disposition: attachment; filename="same.txt"', "first")}--i--`,
      ),
      part(
        'Content-Type: text/plain\nContent-Disposition: attachment; filename="same.txt"\nContent-Transfer-Encoding: quoted-printable',
        "second=20value",
      ),
      part("Content-Type: application/x-private-unused", "last"),
    ]),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(files, {
    "same.txt": Buffer.from("second value"),
    "part-003.bin": Buffer.from("last"),
  });
});
test("MIME source stops on nested-message payload failure retaining earlier files", async () => {
  const { result, files } = await run(
    multipart([
      part(
        'Content-Type: text/plain\nContent-Disposition: attachment; filename="first.txt"',
        "retained",
      ),
      part("Content-Type: message/rfc822", "Subject: inner\n\nbody"),
      part(
        'Content-Type: text/plain\nContent-Disposition: attachment; filename="later.txt"',
        "later",
      ),
    ]),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TypeError/);
  assert.deepEqual(files["first.txt"], Buffer.from("retained"));
  assert.equal(files["later.txt"], undefined);
  assert.equal(Object.keys(files).length, 2);
  assert.ok(
    Object.entries(files).some(
      ([name, bytes]) => name !== "first.txt" && bytes.length === 0,
    ),
  );
});
