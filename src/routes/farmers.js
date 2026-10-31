import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

// GET all farmers with their total hisab overview
router.get('/', async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let sql = `
      SELECT 
        f.id,
        f.name,
        f.mobile,
        f.village,
        f.crop_name,
        f.farm_identifier,
        f.created_at,
        COALESCE(SUM(w.total_hours), 0) AS total_hours,
        COALESCE(SUM(w.total_amount), 0) AS total_bill,
        COALESCE(p.total_paid, 0) AS total_paid,
        (COALESCE(SUM(w.total_amount), 0) - COALESCE(p.total_paid, 0)) AS remaining_balance
      FROM farmers f
      LEFT JOIN water_entries w ON f.id = w.farmer_id
      LEFT JOIN (
        SELECT farmer_id, SUM(amount_paid) AS total_paid
        FROM payments
        GROUP BY farmer_id
      ) p ON f.id = p.farmer_id
    `;

    const params = [];
    if (search) {
      sql += ` WHERE f.name ILIKE $1 OR f.village ILIKE $1 OR f.mobile ILIKE $1 OR f.farm_identifier ILIKE $1`;
      params.push(search);
    }

    sql += `
      GROUP BY f.id, f.name, f.mobile, f.village, f.crop_name, f.farm_identifier, f.created_at, p.total_paid
      ORDER BY f.id DESC
    `;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching farmers:', err);
    res.status(500).json({ success: false, message: 'ખેડૂતોની યાદી મેળવવામાં ભૂલ (Failed to fetch farmers)' });
  }
});

// GET single farmer by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const farmerRes = await query('SELECT * FROM farmers WHERE id = $1', [id]);
    if (farmerRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ખેડૂત મળ્યા નથી (Farmer not found)' });
    }

    const waterRes = await query(
      'SELECT * FROM water_entries WHERE farmer_id = $1 ORDER BY entry_date DESC, id DESC',
      [id]
    );

    const paymentRes = await query(
      'SELECT * FROM payments WHERE farmer_id = $1 ORDER BY payment_date DESC, id DESC',
      [id]
    );

    const totalHours = waterRes.rows.reduce((sum, r) => sum + parseFloat(r.total_hours || 0), 0);
    const totalBill = waterRes.rows.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);
    const totalPaid = paymentRes.rows.reduce((sum, r) => sum + parseFloat(r.amount_paid || 0), 0);
    const remainingBalance = totalBill - totalPaid;

    res.json({
      success: true,
      data: {
        farmer: farmerRes.rows[0],
        summary: {
          total_hours: totalHours.toFixed(2),
          total_bill: totalBill.toFixed(2),
          total_paid: totalPaid.toFixed(2),
          remaining_balance: remainingBalance.toFixed(2),
        },
        water_entries: waterRes.rows,
        payments: paymentRes.rows,
      },
    });
  } catch (err) {
    console.error('Error fetching farmer details:', err);
    res.status(500).json({ success: false, message: 'ખેડૂતની વિગતો મેળવવામાં ભૂલ (Failed to fetch farmer details)' });
  }
});

// POST add new farmer
router.post('/', async (req, res) => {
  const { name, mobile, village, crop_name, farm_identifier } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'ખેડૂતનું નામ જરૂરી છે (Farmer name is required)' });
  }

  try {
    const result = await query(
      `INSERT INTO farmers (name, mobile, village, crop_name, farm_identifier)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        (mobile || '').trim(),
        (village || '').trim(),
        (crop_name || '').trim(),
        (farm_identifier || '').trim(),
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'ખેડૂતની માહિતી સફળતાપૂર્વક સાચવવામાં આવી (Farmer saved successfully)',
    });
  } catch (err) {
    console.error('Error adding farmer:', err);
    res.status(500).json({ success: false, message: 'ખેડૂત ઉમેરવામાં ભૂલ (Failed to add farmer)' });
  }
});

// PUT update farmer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, mobile, village, crop_name, farm_identifier } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'ખેડૂતનું નામ જરૂરી છે (Farmer name is required)' });
  }

  try {
    const result = await query(
      `UPDATE farmers
       SET name = $1,
           mobile = $2,
           village = $3,
           crop_name = $4,
           farm_identifier = $5
       WHERE id = $6
       RETURNING *`,
      [
        name.trim(),
        (mobile || '').trim(),
        (village || '').trim(),
        (crop_name || '').trim(),
        (farm_identifier || '').trim(),
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ખેડૂત મળ્યા નથી (Farmer not found)' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'ખેડૂતની માહિતી સફળતાપૂર્વક સુધારાઈ (Farmer updated successfully)',
    });
  } catch (err) {
    console.error('Error updating farmer:', err);
    res.status(500).json({ success: false, message: 'ખેડૂત સુધારવામાં ભૂલ (Failed to update farmer)' });
  }
});

// DELETE farmer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM farmers WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ખેડૂત મળ્યા નથી (Farmer not found)' });
    }
    res.json({ success: true, message: 'ખેડૂત સફળતાપૂર્વક કાઢી નાખવામાં આવ્યા (Farmer deleted successfully)' });
  } catch (err) {
    console.error('Error deleting farmer:', err);
    res.status(500).json({ success: false, message: 'ખેડૂત કાઢી નાખવામાં ભૂલ (Failed to delete farmer)' });
  }
});

export default router;
