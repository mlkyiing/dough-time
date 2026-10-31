import assert from "node:assert/strict";
import { lastWeekdayISO, localISO, reportMonth, todayISO } from "./format.ts";

// 1 Nov 2026 is a Sunday, so October's last working day is Friday 30 Oct.
assert.equal(lastWeekdayISO("2026-10-31"), "2026-10-30");
assert.equal(reportMonth({ date: "2026-10-30", type: "income", category: "Salary" }), "2026-11");
assert.equal(reportMonth({ date: "2026-10-31", type: "income", category: "Salary" }), "2026-11");
assert.equal(reportMonth({ date: "2026-10-30", type: "expense", category: "Makan" }), "2026-10");
assert.equal(reportMonth({ date: "2026-10-15", type: "income", category: "Salary" }), "2026-10");
assert.equal(reportMonth({ date: "2026-11-30", type: "income", category: "Salary" }), "2026-12");
assert.equal(lastWeekdayISO("2026-02-28"), "2026-02-27");

const earlyMorning = new Date(2026, 10, 1, 2, 49, 0);
assert.equal(localISO(earlyMorning), "2026-11-01");
assert.equal(todayISO().length, 10);

console.log("payday check ok");
