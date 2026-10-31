import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

// GET top dashboard summary
router.get('/summary', async (req, res) => {
  try {
    // 1. Total Farmers
    const farmersCountRes = await query('SELECT COUNT(*) AS total_farmers FROM farmers');
    const totalFarmers = parseInt(farmersCountRes.rows[0].total_farmers, 10) || 0;

    // 2. All-Time & Today's Water Supply and Bills
    const totalsRes = await query(
      `SELECT 
         COALESCE(SUM(total_hours), 0) AS total_hours,
         COALESCE(SUM(total_amount), 0) AS total_bill,
         COALESCE(SUM(CASE WHEN entry_date = CURRENT_DATE THEN total_hours ELSE 0 END), 0) AS today_hours,
         COALESCE(SUM(CASE WHEN entry_date = CURRENT_DATE THEN total_amount ELSE 0 END), 0) AS today_bill
       FROM water_entries`
    );
    const totalHours = parseFloat(totalsRes.rows[0].total_hours) || 0;
    const totalBill = parseFloat(totalsRes.rows[0].total_bill) || 0;
    const todayHours = parseFloat(totalsRes.rows[0].today_hours) || 0;
    const todayBill = parseFloat(totalsRes.rows[0].today_bill) || 0;

    // 3. Total Pending Amount = All time total bills - All time total payments
    const pendingRes = await query(
      `SELECT 
         (SELECT COALESCE(SUM(total_amount), 0) FROM water_entries) -
         (SELECT COALESCE(SUM(amount_paid), 0) FROM payments) AS total_pending`
    );
    const totalPending = parseFloat(pendingRes.rows[0].total_pending) || 0;

    res.json({
      success: true,
      data: {
        total_farmers: totalFarmers,
        total_hours: totalHours.toFixed(2),
        total_bill: totalBill.toFixed(2),
        today_hours: todayHours.toFixed(2),
        today_bill: todayBill.toFixed(2),
        total_pending: totalPending > 0 ? totalPending.toFixed(2) : '0.00',
      },
    });
  } catch (err) {
    console.error('Error fetching hisab summary:', err);
    res.status(500).json({ success: false, message: 'હિસાબ સારાંશ મેળવવામાં ભૂલ (Failed to fetch summary)' });
  }
});

// GET single farmer's calculated bill for date range
router.get('/farmer-bill', async (req, res) => {
  try {
    const { farmer_id, start_date, end_date } = req.query;

    if (!farmer_id) {
      return res.status(400).json({ success: false, message: 'ખેડૂત પસંદ કરો (Please select a farmer)' });
    }

    const farmerRes = await query('SELECT * FROM farmers WHERE id = $1', [farmer_id]);
    if (farmerRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ખેડૂત મળ્યા નથી (Farmer not found)' });
    }
    const farmer = farmerRes.rows[0];

    let entrySql = `
      SELECT id, crop_name, entry_date, start_time, end_time, total_hours, hourly_rate, total_amount, notes
      FROM water_entries
      WHERE farmer_id = $1
    `;
    const entryParams = [farmer_id];

    if (start_date) {
      entryParams.push(start_date);
      entrySql += ` AND entry_date >= $${entryParams.length}`;
    }
    if (end_date) {
      entryParams.push(end_date);
      entrySql += ` AND entry_date <= $${entryParams.length}`;
    }

    entrySql += ' ORDER BY entry_date ASC, id ASC';
    const entriesRes = await query(entrySql, entryParams);

    // Payments in this period or all payments for this farmer
    let paySql = `
      SELECT id, amount_paid, payment_date, payment_method, notes
      FROM payments
      WHERE farmer_id = $1
    `;
    const payParams = [farmer_id];
    if (start_date) {
      payParams.push(start_date);
      paySql += ` AND payment_date >= $${payParams.length}`;
    }
    if (end_date) {
      payParams.push(end_date);
      paySql += ` AND payment_date <= $${payParams.length}`;
    }
    paySql += ' ORDER BY payment_date ASC, id ASC';
    const paymentsRes = await query(paySql, payParams);

    const totalHours = entriesRes.rows.reduce((s, r) => s + parseFloat(r.total_hours || 0), 0);
    const totalBill = entriesRes.rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
    const totalPaid = paymentsRes.rows.reduce((s, r) => s + parseFloat(r.amount_paid || 0), 0);
    const remainingAmount = Math.max(0, totalBill - totalPaid);

    // Calculate effective average or predominant hourly rate
    const predominantRate = entriesRes.rows.length > 0
      ? entriesRes.rows[0].hourly_rate
      : 200.00;

    res.json({
      success: true,
      data: {
        farmer,
        filter: {
          start_date: start_date || 'All Time',
          end_date: end_date || 'All Time',
        },
        summary: {
          farmer_name: farmer.name,
          village: farmer.village,
          crop: farmer.crop_name || (entriesRes.rows[0] ? entriesRes.rows[0].crop_name : '-'),
          total_hours: totalHours.toFixed(2),
          hourly_rate: predominantRate,
          total_bill: totalBill.toFixed(2),
          amount_paid: totalPaid.toFixed(2),
          remaining_amount: remainingAmount.toFixed(2),
          status: remainingAmount <= 0 ? 'Paid (ચૂકતે)' : 'Pending (બાકી)',
        },
        entries: entriesRes.rows,
        payments: paymentsRes.rows,
      },
    });
  } catch (err) {
    console.error('Error calculating farmer bill:', err);
    res.status(500).json({ success: false, message: 'બિલ ગણતરીમાં ભૂલ (Failed to calculate bill)' });
  }
});

