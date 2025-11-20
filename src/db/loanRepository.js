import { Platform } from "react-native";
import { executeSql } from "./database";
import { supabase } from "./supabaseClient";
import syncManager from "./syncManager";

// Calcula el interés global pendiente de un préstamo.
export async function getRemainingInterestForLoan(loanId) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('loan_installments')
      .select('amount_interest, paid_interest')
      .eq('loan_id', loanId)
      .eq('deleted', 0);
    
    if (error) throw error;
    
    let totalInterest = 0;
    let totalPaidInterest = 0;
    
    (data || []).forEach(row => {
      totalInterest += Number(row.amount_interest) || 0;
      totalPaidInterest += Number(row.paid_interest) || 0;
    });
    
    return Math.max(totalInterest - totalPaidInterest, 0);
  }

  const result = await executeSql(
    `SELECT
       COALESCE(SUM(amount_interest), 0) AS total_interest,
       COALESCE(SUM(paid_interest), 0) AS total_paid_interest
     FROM loan_installments
     WHERE loan_id = ? AND deleted = 0;`,
    [loanId]
  );
  const rows = result.rows?._array ?? [];
  const row = rows[0] || {};
  const totalInterest = Number(row.total_interest) || 0;
  const totalPaidInterest = Number(row.total_paid_interest) || 0;
  return Math.max(totalInterest - totalPaidInterest, 0);
}

// Aplica un pago dirigido únicamente a intereses a nivel de préstamo,
// distribuyéndolo sobre las cuotas con interés pendiente.
export async function payInterestForLoan(loanId, amount, paidDate) {
  const value = Number(amount) || 0;
  if (!loanId || value <= 0) return;

  let remaining = value;
  const when = paidDate || new Date().toISOString().slice(0, 10);

  if (Platform.OS === 'web') {
    const { data: installments } = await supabase
      .from('loan_installments')
      .select('id, amount_interest, paid_interest')
      .eq('loan_id', loanId)
      .eq('deleted', 0)
      .order('due_date', { ascending: true })
      .order('number', { ascending: true });
    
    for (const inst of installments || []) {
      if (remaining <= 0) break;
      const baseInterest = Number(inst.amount_interest) || 0;
      const prevPaidInterest =
        inst.paid_interest != null ? Number(inst.paid_interest) : 0;
      const remainingInterestInst = Math.max(baseInterest - prevPaidInterest, 0);
      if (remainingInterestInst <= 0) continue;

      const toPay = Math.min(remaining, remainingInterestInst);
      await markInstallmentPaid(inst.id, when, toPay, "INTEREST");
      remaining -= toPay;
    }
    return;
  }

  const result = await executeSql(
    `SELECT id, amount_interest, paid_interest
     FROM loan_installments
     WHERE loan_id = ? AND deleted = 0
     ORDER BY due_date ASC, number ASC;`,
    [loanId]
  );
  const installments = result.rows?._array ?? [];

  for (const inst of installments) {
    if (remaining <= 0) break;
    const baseInterest = Number(inst.amount_interest) || 0;
    const prevPaidInterest =
      inst.paid_interest != null ? Number(inst.paid_interest) : 0;
    const remainingInterestInst = Math.max(baseInterest - prevPaidInterest, 0);
    if (remainingInterestInst <= 0) continue;

    const toPay = Math.min(remaining, remainingInterestInst);
    await markInstallmentPaid(inst.id, when, toPay, "INTEREST");
    remaining -= toPay;
  }
}

