import { executeSql } from "./database";

export async function getClientLoanAndSavingsCounts(ownerId) {
  const result = await executeSql(
    `SELECT
       c.id AS client_id,
       COUNT(DISTINCT l.id) AS loans_count,
       COALESCE(SUM(CASE WHEN sm.type = 'DEPOSIT' THEN 1 ELSE 0 END), 0) AS savings_deposits_count
     FROM clients c
     LEFT JOIN loans l
       ON l.client_id = c.id AND l.deleted = 0
     LEFT JOIN savings_accounts sa
       ON sa.client_id = c.id AND sa.deleted = 0
     LEFT JOIN savings_movements sm
       ON sm.account_id = sa.id AND sm.deleted = 0
     WHERE c.deleted = 0
       AND (? IS NULL OR c.owner_id = ?)
     GROUP BY c.id;`,
    [ownerId, ownerId]
  );

  const rows = result.rows?._array ?? [];
  return rows;
}
