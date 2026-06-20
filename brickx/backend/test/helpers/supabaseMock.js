// Shared queue-driven Supabase stub for route tests. Program responses per test
// via global.__SB_QUEUE__ (FIFO, consumed by each awaited query). Writes
// (insert/update/upsert payloads) are recorded on global.__SB_WRITES__.
function shift() {
  const q = global.__SB_QUEUE__ || [];
  return q.length ? q.shift() : { data: null, error: null };
}
function builder() {
  const b = {};
  ["select", "eq", "neq", "order", "limit", "in", "gte", "lte", "gt", "lt", "filter", "range", "delete"]
    .forEach((m) => { b[m] = () => b; });
  b.single = () => Promise.resolve(shift());
  b.maybeSingle = () => Promise.resolve(shift());
  b.insert = (o) => { (global.__SB_WRITES__ = global.__SB_WRITES__ || []).push({ op: "insert", obj: o }); return b; };
  b.update = (o) => { (global.__SB_WRITES__ = global.__SB_WRITES__ || []).push({ op: "update", obj: o }); return b; };
  b.upsert = (o) => { (global.__SB_WRITES__ = global.__SB_WRITES__ || []).push({ op: "upsert", obj: o }); return b; };
  // Makes a chain ending without .single()/.maybeSingle() (e.g. ...select().in())
  // awaitable, consuming one queued result.
  b.then = (res, rej) => Promise.resolve(shift()).then(res, rej);
  return b;
}
module.exports = { createClient: () => ({ from: () => builder() }) };
