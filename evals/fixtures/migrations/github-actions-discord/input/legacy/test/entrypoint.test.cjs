const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { createServer } = require('node:http');
const { resolve } = require('node:path');
const { promisify } = require('node:util');
const { test } = require('node:test');

const run = promisify(execFile);
for (const custom of [false, true]) {
  test(custom ? 'sends a templated message and embeds' : 'forwards the GitHub event', async (t) => {
    let received;
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      received = { url: req.url, event: req.headers['x-github-event'], body: JSON.parse(Buffer.concat(chunks)) };
      res.end('{}');
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    t.after(() => new Promise((done) => server.close(done)));
    const env = {
      PATH: process.env.PATH,
      GITHUB_EVENT_PATH: resolve(__dirname, '../event-example.json'),
      GITHUB_REPOSITORY: 'example/repo',
      GITHUB_WORKFLOW: 'fixture-test',
      GITHUB_ACTOR: 'fixture-user',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_ACTION: 'discord',
      DISCORD_WEBHOOK: `http://127.0.0.1:${server.address().port}/hook`,
      ...(custom ? { DISCORD_EMBEDS: '[{"title":"Build"}]', DISCORD_MENTIONS: '{"parse":[]}' } : {}),
    };
    await run(process.execPath, [resolve(__dirname, '../entrypoint.js'), ...(custom ? ['Hello {{GITHUB_ACTOR}}'] : [])], { env, timeout: 10000 });
    assert.equal(received.event, 'push');
    assert.equal(received.url, custom ? '/hook?wait=true' : '/hook/github?wait=true');
    assert.deepEqual(received.body, custom ? {
      content: 'Hello fixture-user', embeds: [{ title: 'Build' }], allowed_mentions: { parse: [] },
    } : require('../event-example.json'));
  });
}
