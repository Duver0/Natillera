import { executeSql } from "./database";
import {
  getSavingsMovements,
  calculateLiquidation
} from "./savingsRepository";

export async function getSavingsOverviewByOwner(ownerId) {
  const result = await executeSql(
    `SELECT sa.*, c.id as client_id, c.name as client_name
     FROM savings_accounts sa
     JOIN clients c ON c.id = sa.client_id
     WHERE sa.deleted = 0
       AND c.deleted = 0
       AND (? IS NULL OR c.owner_id = ?)
     ORDER BY sa.created_at ASC;`,
    [ownerId, ownerId]
  );
  const rows = result.rows?._array ?? [];

  const overview = [];

  for (const acc of rows) {
    const movements = await getSavingsMovements(acc.id);
    const liquidation = await calculateLiquidation(acc, movements);

    let firstDate = null;
    let lastDate = null;
    for (const m of movements) {
      const d = new Date(m.date);
      if (!firstDate || d < firstDate) firstDate = d;
      if (!lastDate || d > lastDate) lastDate = d;
    }

    overview.push({
      account: acc,
      clientId: acc.client_id,
      clientName: acc.client_name,
      movements,
      liquidation,
      firstDate,
      lastDate
    });
  }

  return overview;
}
