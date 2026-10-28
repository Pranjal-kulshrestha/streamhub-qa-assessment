/**
 * Runs the SQL scenarios on an in-memory SQLite database, checks the results against an
 * independent JavaScript calculation, and saves screenshots of schema, data and query output.
 * Usage: npm run sql
 */
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

const sqlDir = path.resolve('sql');
const shotDir = path.join(sqlDir, 'screenshots');
fs.mkdirSync(shotDir, { recursive: true });
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf-8');

type Row = Record<string, string | number | null>;

const db = new DatabaseSync(':memory:');
db.exec(read('schema.sql'));
db.exec(read('data.sql'));

const esc = (v: unknown) => String(v ?? 'NULL').replace(/&/g, '&amp;').replace(/</g, '&lt;');
function table(rows: Row[]): string {
  if (!rows.length) return '<p><em>0 rows</em></p>';
  const cols = Object.keys(rows[0]);
  return `<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`)
    .join('')}</tbody></table><p class="count">${rows.length} row(s)</p>`;
}
const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{font:14px system-ui,Segoe UI,sans-serif;margin:24px;color:#111;max-width:1100px}
h1{font-size:18px;margin:0 0 12px} h2{font-size:15px;margin:18px 0 6px;color:#1d4ed8}
pre{background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font:12px Consolas,monospace;white-space:pre-wrap}
table{border-collapse:collapse;margin:6px 0;font-size:13px} th,td{border:1px solid #d1d5db;padding:4px 10px;text-align:left}
th{background:#e0e7ff} .count{color:#555;margin:2px 0 10px} .ok{color:#047857;font-weight:600}
</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`;

async function main(): Promise<void> {
  // ---------- Scenario 1 ----------
  const q1 = read('scenario1_round_trips.sql');
  const result1 = db.prepare(q1).all() as Row[];
  // Independent check in JS (same rules, different code path).
  type Txn = { txn_id: number; from_account: string; to_account: string; amount: number; txn_time: string };
  const txns = db.prepare('SELECT * FROM transactions').all() as unknown as Txn[];
  const expected1: string[] = [];
  for (const a of txns)
    for (const b of txns) {
      const dtMs = Date.parse(b.txn_time.replace(' ', 'T') + 'Z') - Date.parse(a.txn_time.replace(' ', 'T') + 'Z');
      if (b.from_account === a.to_account && b.to_account === a.from_account && dtMs > 0 && dtMs <= 86_400_000 && Math.abs(b.amount - a.amount) <= 0.1 * a.amount + 1e-9) {
        expected1.push(`${a.txn_id}->${b.txn_id}`);
      }
    }
  const actual1 = result1.map((r) => `${r.sent_txn}->${r.returned_txn}`).sort();
  const ok1 = JSON.stringify(actual1) === JSON.stringify(expected1.sort());

  // ---------- Scenario 2 ----------
  const q2 = read('scenario2_scoring_streaks.sql');
  const result2 = db.prepare(q2).all() as Row[];
  type Stat = { player_name: string; match_date: string; runs: number };
  const stats = db.prepare("SELECT player_name, match_date, runs FROM player_match_stats WHERE match_date >= '2024-01-01' AND match_date < '2025-01-01' ORDER BY player_name, match_date").all() as unknown as Stat[];
  const expected2: string[] = [];
  const byPlayer = new Map<string, Stat[]>();
  stats.forEach((s) => byPlayer.set(s.player_name, [...(byPlayer.get(s.player_name) ?? []), s]));
  for (const [name, list] of byPlayer) {
    let run: Stat[] = [];
    const flush = () => { if (run.length >= 3) expected2.push(`${name}|${run[0].match_date}|${run.length}`); run = []; };
    for (const s of list) { if (s.runs >= 30) run.push(s); else flush(); }
    flush();
  }
  const actual2 = result2.map((r) => `${r.player_name}|${r.streak_start_date}|${r.streak_length}`);
  const ok2 = JSON.stringify(actual2) === JSON.stringify(expected2);

  // ---------- Pages and screenshots ----------
  const schema = read('schema.sql');
  const pages: Record<string, string> = {
    '01_schema.png': page('Table schema', `<pre>${esc(schema)}</pre>`),
    '02_sample_data.png': page(
      'Sample data (synthetic)',
      `<h2>transactions</h2>${table(db.prepare('SELECT * FROM transactions').all() as Row[])}<h2>player_match_stats</h2>${table(db.prepare('SELECT * FROM player_match_stats').all() as Row[])}`,
    ),
    '03_scenario1_query_and_result.png': page(
      'Scenario 1: round-trip transfers (within 10% and 24 hours)',
      `<h2>Query</h2><pre>${esc(q1)}</pre><h2>Result</h2>${table(result1)}<p class="ok">Cross-check against independent JavaScript calculation: ${ok1 ? 'MATCH' : 'MISMATCH'} (${expected1.length} pairs expected)</p>`,
    ),
    '04_scenario2_query_and_result.png': page(
      'Scenario 2: players with 30+ runs in at least 3 consecutive matches (IPL 2024)',
      `<h2>Query</h2><pre>${esc(q2)}</pre><h2>Result</h2>${table(result2)}<p class="ok">Cross-check against independent JavaScript calculation: ${ok2 ? 'MATCH' : 'MISMATCH'} (${expected2.length} streaks expected)</p>`,
    ),
  };

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const p = await ctx.newPage();
  for (const [file, html] of Object.entries(pages)) {
    await p.setContent(html);
    await p.screenshot({ path: path.join(shotDir, file), fullPage: true });
  }
  await browser.close();

  const md = [
    '# SQL results (generated by `npm run sql`)',
    '',
    `Scenario 1 rows: ${result1.length}. Independent check: ${ok1 ? 'MATCH' : 'MISMATCH'}.`,
    '```',
    JSON.stringify(result1, null, 2),
    '```',
    `Scenario 2 rows: ${result2.length}. Independent check: ${ok2 ? 'MATCH' : 'MISMATCH'}.`,
    '```',
    JSON.stringify(result2, null, 2),
    '```',
  ].join('\n');
  fs.writeFileSync(path.join(sqlDir, 'results.md'), md);

  console.log(`Scenario 1: ${result1.length} rows, independent check ${ok1 ? 'MATCH' : 'MISMATCH'}`);
  console.log(`Scenario 2: ${result2.length} rows, independent check ${ok2 ? 'MATCH' : 'MISMATCH'}`);
  if (!ok1 || !ok2) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
