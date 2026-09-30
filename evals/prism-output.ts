import { spawn } from "node:child_process";
import { constants } from "node:os";
import { Transform, type TransformCallback } from "node:stream";
import { StringDecoder } from "node:string_decoder";

// Axios errors can serialize authenticated request headers even when the CLI
// command itself never requests credentials. Filter before an agent sees them.
export const redactPrismLine = (line: string) =>
  line
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    );

export class PrismOutputFilter extends Transform {
  private decoder = new StringDecoder("utf8");
  private pending = "";
  private dropping = false;
  private readonly limit = 4 * 1024 * 1024;

  private accept(text: string) {
    for (;;) {
      const end = text.indexOf("\n");
      const part = end < 0 ? text : text.slice(0, end + 1);
      if (!this.dropping) {
        if (this.pending.length + part.length > this.limit) {
          this.pending = "";
          this.dropping = true;
          this.push("[Prism output line omitted: exceeds diagnostic limit]\n");
        } else {
          this.pending += part;
        }
      }
      if (end < 0) break;
      if (!this.dropping) this.push(redactPrismLine(this.pending));
      this.pending = "";
      this.dropping = false;
      text = text.slice(end + 1);
    }
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    this.accept(this.decoder.write(chunk));
    callback();
  }

  override _flush(callback: TransformCallback) {
    this.accept(this.decoder.end());
    if (!this.dropping && this.pending)
      this.push(redactPrismLine(this.pending));
    callback();
  }
}

export const runPrism = (entrypoint: string, args: string[]): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    });
    child.stdout
      .pipe(new PrismOutputFilter())
      .pipe(process.stdout, { end: false });
    child.stderr
      .pipe(new PrismOutputFilter())
      .pipe(process.stderr, { end: false });
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    child.on("error", () => {
      // Never serialize a process/error object: it may carry request context.
      process.stderr.write(
        "Unable to launch the configured Prism executable\n",
      );
    });
    child.on("close", (code, signal) => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
      resolve(code ?? (signal ? 128 + constants.signals[signal] : 1));
    });
  });
