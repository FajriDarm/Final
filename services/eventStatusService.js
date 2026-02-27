const db = require("../config/database");

let columnsReady = false;
let ensureColumnsPromise = null;

function isDuplicateColumnError(err) {
  return err && (err.code === "ER_DUP_FIELDNAME" || /Duplicate column name/i.test(err.message || ""));
}

async function ensureEventActivePeriodColumns() {
  if (columnsReady) return;
  if (ensureColumnsPromise) {
    await ensureColumnsPromise;
    return;
  }

  ensureColumnsPromise = (async () => {
    try {
      await db.query(`ALTER TABLE events ADD COLUMN active_start_date DATE NULL AFTER end_date`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }

    try {
      await db.query(`ALTER TABLE events ADD COLUMN active_end_date DATE NULL AFTER active_start_date`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }

    columnsReady = true;
  })();

  try {
    await ensureColumnsPromise;
  } finally {
    ensureColumnsPromise = null;
  }
}

async function syncEventStatusesByActivePeriod() {
  await ensureEventActivePeriodColumns();

  await db.query(
    `UPDATE events
     SET status = CASE
       WHEN CURDATE() < active_start_date THEN 'draft'
       WHEN CURDATE() > active_end_date THEN 'inactive'
       ELSE 'active'
     END
     WHERE active_start_date IS NOT NULL
       AND active_end_date IS NOT NULL`,
  );
}

module.exports = {
  ensureEventActivePeriodColumns,
  syncEventStatusesByActivePeriod,
};
