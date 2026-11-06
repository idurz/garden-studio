import http from 'node:http';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_PROJECT_BYTES, validateProject } from './public/model.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const dataDir = path.resolve(process.env.DATA_DIR || './data');
const projectFile = path.join(dataDir, 'garden.json');
const port = Number(process.env.PORT || 3000);
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/model.js': ['model.js', 'text/javascript; charset=utf-8']
};
let saveQueue = Promise.resolve();

function reply(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/project' && req.method === 'GET') {
      try {
        const content = await readFile(projectFile, 'utf8');
        const error = validateProject(JSON.parse(content));
        if (error) throw new Error(error);
        reply(res, 200, content);
      } catch (error) {
        if (error.code === 'ENOENT') reply(res, 200, 'null');
        else throw error;
      }
      return;
    }
    if (url.pathname === '/api/project' && req.method === 'PUT') {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_PROJECT_BYTES) {
          reply(res, 413, JSON.stringify({ error: 'Project exceeds the 25 MB limit. Remove or reduce the reference image or project data.' }));
          return;
        }
        chunks.push(chunk);
      }
      let project;
      try { project = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { reply(res, 400, JSON.stringify({ error: 'Invalid JSON.' })); return; }
      const error = validateProject(project);
      if (error) { reply(res, 400, JSON.stringify({ error })); return; }
      const save = saveQueue.catch(() => {}).then(async () => {
        await mkdir(dataDir, { recursive: true });
        const temporary = `${projectFile}.tmp`;
        await writeFile(temporary, JSON.stringify(project), 'utf8');
        await rename(temporary, projectFile);
      });
      saveQueue = save;
      await save;
      reply(res, 200, JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === 'GET' && files[url.pathname]) {
      const [filename, type] = files[url.pathname];
      reply(res, 200, await readFile(path.join(root, filename)), type);
      return;
    }
    reply(res, 404, JSON.stringify({ error: 'Not found.' }));
  } catch (error) {
    console.error('Request failed:', error);
    if (!res.headersSent) reply(res, 500, JSON.stringify({ error: 'Could not access garden data. Check the server logs.' }));
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Garden Studio listening on port ${port}`));