// GET All Farmers' Hisab ledger report
router.get('/all-farmers', async (req, res) => {
  try {
    const { start_date, end_date, search, active_only } = req.query;

    const hasDateFilter = Boolean(start_date || end_date);
    // When date filter is active, default active_only to true unless explicitly 'false'
    const filterActiveOnly = hasDateFilter ? (active_only !== 'false') : (active_only === 'true');

    let sql = `
      SELECT 
        f.id,
        f.name AS farmer_name,
        f.mobile,
        f.village,
        COALESCE(w.crop_name, f.crop_name, '-') AS crop_name,
        f.farm_identifier,
        COALESCE(w.total_hours, 0) AS total_hours,
        COALESCE(w.total_bill, 0) AS total_bill,
        COALESCE(p.total_paid, 0) AS total_paid,
        GREATEST(0, COALESCE(w.total_bill, 0) - COALESCE(p.total_paid, 0)) AS remaining_amount,
        COALESCE(ob.overall_balance, 0) AS overall_balance
      FROM farmers f
      LEFT JOIN (
        SELECT 
          farmer_id,
          STRING_AGG(DISTINCT crop_name, ', ') AS crop_name,
          SUM(total_hours) AS total_hours,
          SUM(total_amount) AS total_bill
        FROM water_entries
        WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      params.push(start_date);
      sql += ` AND entry_date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      sql += ` AND entry_date <= $${params.length}`;
    }

    sql += `
        GROUP BY farmer_id
      ) w ON f.id = w.farmer_id
      LEFT JOIN (
        SELECT 
          farmer_id,
          SUM(amount_paid) AS total_paid
        FROM payments
        WHERE 1=1
    `;

    if (start_date) {
      params.push(start_date);
      sql += ` AND payment_date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      sql += ` AND payment_date <= $${params.length}`;
    }

    sql += `
        GROUP BY farmer_id
      ) p ON f.id = p.farmer_id
      LEFT JOIN (
        SELECT 
          f2.id AS farmer_id,
          (
            COALESCE((SELECT SUM(total_amount) FROM water_entries WHERE farmer_id = f2.id), 0) -
            COALESCE((SELECT SUM(amount_paid) FROM payments WHERE farmer_id = f2.id), 0)
          ) AS overall_balance
        FROM farmers f2
      ) ob ON f.id = ob.farmer_id
      WHERE 1=1
    `;

    if (filterActiveOnly) {
      sql += ` AND (COALESCE(w.total_hours, 0) > 0 OR COALESCE(p.total_paid, 0) > 0)`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (f.name ILIKE $${params.length} OR f.village ILIKE $${params.length} OR f.crop_name ILIKE $${params.length} OR w.crop_name ILIKE $${params.length})`;
    }

    sql += ' ORDER BY f.name ASC';

    const result = await query(sql, params);

    // Compute overall totals
    const grandTotals = result.rows.reduce(
      (acc, row) => {
        acc.total_hours += parseFloat(row.total_hours || 0);
        acc.total_bill += parseFloat(row.total_bill || 0);
        acc.total_paid += parseFloat(row.total_paid || 0);
        acc.total_remaining += parseFloat(row.remaining_amount || 0);
        return acc;
      },
      { total_hours: 0, total_bill: 0, total_paid: 0, total_remaining: 0 }
    );

    res.json({
      success: true,
      data: result.rows,
      totals: {
        total_hours: grandTotals.total_hours.toFixed(2),
        total_bill: grandTotals.total_bill.toFixed(2),
        total_paid: grandTotals.total_paid.toFixed(2),
        total_remaining: grandTotals.total_remaining.toFixed(2),
      },
      filter: {
        start_date: start_date || '',
        end_date: end_date || '',
        search: search || '',
        active_only: filterActiveOnly,
      },
    });
  } catch (err) {
    console.error('Error fetching all farmers hisab:', err);
    res.status(500).json({ success: false, message: 'બધા ખેડૂતોનો હિસાબ મેળવવામાં ભૂલ (Failed to fetch hisab ledger)' });
  }
});

export default router;
