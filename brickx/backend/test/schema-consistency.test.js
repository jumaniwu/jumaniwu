// Static guard against the "insert/update a column that doesn't exist" class of
// bug (e.g. the historical gross_revenue/noi vs gross_revenue_usd/noi_usd crash).
// Parses database-schema.sql + migrations for each table's columns, then uses a
// real JS AST (so regex/comment edge-cases can't fool it) to find every
// .from('table').insert/update({...}) in server.js and asserts the keys exist.
// No database required.

const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.join(__dirname, "..");
const SQL_FILES = ["database-schema.sql", "migration-001-dynamic-rounds.sql", "migration-002-email-otp.sql"]
  .map((f) => path.join(ROOT, f))
  .filter((f) => fs.existsSync(f));

function parseSchema() {
  const cols = {}; // table -> Set(column)
  const add = (t, c) => { (cols[t.toLowerCase()] = cols[t.toLowerCase()] || new Set()).add(c.toLowerCase()); };
  const SKIP = /^(primary|unique|check|foreign|constraint|exclude)\b/i;

  for (const file of SQL_FILES) {
    const sql = fs.readFileSync(file, "utf8");

    const createRe = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\);/gi;
    let m;
    while ((m = createRe.exec(sql))) {
      const table = m[1];
      for (let line of m[2].split("\n")) {
        line = line.replace(/--.*$/, "").trim().replace(/,$/, "").trim();
        if (!line || SKIP.test(line)) continue;
        const col = line.match(/^([a-zA-Z_]\w*)/);
        if (col) add(table, col[1]);
      }
    }

    const alterRe = /ALTER TABLE (\w+)([\s\S]*?);/gi;
    while ((m = alterRe.exec(sql))) {
      const table = m[1];
      const addRe = /ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi;
      let a;
      while ((a = addRe.exec(m[2]))) add(table, a[1]);
    }
  }
  return cols;
}

// Walk the AST of server.js for supabase .insert/.update/.upsert({...}) calls,
// resolving the table from the `.from('x')` earlier in the same chain.
function findWrites(src) {
  const ast = parser.parse(src, { sourceType: "script" });
  const writes = [];

  function fromTable(node) {
    let cur = node;
    while (cur && typeof cur === "object") {
      if (cur.type === "CallExpression" && cur.callee && cur.callee.type === "MemberExpression"
          && cur.callee.property && cur.callee.property.name === "from") {
        const a = cur.arguments[0];
        return a && a.type === "StringLiteral" ? a.value : null;
      }
      if (cur.type === "CallExpression") cur = cur.callee;
      else if (cur.type === "MemberExpression") cur = cur.object;
      else return null;
    }
    return null;
  }

  (function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.type === "CallExpression" && node.callee && node.callee.type === "MemberExpression") {
      const op = node.callee.property && node.callee.property.name;
      const arg = node.arguments && node.arguments[0];
      if (["insert", "update", "upsert"].includes(op) && arg && arg.type === "ObjectExpression") {
        const keys = [];
        for (const p of arg.properties) {
          if (p.type === "ObjectProperty" && !p.computed) {
            if (p.key.type === "Identifier") keys.push(p.key.name);
            else if (p.key.type === "StringLiteral") keys.push(p.key.value);
          }
        }
        writes.push({ op, table: fromTable(node.callee.object), keys, line: node.loc.start.line });
      }
    }
    for (const k in node) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      const v = node[k];
      if (v && typeof v === "object") visit(v);
    }
  })(ast.program.body);

  return writes;
}

describe("server.js insert/update columns match the SQL schema", () => {
  const schema = parseSchema();
  const writes = findWrites(fs.readFileSync(path.join(ROOT, "server.js"), "utf8"));

  test("schema and writes were parsed", () => {
    expect(Object.keys(schema).length).toBeGreaterThan(5);
    expect(writes.length).toBeGreaterThan(3);
  });

  test("every inserted/updated column exists on its table", () => {
    const problems = [];
    for (const w of writes) {
      if (!w.table) continue;
      const cols = schema[w.table.toLowerCase()];
      if (!cols) continue; // table not declared in parsed SQL — skip (don't false-fail)
      for (const k of w.keys) {
        if (!cols.has(k.toLowerCase())) {
          problems.push(`server.js:${w.line} ${w.op} into "${w.table}" — unknown column "${k}"`);
        }
      }
    }
    if (problems.length) throw new Error("Column mismatches found:\n  " + problems.join("\n  "));
  });
});
