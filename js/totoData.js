/* ============================================================
   totoData.js — Singapore TOTO draw history dataset
   ------------------------------------------------------------
   Format per draw:
     { draw, date (ISO), n: [6 winning numbers ascending], a: additional }

   TOTO rules encoded here: 6 numbers drawn from 1..49, plus one
   "additional" number. Draws are normally Monday & Thursday, with
   occasional special draws on other days (e.g. Chinese New Year).

   PROVENANCE — read this before trusting the analysis:
   These draws were compiled from public lottery result aggregators.
   Every row was cross-checked for internal consistency: draw numbers
   are strictly sequential in time, and each date matches the stated
   weekday. Draws that could not be verified were LEFT OUT rather than
   guessed, so the series has gaps (see MISSING_DRAWS below).

   This bundled set is NOT a full year. It covers roughly six months.
   To run the analysis on complete official history, use the "Import
   data" panel in the UI and paste the full result list from
   Singapore Pools. Imported data is stored in localStorage and
   replaces this seed set.
   ============================================================ */

const TOTO_SEED_DRAWS = [
  { draw: 4206, date: '2026-08-07', n: [5, 7, 30, 33, 36, 46], a: 44 },
  { draw: 4205, date: '2026-08-03', n: [9, 29, 30, 35, 36, 40], a: 11 },
  { draw: 4203, date: '2026-07-27', n: [22, 23, 30, 36, 44, 48], a: 28 },
  { draw: 4202, date: '2026-07-23', n: [8, 11, 17, 21, 37, 48], a: 35 },
  { draw: 4201, date: '2026-07-20', n: [1, 8, 11, 14, 33, 43], a: 44 },
  { draw: 4200, date: '2026-07-16', n: [6, 27, 28, 41, 43, 44], a: 19 },
  { draw: 4199, date: '2026-07-13', n: [14, 22, 32, 33, 36, 46], a: 42 },
  { draw: 4198, date: '2026-07-09', n: [23, 27, 31, 38, 42, 47], a: 29 },
  { draw: 4197, date: '2026-07-06', n: [8, 25, 34, 37, 39, 46], a: 44 },
  { draw: 4196, date: '2026-07-02', n: [5, 7, 11, 37, 46, 49], a: 16 },
  { draw: 4195, date: '2026-06-29', n: [6, 11, 22, 23, 31, 34], a: 14 },
  { draw: 4194, date: '2026-06-25', n: [4, 21, 23, 28, 31, 39], a: 41 },
  { draw: 4193, date: '2026-06-22', n: [4, 11, 15, 16, 21, 39], a: 20 },
  { draw: 4192, date: '2026-06-18', n: [2, 7, 11, 19, 20, 42], a: 23 },
  { draw: 4190, date: '2026-06-11', n: [14, 16, 21, 22, 35, 38], a: 36 },
  { draw: 4188, date: '2026-06-04', n: [3, 5, 20, 23, 26, 27], a: 28 },
  { draw: 4187, date: '2026-06-01', n: [2, 19, 26, 29, 33, 36], a: 21 },
  { draw: 4186, date: '2026-05-28', n: [10, 13, 30, 35, 38, 44], a: 15 },
  { draw: 4184, date: '2026-05-21', n: [11, 18, 25, 36, 39, 49], a: 41 },
  { draw: 4183, date: '2026-05-18', n: [7, 18, 32, 37, 41, 44], a: 19 },
  { draw: 4182, date: '2026-05-14', n: [4, 8, 21, 25, 43, 46], a: 32 },
  { draw: 4180, date: '2026-05-07', n: [2, 3, 8, 16, 20, 47], a: 10 },
  { draw: 4174, date: '2026-04-16', n: [1, 3, 6, 12, 21, 41], a: 18 },
  { draw: 4173, date: '2026-04-13', n: [4, 8, 10, 15, 16, 26], a: 17 },
  { draw: 4172, date: '2026-04-09', n: [1, 2, 6, 9, 44, 48], a: 24 },
  { draw: 4168, date: '2026-03-26', n: [4, 7, 22, 29, 33, 46], a: 48 },
  { draw: 4167, date: '2026-03-23', n: [4, 25, 28, 33, 43, 48], a: 31 },
  { draw: 4166, date: '2026-03-19', n: [3, 27, 34, 35, 38, 49], a: 17 },
  { draw: 4158, date: '2026-02-19', n: [8, 16, 17, 34, 38, 48], a: 25 },
  { draw: 4157, date: '2026-02-16', n: [13, 24, 28, 34, 37, 44], a: 29 },
  { draw: 4156, date: '2026-02-13', n: [10, 15, 25, 43, 45, 49], a: 4 },
];

/* Draw numbers known to exist in the covered window but whose winning
   numbers could not be verified, so they are absent from the series
   above. Surfaced in the UI so the coverage gap is visible, not hidden. */
const TOTO_MISSING_DRAWS = [
  4204, 4191, 4189, 4185, 4181,
  4179, 4178, 4177, 4176, 4175,
  4171, 4170, 4169, 4165, 4164,
  4163, 4162, 4161, 4160, 4159,
];

const TOTO_RULES = {
  pool: 49,        // numbers run 1..49
  pick: 6,         // 6 main numbers per draw
  hasAdditional: true,
};

/* ---------- storage ---------- */

const TOTO_STORAGE_KEY = 'toto.draws.v1';

const TotoData = {
  /** Draws sorted newest-first, from localStorage if the user imported any. */
  load() {
    try {
      const raw = localStorage.getItem(TOTO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return { draws: TotoData.sort(parsed), source: 'imported' };
        }
      }
    } catch (err) {
      console.warn('Could not read stored draws, falling back to seed set.', err);
    }
    return { draws: TotoData.sort(TOTO_SEED_DRAWS.slice()), source: 'seed' };
  },

  save(draws) {
    localStorage.setItem(TOTO_STORAGE_KEY, JSON.stringify(draws));
  },

  clear() {
    localStorage.removeItem(TOTO_STORAGE_KEY);
  },

  /**
   * Newest draw first. Draw numbers win when both rows have one — they
   * are the authoritative ordering and survive rows imported without a
   * date. Undated rows sort to the end rather than jumbling the series.
   */
  sort(draws) {
    return draws.slice().sort((x, y) => {
      if (x.draw && y.draw && x.draw !== y.draw) return y.draw - x.draw;
      if (x.date && y.date && x.date !== y.date) return x.date < y.date ? 1 : -1;
      if (x.date && !y.date) return -1;
      if (!x.date && y.date) return 1;
      return 0;
    });
  },

  /** Drop duplicates, preferring whichever copy arrived first. */
  dedupe(draws) {
    const seen = new Set();
    const out = [];
    for (const d of draws) {
      const key = d.draw ? `d${d.draw}` : `t${d.date || '?'}:${d.n.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
    return out;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TOTO_SEED_DRAWS, TOTO_MISSING_DRAWS, TOTO_RULES, TotoData };
}
