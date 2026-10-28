/** Prints the real status JSONPlaceholder returns for each payload (used for the README findings table). */
import { request } from 'playwright';
import { config } from '../config/env';
import { postPayloads } from '../src/utils/testData';

(async () => {
  const api = await request.newContext({ baseURL: config.apiBaseUrl });
  for (const [name, p] of Object.entries(postPayloads)) {
    const started = Date.now();
    const res = p.raw !== undefined
      ? await api.post('/posts', { data: p.raw, headers: { 'Content-Type': 'application/json' } })
      : await api.post('/posts', { data: p.body });
    console.log(`${name.padEnd(20)} ${res.status()}  ${Date.now() - started} ms`);
  }
  await api.dispose();
})();
