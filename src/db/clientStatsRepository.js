import { Platform } from "react-native";
import { executeSql } from "./database";
import { supabase } from "./supabaseClient";

export async function getClientLoanAndSavingsCounts(ownerId) {
  if (Platform.OS === 'web') {
    // En web, usamos Supabase con una consulta SQL directa via RPC
    // Por simplicidad, haremos consultas separadas y combinamos los datos
    let clientsQuery = supabase
      .from('clients')
      .select('id')
      .eq('deleted', 0);
    
    if (ownerId !== null) {
      clientsQuery = clientsQuery.eq('owner_id', ownerId);
    }
    
    const { data: clients, error: clientsError } = await clientsQuery;
    if (clientsError) throw clientsError;
    
    const stats = await Promise.all(clients.map(async (client) => {
      // Contar préstamos
      const { count: loansCount } = await supabase
        .from('loans')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('deleted', 0);
      
      // Contar depósitos de ahorro
      const { data: accounts } = await supabase
        .from('savings_accounts')
        .select('id')
        .eq('client_id', client.id)
        .eq('deleted', 0);
      
      let savingsDepositsCount = 0;
      if (accounts && accounts.length > 0) {
        const accountIds = accounts.map(a => a.id);
        const { count } = await supabase
          .from('savings_movements')
          .select('*', { count: 'exact', head: true })
          .in('account_id', accountIds)
          .eq('type', 'DEPOSIT')
          .eq('deleted', 0);
        
        savingsDepositsCount = count || 0;
      }
      
      return {
        client_id: client.id,
        loans_count: loansCount || 0,
        savings_deposits_count: savingsDepositsCount
      };
    }));
    
    return stats;
  }

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
