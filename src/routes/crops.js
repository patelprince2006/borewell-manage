import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

// GET all crops
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM crops ORDER BY name_en ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching crops:', err);
    res.status(500).json({ success: false, message: 'પાક યાદી મેળવવામાં ભૂલ (Failed to fetch crops)' });
  }
});

// POST add new crop
router.post('/', async (req, res) => {
  const { name_en, name_gu, default_hourly_rate } = req.body;
  if (!name_en || !default_hourly_rate) {
    return res.status(400).json({ success: false, message: 'પાકનું નામ અને કલાક દીઠ ભાવ જરૂરી છે (Crop name and hourly rate are required)' });
  }

  try {
    const result = await query(
      `INSERT INTO crops (name_en, name_gu, default_hourly_rate)
       VALUES ($1, $2, $3)
       ON CONFLICT (name_en) DO UPDATE SET
         name_gu = EXCLUDED.name_gu,
         default_hourly_rate = EXCLUDED.default_hourly_rate
       RETURNING *`,
      [name_en.trim(), (name_gu || name_en).trim(), parseFloat(default_hourly_rate)]
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'પાક સફળતાપૂર્વક સાચવવામાં આવ્યો (Crop saved successfully)' });
  } catch (err) {
    console.error('Error adding crop:', err);
    res.status(500).json({ success: false, message: 'પાક સાચવવામાં ભૂલ (Failed to save crop)' });
  }
});

// PUT update crop rate
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { default_hourly_rate, name_gu } = req.body;

  try {
    const result = await query(
      `UPDATE crops
       SET default_hourly_rate = COALESCE($1, default_hourly_rate),
           name_gu = COALESCE($2, name_gu)
       WHERE id = $3
       RETURNING *`,
      [default_hourly_rate !== undefined ? parseFloat(default_hourly_rate) : null, name_gu || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'પાક મળ્યો નથી (Crop not found)' });
    }

    res.json({ success: true, data: result.rows[0], message: 'પાકનો ભાવ સફળતાપૂર્વક અપડેટ થયો (Crop rate updated successfully)' });
  } catch (err) {
    console.error('Error updating crop:', err);
    res.status(500).json({ success: false, message: 'પાક અપડેટ કરવામાં ભૂલ (Failed to update crop)' });
  }
});

export default router;
