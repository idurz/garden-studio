import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createProject } from '../public/model.js';

test('server persists valid projects and rejects invalid data', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'garden-studio-test-'));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, DATA_DIR: directory, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start')), 5000);
    child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited: ${code}`)));
  });
  const url = `http://127.0.0.1:${port}`;
  assert.equal(await (await fetch(`${url}/api/project`)).json(), null);
  const project = createProject(2, 2, 'Test');
  const save = await fetch(`${url}/api/project`, { method: 'PUT', body: JSON.stringify(project) });
  assert.equal(save.status, 200);
  assert.deepEqual(await (await fetch(`${url}/api/project`)).json(), project);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'garden.json'), 'utf8')), project);
  const bad = await fetch(`${url}/api/project`, { method: 'PUT', body: JSON.stringify({ ...project, width: 0 }) });
  assert.equal(bad.status, 400);
  assert.deepEqual(await (await fetch(`${url}/api/project`)).json(), project);
  assert.equal((await fetch(`${url}/`)).status, 200);
  assert.equal((await fetch(`${url}/../server.js`)).status, 404);
  const large = createProject(190, 310, 'Large garden');
  large.surface[58899] = 'sand';
  large.water[58899] = true;
  const largeSave = await fetch(`${url}/api/project`, { method: 'PUT', body: JSON.stringify(large) });
  assert.equal(largeSave.status, 200);
  assert.deepEqual(await (await fetch(`${url}/api/project`)).json(), large);
});