export async function getLoansByOwner(ownerId) {
  if (Platform.OS === 'web') {
    let query = supabase
      .from('loans')
      .select(`
        *,
        clients!inner(id, name, owner_id, deleted),
        loan_installments(id, amount_capital, amount_interest, paid, paid_amount, deleted)
      `)
      .eq('deleted', 0)
      .eq('clients.deleted', 0)
      .order('created_at', { ascending: false });
    
    if (ownerId !== null) {
      query = query.eq('clients.owner_id', ownerId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(loan => {
      const installments = loan.loan_installments || [];
      let totalScheduled = 0;
      let totalPaid = 0;
      
      installments.forEach(inst => {
        if (inst.deleted === 0) {
          const scheduled = (Number(inst.amount_capital) || 0) + (Number(inst.amount_interest) || 0);
          totalScheduled += scheduled;
          
          if (inst.paid_amount != null) {
            totalPaid += Number(inst.paid_amount) || 0;
          } else if (inst.paid === 1) {
            totalPaid += scheduled;
          }
        }
      });
      
      return {
        ...loan,
        client_name: loan.clients.name,
        remaining_amount: Math.max(totalScheduled - totalPaid, 0)
      };
    });
  }

  const result = await executeSql(
    `SELECT
       l.*,
       c.name as client_name,
       COALESCE(
         SUM(
           CASE
             WHEN li.deleted = 0
             THEN (COALESCE(li.amount_capital, 0) + COALESCE(li.amount_interest, 0))
             ELSE 0
           END
         ), 0
       ) -
       COALESCE(
         SUM(
           CASE
             WHEN li.deleted = 0
             THEN COALESCE(
               li.paid_amount,
               CASE
                 WHEN li.paid = 1
                 THEN (COALESCE(li.amount_capital, 0) + COALESCE(li.amount_interest, 0))
                 ELSE 0
               END
             )
             ELSE 0
           END
         ), 0
       ) AS remaining_amount
     FROM loans l
     JOIN clients c ON c.id = l.client_id
     LEFT JOIN loan_installments li ON li.loan_id = l.id
     WHERE l.deleted = 0
       AND c.deleted = 0
       AND (? IS NULL OR c.owner_id = ?)
     GROUP BY l.id
     ORDER BY l.created_at DESC;`,
    [ownerId, ownerId]
  );
  const rows = result.rows?._array ?? [];
  return rows;
}

export async function createLoanWithInstallments({
  clientId,
  principal,
  interestRate,
  interestType,
  chargeFrequency,
  startDate
}) {
  const createdAt = new Date().toISOString();

  if (Platform.OS === 'web') {
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .insert({
        client_id: clientId,
        principal,
        term_months: 1,
        interest_rate: interestRate,
        interest_type: interestType,
        charge_frequency: chargeFrequency,
        start_date: startDate,
        status: 'ACTIVE'
      })
      .select()
      .single();
    
    if (loanError) throw loanError;
    
    const loanId = loan.id;
    const principalNum = Number(principal) || 0;
    const rateNum = Number(interestRate) || 0;
    
    let totalInterest = 0;
    if (interestType === "FIXED") {
      totalInterest = principalNum * (rateNum / 100);
    } else {
      totalInterest = principalNum * (rateNum / 100);
    }
    
    const dueDate = startDate || new Date().toISOString().slice(0, 10);
    
    const { error: installmentError } = await supabase
      .from('loan_installments')
      .insert({
        loan_id: loanId,
        number: 1,
        due_date: dueDate,
        amount_capital: principalNum,
        amount_interest: totalInterest,
        paid: 0
      });
    
    if (installmentError) throw installmentError;
    
    return getLoanById(loanId);
  }

  const insertLoanResult = await executeSql(
    `INSERT INTO loans (client_id, principal, term_months, interest_rate, interest_type, charge_frequency, start_date, status, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 1);`,
    [
      clientId,
      principal,
      1, // term_months se mantiene por compatibilidad, pero ya no se usa en el flujo
      interestRate,
      interestType,
      chargeFrequency,
      startDate,
      createdAt,
      createdAt
    ]
  );

  const loanId = insertLoanResult.insertId;

  // Crear una única "cuota" agregada que representa
  // todo el capital e intereses del préstamo.
  const principalNum = Number(principal) || 0;
  const rateNum = Number(interestRate) || 0;

  let totalInterest = 0;
  if (interestType === "FIXED") {
    // Interés fijo sobre el total prestado.
    totalInterest = principalNum * (rateNum / 100);
  } else {
    // Por ahora tratamos el interés "variable" como un porcentaje
    // total sobre el capital, sin depender del tiempo. Podremos
    // refinar esto más adelante si lo necesitas.
    totalInterest = principalNum * (rateNum / 100);
  }

  const amountCapital = principalNum;
  const amountInterest = totalInterest;
  const dueDate =
    startDate || new Date().toISOString().slice(0, 10);

  await executeSql(
    `INSERT INTO loan_installments (
       loan_id, number, due_date, amount_capital, amount_interest,
       paid, paid_date, paid_amount, paid_capital, paid_interest,
       created_at, updated_at, pending_sync
     )
     VALUES (?, 1, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, 1);`,
    [
      loanId,
      dueDate,
      amountCapital,
      amountInterest,
      createdAt,
      createdAt
    ]
  );

  // Agregar a cola de sincronización
  await syncManager.addToQueue({
    table: 'loans',
    action: 'insert',
    data: {
      id: loanId,
      client_id: clientId,
      principal,
      term_months: 1,
      interest_rate: interestRate,
      interest_type: interestType,
      charge_frequency: chargeFrequency,
      start_date: startDate,
      status: 'ACTIVE',
      created_at: createdAt,
      updated_at: createdAt
    }
  });

  await syncManager.addToQueue({
    table: 'loan_installments',
    action: 'insert',
    data: {
      loan_id: loanId,
      number: 1,
      due_date: dueDate,
      amount_capital: amountCapital,
      amount_interest: amountInterest,
      paid: 0,
      paid_date: null,
      paid_amount: null,
      paid_capital: null,
      paid_interest: null,
      created_at: createdAt,
      updated_at: createdAt
    }
  });

  return getLoanById(loanId);
}

function buildInstallmentSchedule({
  principal,
  termMonths,
  interestRate,
  interestType,
  chargeFrequency,
  startDate
}) {
  const result = [];
  const principalNum = Number(principal) || 0;
  const months = Number(termMonths) || 1;
  const rate = Number(interestRate) || 0;

  const frequency = chargeFrequency || "MONTHLY";
  const periods = months;
  const periodsPerYear =
    frequency === "DAILY" ? 365 : frequency === "WEEKLY" ? 52 : 12;
  const periodRate = rate / 100 / periodsPerYear;

  // Calcular fechas de vencimiento mes a mes.
  const baseDate = startDate ? new Date(startDate) : new Date();

  if (interestType === "COMPOUND" && periodRate > 0) {
    // Cuota fija con interés compuesto.
    const pow = Math.pow(1 + periodRate, periods);
    const payment =
      principalNum * ((periodRate * pow) / (pow - 1) || 0);

    let remaining = principalNum;
    for (let i = 0; i < periods; i += 1) {
      const interest = remaining * periodRate;
      const capital = payment - interest;
      remaining -= capital;
      const dueDate = addPeriod(baseDate, i + 1, frequency);
      result.push({
        dueDate,
        amountCapital: round2(capital),
        amountInterest: round2(interest)
      });
    }
  } else {
    // Interés simple o fijo: repartimos capital e interés linealmente.
    const capitalPerPeriod = principalNum / periods;

    // Para interés FIJO: el interés se calcula sobre el total prestado,
    // sin depender del tiempo ni de la frecuencia.
    // Para interés SIMPLE: mantenemos el cálculo anualizado.
    const totalInterest =
      interestType === "FIXED"
        ? principalNum * (rate / 100)
        : principalNum * (rate / 100) * (periods / periodsPerYear || 1);

    const interestPerPeriod = totalInterest / periods;

    for (let i = 0; i < periods; i += 1) {
      const dueDate = addPeriod(baseDate, i + 1, frequency);
      result.push({
        dueDate,
        amountCapital: round2(capitalPerPeriod),
        amountInterest: round2(interestPerPeriod)
      });
    }
  }

  return result.map((item) => ({
    ...item,
    dueDate: formatDateISO(item.dueDate)
  }));
}

function addPeriod(date, step, frequency) {
  const d = new Date(date.getTime());
  if (frequency === "DAILY") {
    d.setDate(d.getDate() + step);
  } else if (frequency === "WEEKLY") {
    d.setDate(d.getDate() + step * 7);
  } else {
    d.setMonth(d.getMonth() + step);
  }
  return d;
}

function formatDateISO(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function round2(value) {
  const num = Number(value) || 0;
  if (num <= 0) return 0;
  // Redondear siempre hacia arriba a pesos enteros.
  return Math.ceil(num);
}

export async function getLoanById(loanId) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('loans')
      .select('*, clients!inner(name)')
      .eq('id', loanId)
      .eq('deleted', 0)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    
    return {
      ...data,
      client_name: data.clients.name
    };
  }

  const result = await executeSql(
    `SELECT l.*, c.name as client_name
     FROM loans l
     JOIN clients c ON c.id = l.client_id
     WHERE l.id = ? AND l.deleted = 0
     LIMIT 1;`,
    [loanId]
  );
  const rows = result.rows?._array ?? [];
  return rows[0] || null;
}

export async function getInstallmentsByLoan(loanId) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('loan_installments')
      .select('*')
      .eq('loan_id', loanId)
      .eq('deleted', 0)
      .order('number', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  const result = await executeSql(
    `SELECT *
     FROM loan_installments
     WHERE loan_id = ? AND deleted = 0
     ORDER BY number ASC;`,
    [loanId]
  );
  const rows = result.rows?._array ?? [];
  return rows;
}

export async function getPaidInstallmentsByOwner(ownerId) {
  if (Platform.OS === 'web') {
    let query = supabase
      .from('loan_installments')
      .select(`
        *,
        loans!inner(client_id, principal, interest_rate, interest_type, clients!inner(name, owner_id, deleted))
      `)
      .eq('paid', 1)
      .eq('deleted', 0)
      .eq('loans.clients.deleted', 0)
      .order('paid_date', { ascending: false })
      .order('due_date', { ascending: false });
    
    if (ownerId !== null) {
      query = query.eq('loans.clients.owner_id', ownerId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(inst => ({
      ...inst,
      client_id: inst.loans.client_id,
      principal: inst.loans.principal,
      interest_rate: inst.loans.interest_rate,
      interest_type: inst.loans.interest_type,
      client_name: inst.loans.clients.name
    }));
  }

  const result = await executeSql(
    `SELECT li.*, l.client_id, l.principal, l.interest_rate, l.interest_type,
            c.name as client_name
     FROM loan_installments li
     JOIN loans l ON li.loan_id = l.id
     JOIN clients c ON c.id = l.client_id
     WHERE li.paid = 1
       AND li.deleted = 0
       AND c.deleted = 0
       AND (? IS NULL OR c.owner_id = ?)
     ORDER BY li.paid_date DESC, li.due_date DESC;`,
    [ownerId, ownerId]
  );
  const rows = result.rows?._array ?? [];
  return rows;
}

export async function getPendingInstallmentsByOwner(ownerId) {
  if (Platform.OS === 'web') {
    let query = supabase
      .from('loan_installments')
      .select(`
        *,
        loans!inner(client_id, principal, clients!inner(name, owner_id, deleted))
      `)
      .eq('paid', 0)
      .eq('deleted', 0)
      .eq('loans.clients.deleted', 0)
      .order('due_date', { ascending: true })
      .order('number', { ascending: true });
    
    if (ownerId !== null) {
      query = query.eq('loans.clients.owner_id', ownerId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(inst => ({
      ...inst,
      client_id: inst.loans.client_id,
      principal: inst.loans.principal,
      client_name: inst.loans.clients.name
    }));
  }

  const result = await executeSql(
    `SELECT li.*, l.client_id, l.principal,
            c.name as client_name
     FROM loan_installments li
     JOIN loans l ON li.loan_id = l.id
     JOIN clients c ON c.id = l.client_id
     WHERE li.paid = 0
       AND li.deleted = 0
       AND c.deleted = 0
       AND (? IS NULL OR c.owner_id = ?)
     ORDER BY li.due_date ASC, li.number ASC;`,
    [ownerId, ownerId]
  );
  const rows = result.rows?._array ?? [];
  return rows;
}

export async function getPendingInstallmentsByLoan(loanId) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('loan_installments')
      .select('*')
      .eq('loan_id', loanId)
      .eq('deleted', 0)
      .eq('paid', 0)
      .order('due_date', { ascending: true })
      .order('number', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  const result = await executeSql(
    `SELECT *
     FROM loan_installments
     WHERE loan_id = ? AND deleted = 0 AND paid = 0
     ORDER BY due_date ASC, number ASC;`,
    [loanId]
  );
  const rows = result.rows?._array ?? [];
  return rows;
}

export async function markInstallmentPaid(
  installmentId,
  paidDate,
  amount,
  target = "BOTH"
) {
  const when = paidDate || new Date().toISOString().slice(0, 10);
  const valueRaw = amount != null ? Number(amount) : null;

  if (!valueRaw || valueRaw <= 0) {
    return;
  }

  // Versión simplificada para web
  if (Platform.OS === 'web') {
    console.log('markInstallmentPaid - web version', { installmentId, paidDate, amount, target });
    
    const { data: inst, error: instError } = await supabase
      .from('loan_installments')
      .select('*')
      .eq('id', installmentId)
      .single();
    
    if (instError) {
      console.error('Error fetching installment:', instError);
      throw instError;
    }
    if (!inst) {
      console.error('Installment not found');
      return;
    }
    
    console.log('Found installment:', inst);
    
    const baseCapital = Number(inst.amount_capital) || 0;
    const baseInterest = Number(inst.amount_interest) || 0;
    const prevPaidAmount = inst.paid_amount != null ? Number(inst.paid_amount) : 0;
    const prevPaidCapital = inst.paid_capital != null ? Number(inst.paid_capital) : 0;
    const prevPaidInterest = inst.paid_interest != null ? Number(inst.paid_interest) : 0;
    
    console.log('Payment amounts:', {
      baseCapital,
      baseInterest,
      prevPaidCapital,
      prevPaidInterest,
      prevPaidAmount
    });
    
    const remainingCapital = Math.max(baseCapital - prevPaidCapital, 0);
    const remainingInterest = Math.max(baseInterest - prevPaidInterest, 0);
    const remainingTotal = remainingCapital + remainingInterest;
    
    console.log('Remaining amounts:', {
      remainingCapital,
      remainingInterest,
      remainingTotal,
      payment: valueRaw,
      target
    });
    
    if (remainingTotal <= 0) {
      console.log('No remaining amount to pay');
      return;
    }
    
    const payment = Math.min(valueRaw, remainingTotal);
    let addCapital = 0;
    let addInterest = 0;
    
    if (target === "CAPITAL") {
      addCapital = Math.min(payment, remainingCapital);
    } else if (target === "INTEREST") {
      addInterest = Math.min(payment, remainingInterest);
    } else {
      const toInterest = Math.min(payment, remainingInterest);
      const toCapital = Math.min(payment - toInterest, remainingCapital);
      addInterest = toInterest;
      addCapital = toCapital;
    }
    
    console.log('Payment distribution:', {
      addCapital,
      addInterest,
      totalPayment: payment
    });
    
    const newPaidCapital = prevPaidCapital + addCapital;
    const newPaidInterest = prevPaidInterest + addInterest;
    const newPaidAmount = prevPaidAmount + payment;
    
    const fullyPaid = 
      newPaidCapital >= baseCapital - 0.01 &&
      newPaidInterest >= baseInterest - 0.01;
    
    console.log('Updating installment with:', {
      fullyPaid,
      paid_date: when,
      paid_amount: newPaidAmount,
      paid_capital: newPaidCapital,
      paid_interest: newPaidInterest
    });
    
    const { error: updateError } = await supabase
      .from('loan_installments')
      .update({
        paid: fullyPaid ? 1 : 0,
        paid_date: when,
        paid_amount: newPaidAmount,
        paid_capital: newPaidCapital,
        paid_interest: newPaidInterest,
        updated_at: new Date().toISOString()
      })
      .eq('id', installmentId);
    
    if (updateError) {
      console.error('Error updating installment:', updateError);
      throw updateError;
    }
    
    console.log('Installment updated successfully');
    
    // Verificar si el préstamo está totalmente pagado
    const { data: allInst } = await supabase
      .from('loan_installments')
      .select('id, amount_capital, amount_interest, paid, paid_amount')
      .eq('loan_id', inst.loan_id)
      .eq('deleted', 0);
    
    let scheduledTotal = 0;
    let paidTotal = 0;
    
    (allInst || []).forEach(i => {
      const base = (Number(i.amount_capital) || 0) + (Number(i.amount_interest) || 0);
      scheduledTotal += base;
      let paidAmt = 0;
      if (i.paid_amount != null) {
        paidAmt = Number(i.paid_amount) || 0;
      } else if (i.paid === 1) {
        paidAmt = base;
      }
      paidTotal += paidAmt;
    });
    
    if (paidTotal + 0.01 >= scheduledTotal) {
      const today = new Date().toISOString().slice(0, 10);
      
      await supabase
        .from('loan_installments')
        .update({
          paid: 1,
          paid_date: today,
          updated_at: new Date().toISOString()
        })
        .eq('loan_id', inst.loan_id)
        .eq('deleted', 0)
        .eq('paid', 0);
      
      await supabase
        .from('loans')
        .update({
          status: 'PAID',
          closed_at: today,
          updated_at: new Date().toISOString()
        })
        .eq('id', inst.loan_id);
    }
    
    return;
  }

  // Obtener la cuota actual para saber capital/interés restantes.
  const instRes = await executeSql(
    `SELECT loan_id, number, due_date,
            amount_capital, amount_interest,
            paid_amount, paid_capital, paid_interest
     FROM loan_installments
     WHERE id = ? LIMIT 1;`,
    [installmentId]
  );
  const instRows = instRes.rows?._array ?? [];
  const inst = instRows[0];
  if (!inst) return;

  const baseCapital = Number(inst.amount_capital) || 0;
  const baseInterest = Number(inst.amount_interest) || 0;
  const prevPaidAmount = inst.paid_amount != null ? Number(inst.paid_amount) : 0;
  const prevPaidCapital = inst.paid_capital != null ? Number(inst.paid_capital) : 0;
  const prevPaidInterest = inst.paid_interest != null ? Number(inst.paid_interest) : 0;

  const remainingCapital = Math.max(baseCapital - prevPaidCapital, 0);
  const remainingInterest = Math.max(baseInterest - prevPaidInterest, 0);
  const remainingTotal = remainingCapital + remainingInterest;

  if (remainingTotal <= 0) {
    return;
  }

  // No permitir pagar más de lo que falta en esta cuota.
  const payment = Math.min(valueRaw, remainingTotal);

  let addCapital = 0;
  let addInterest = 0;

  if (target === "CAPITAL") {
    addCapital = Math.min(payment, remainingCapital);
  } else if (target === "INTEREST") {
    addInterest = Math.min(payment, remainingInterest);
  } else {
    // BOTH: primero interés, luego capital.
    const toInterest = Math.min(payment, remainingInterest);
    const toCapital = Math.min(payment - toInterest, remainingCapital);
    addInterest = toInterest;
    addCapital = toCapital;
  }

  const newPaidCapital = prevPaidCapital + addCapital;
  const newPaidInterest = prevPaidInterest + addInterest;
  const newPaidAmount = prevPaidAmount + payment;

  const remainingCapitalAfter = Math.max(baseCapital - newPaidCapital, 0);
  const remainingInterestAfter = Math.max(baseInterest - newPaidInterest, 0);
  const remainingTotalAfter = remainingCapitalAfter + remainingInterestAfter;

  // Comprobar si esta es la última cuota del préstamo.
  const loanId = inst.loan_id;
  const currentNumber = Number(inst.number) || 0;
  let isLastInstallment = false;
  let lastNumber = currentNumber;
  try {
    const lastRes = await executeSql(
      `SELECT MAX(number) as max_number
       FROM loan_installments
       WHERE loan_id = ? AND deleted = 0;`,
      [loanId]
    );
    const lastRows = lastRes.rows?._array ?? [];
      if (lastRows[0] && lastRows[0].max_number != null) {
        lastNumber = Number(lastRows[0].max_number) || currentNumber;
      }
    isLastInstallment = currentNumber === lastNumber;
  } catch {
    isLastInstallment = false;
  }

  const shouldCreateExtraInstallment =
    isLastInstallment && remainingTotalAfter > 0;

  let fullyPaid = false;
  if (shouldCreateExtraInstallment) {
    // Si es la última cuota y queda remanente, marcamos esta cuota
    // como pagada y creamos una nueva para el saldo pendiente.
    fullyPaid = true;
  } else if (target === "CAPITAL" || target === "INTEREST") {
    // Si el usuario decide pagar solo capital o solo interés,
    // consideramos la cuota como "atendida" aunque el monto sea menor
    // al valor total programado de la cuota.
    fullyPaid = payment > 0;
  } else {
    // Para pagos de "Cuota" (BOTH) mantenemos la lógica estándar:
    // solo se marca como pagada cuando capital e interés están cubiertos.
    fullyPaid =
      newPaidCapital >= baseCapital - 0.01 &&
      newPaidInterest >= baseInterest - 0.01;
  }

  // Si vamos a crear una cuota extra, "partimos" la cuota actual:
  // esta cuota conservará solo la parte ya pagada (capital/interés),
  // y la nueva cuota representará el remanente. Así evitamos duplicar
  // capital/interés en el total programado del préstamo.
  const storedAmountCapital = shouldCreateExtraInstallment
    ? newPaidCapital
    : baseCapital;
  const storedAmountInterest = shouldCreateExtraInstallment
    ? newPaidInterest
    : baseInterest;

  await executeSql(
    `UPDATE loan_installments
     SET amount_capital = ?,
         amount_interest = ?,
         paid = ?,
         paid_date = ?,
         paid_amount = ?,
         paid_capital = ?,
         paid_interest = ?,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [
      storedAmountCapital,
      storedAmountInterest,
      fullyPaid ? 1 : 0,
      when,
      newPaidAmount,
      newPaidCapital,
      newPaidInterest,
      installmentId
    ]
  );

  // Agregar a cola de sincronización
  await syncManager.addToQueue({
    table: 'loan_installments',
    action: 'update',
    data: {
      id: installmentId,
      amount_capital: storedAmountCapital,
      amount_interest: storedAmountInterest,
      paid: fullyPaid ? 1 : 0,
      paid_date: when,
      paid_amount: newPaidAmount,
      paid_capital: newPaidCapital,
      paid_interest: newPaidInterest,
      updated_at: new Date().toISOString()
    }
  });

  // Si estamos en la última cuota y quedó un remanente, crear una nueva cuota
  // con el saldo pendiente para permitir seguir pagando.
  if (shouldCreateExtraInstallment) {
    try {
      // Calcular el número de la nueva cuota.
      const newNumber = lastNumber + 1;

      // Calcular la nueva fecha de vencimiento: un período después de la actual.
      let newDueDate = inst.due_date;
      try {
        const loanRes = await executeSql(
          `SELECT charge_frequency FROM loans WHERE id = ? LIMIT 1;`,
          [loanId]
        );
        const loanRows = loanRes.rows?._array ?? [];
        const freq = loanRows[0]?.charge_frequency || "MONTHLY";
        const baseDate = inst.due_date
          ? new Date(inst.due_date)
          : new Date();
        const nextDate = addPeriod(baseDate, 1, freq);
        newDueDate = formatDateISO(nextDate);
      } catch {
        // Si algo falla, usamos la misma fecha de vencimiento original.
        newDueDate = inst.due_date;
      }

      const now = new Date().toISOString();

      await executeSql(
        `INSERT INTO loan_installments (
           loan_id, number, due_date, amount_capital, amount_interest,
           paid, paid_date, created_at, updated_at, pending_sync
         )
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, 1);`,
        [
          loanId,
          newNumber,
          newDueDate,
          remainingCapitalAfter,
          remainingInterestAfter,
          now,
          now
        ]
      );
    } catch {
      // En caso de error al crear la nueva cuota, lo ignoramos para no bloquear el pago.
    }
  }

  // Ajustar el resto del préstamo si ya se alcanzó el total a pagar.
  await reconcileLoanAfterPayment(installmentId);
}

export async function deleteLoan(loanId) {
  if (Platform.OS === 'web') {
    const now = new Date().toISOString();
    
    const { error: loanError } = await supabase
      .from('loans')
      .update({ deleted: 1, updated_at: now })
      .eq('id', loanId);
    
    if (loanError) throw loanError;
    
    const { error: installmentError } = await supabase
      .from('loan_installments')
      .update({ deleted: 1, updated_at: now })
      .eq('loan_id', loanId);
    
    if (installmentError) throw installmentError;
    return;
  }

  const now = new Date().toISOString();

  await executeSql(
    `UPDATE loans
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [loanId]
  );

  await executeSql(
    `UPDATE loan_installments
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE loan_id = ?;`,
    [loanId]
  );

  // Agregar a cola de sincronización
  await syncManager.addToQueue({
    table: 'loans',
    action: 'update',
    data: {
      id: loanId,
      deleted: 1,
      updated_at: now
    }
  });
}

export async function deletePayment(installmentId) {
  if (Platform.OS === 'web') {
    const now = new Date().toISOString();
    
    // Obtener el loan_id primero
    const { data: installment } = await supabase
      .from('loan_installments')
      .select('loan_id')
      .eq('id', installmentId)
      .single();
    
    const { error: installmentError } = await supabase
      .from('loan_installments')
      .update({
        paid: 0,
        paid_date: null,
        paid_amount: null,
        paid_capital: null,
        paid_interest: null,
        updated_at: now
      })
      .eq('id', installmentId);
    
    if (installmentError) throw installmentError;
    
    if (installment) {
      const { error: loanError } = await supabase
        .from('loans')
        .update({
          status: 'ACTIVE',
          closed_at: null,
          updated_at: now
        })
        .eq('id', installment.loan_id);
      
      if (loanError) throw loanError;
    }
    return;
  }

  await executeSql(
    `UPDATE loan_installments
     SET paid = 0,
         paid_date = NULL,
         paid_amount = NULL,
         paid_capital = NULL,
         paid_interest = NULL,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [installmentId]
  );

  // Asegurar que el préstamo vuelva a estado ACTIVO.
  await executeSql(
    `UPDATE loans
     SET status = 'ACTIVE',
         closed_at = NULL,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = (SELECT loan_id FROM loan_installments WHERE id = ? LIMIT 1);`,
    [installmentId]
  );
}

async function reconcileLoanAfterPayment(installmentId) {
  // Obtener el préstamo asociado a la cuota.
  const instResult = await executeSql(
    `SELECT loan_id FROM loan_installments WHERE id = ? LIMIT 1;`,
    [installmentId]
  );
  const instRows = instResult.rows?._array ?? [];
  const row = instRows[0];
  if (!row) return;

  const loanId = row.loan_id;

  // Obtener todas las cuotas del préstamo.
  const allResult = await executeSql(
    `SELECT id, amount_capital, amount_interest, paid, paid_amount
     FROM loan_installments
     WHERE loan_id = ? AND deleted = 0;`,
    [loanId]
  );
  const all = allResult.rows?._array ?? [];
  if (!all.length) return;

  let scheduledTotal = 0;
  let paidTotal = 0;

  for (const inst of all) {
    const base =
      (Number(inst.amount_capital) || 0) +
      (Number(inst.amount_interest) || 0);
    scheduledTotal += base;
    let paidAmount = 0;
    if (inst.paid_amount != null) {
      paidAmount = Number(inst.paid_amount) || 0;
    } else if (inst.paid === 1) {
      paidAmount = base;
    }
    paidTotal += paidAmount;
  }

  // Si el total pagado alcanza o supera el total programado, marcamos el resto de cuotas como pagadas
  // y cerramos el préstamo.
  if (paidTotal + 0.01 >= scheduledTotal) {
    const today = new Date().toISOString().slice(0, 10);

    // Marcar cuotas restantes como pagadas sin sumar más a paid_amount.
    await executeSql(
      `UPDATE loan_installments
       SET paid = 1,
           paid_date = COALESCE(paid_date, ?),
           updated_at = datetime('now'),
           pending_sync = 1
       WHERE loan_id = ? AND deleted = 0 AND paid = 0;`,
      [today, loanId]
    );

    // Actualizar estado del préstamo.
    await executeSql(
      `UPDATE loans
       SET status = 'PAID',
           closed_at = ?,
           updated_at = datetime('now'),
           pending_sync = 1
       WHERE id = ?;`,
      [today, loanId]
    );
  }
}
