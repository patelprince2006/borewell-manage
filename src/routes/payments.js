import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

// GET all payments
router.get('/', async (req, res) => {
  try {
    const { farmer_id } = req.query;
    let sql = `
      SELECT 
        p.id,
        p.farmer_id,
        f.name AS farmer_name,
        f.village AS farmer_village,
        p.water_entry_id,
        p.amount_paid,
        p.payment_date,
        p.payment_method,
        p.notes,
        p.created_at
      FROM payments p
      JOIN farmers f ON p.farmer_id = f.id
    `;
    const params = [];
    if (farmer_id) {
      params.push(farmer_id);
      sql += ' WHERE p.farmer_id = $1';
    }
    sql += ' ORDER BY p.payment_date DESC, p.id DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ success: false, message: 'ચૂકવણીની માહિતી મેળવવામાં ભૂલ (Failed to fetch payments)' });
  }
});

// POST record new payment
router.post('/', async (req, res) => {
  const { farmer_id, water_entry_id, amount_paid, payment_date, payment_method, notes } = req.body;

  if (!farmer_id || !amount_paid || !payment_date) {
    return res.status(400).json({
      success: false,
      message: 'ખેડૂત, રકમ અને તારીખ જરૂરી છે (Farmer, amount, and payment date are required)',
    });
  }

  const amount = parseFloat(amount_paid);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'માન્ય રકમ દાખલ કરો (Please enter a valid positive amount)' });
  }

  try {
    const result = await query(
      `INSERT INTO payments (
        farmer_id,
        water_entry_id,
        amount_paid,
        payment_date,
        payment_method,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        farmer_id,
        water_entry_id || null,
        amount,
        payment_date,
        payment_method || 'Cash',
        (notes || '').trim(),
      ]
    );

    // Compute updated balance for this farmer
    const balanceRes = await query(
      `SELECT 
        COALESCE(SUM(w.total_amount), 0) AS total_bill,
        COALESCE(p.total_paid, 0) AS total_paid,
        (COALESCE(SUM(w.total_amount), 0) - COALESCE(p.total_paid, 0)) AS remaining_balance
       FROM farmers f
       LEFT JOIN water_entries w ON f.id = w.farmer_id
       LEFT JOIN (
         SELECT farmer_id, SUM(amount_paid) AS total_paid
         FROM payments WHERE farmer_id = $1
         GROUP BY farmer_id
       ) p ON f.id = p.farmer_id
       WHERE f.id = $1
       GROUP BY p.total_paid`,
      [farmer_id]
    );

    const balanceData = balanceRes.rows[0] || { total_bill: 0, total_paid: 0, remaining_balance: 0 };
    const remaining = parseFloat(balanceData.remaining_balance);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      balance: {
        total_bill: parseFloat(balanceData.total_bill),
        total_paid: parseFloat(balanceData.total_paid),
        remaining_balance: remaining,
        status: remaining <= 0 ? 'Paid' : 'Pending',
      },
      message: 'ચૂકવણી સફળતાપૂર્વક સાચવવામાં આવી (Payment saved successfully)',
    });
  } catch (err) {
    console.error('Error saving payment:', err);
    res.status(500).json({ success: false, message: 'ચૂકવણી સાચવવામાં ભૂલ (Failed to save payment)' });
  }
});

// DELETE payment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM payments WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ચૂકવણી મળી નથી (Payment record not found)' });
    }
    res.json({ success: true, message: 'ચૂકવણી સફળતાપૂર્વક કાઢી નાખવામાં આવી (Payment deleted successfully)' });
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({ success: false, message: 'ચૂકવણી કાઢી નાખવામાં ભૂલ (Failed to delete payment)' });
  }
});

export default router;
