import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

/**
 * Calculates duration between start and end time.
 * Handles 24h ('06:30', '18:45') and 12h ('06:30 AM', '09:00 PM').
 * Also handles sessions crossing midnight (e.g., 22:00 to 02:00 = 4.0 hrs).
 */
export function calculateHours(startTimeStr, endTimeStr) {
  function parseTimeToMinutes(tStr) {
    if (!tStr) return 0;
    const clean = tStr.trim();
    // Check if 12h format AM/PM
    const isAmPm = /am|pm/i.test(clean);
    if (isAmPm) {
      const match = clean.match(/(\d+):(\d+)\s*(am|pm)/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3].toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        return h * 60 + m;
      }
    }
    // 24h format HH:MM
    const parts = clean.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }

  const startMins = parseTimeToMinutes(startTimeStr);
  const endMins = parseTimeToMinutes(endTimeStr);

  let diffMins = endMins - startMins;
  // If end time is before or equal to start time, assuming crossed midnight
  if (diffMins <= 0) {
    diffMins += 24 * 60;
  }

  const hours = diffMins / 60;
  return Math.round(hours * 100) / 100; // Round to 2 decimal places
}

// GET water entries (with optional farmer_id and date filtering)
router.get('/', async (req, res) => {
  try {
    const { farmer_id, start_date, end_date } = req.query;

    let sql = `
      SELECT 
        w.id,
        w.farmer_id,
        f.name AS farmer_name,
        f.village AS farmer_village,
        w.crop_name,
        w.entry_date,
        w.start_time,
        w.end_time,
        w.total_hours,
        w.hourly_rate,
        w.total_amount,
        w.notes,
        w.created_at
      FROM water_entries w
      JOIN farmers f ON w.farmer_id = f.id
      WHERE 1=1
    `;
    const params = [];

    if (farmer_id) {
      params.push(farmer_id);
      sql += ` AND w.farmer_id = $${params.length}`;
    }
    if (start_date) {
      params.push(start_date);
      sql += ` AND w.entry_date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      sql += ` AND w.entry_date <= $${params.length}`;
    }

    sql += ' ORDER BY w.entry_date DESC, w.id DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching water entries:', err);
    res.status(500).json({ success: false, message: 'પાણીની નોંધ મેળવવામાં ભૂલ (Failed to fetch water entries)' });
  }
});

// POST new water entry
router.post('/', async (req, res) => {
  const {
    farmer_id,
    crop_name,
    entry_date,
    start_time,
    end_time,
    hourly_rate,
    total_hours: userProvidedHours,
    notes,
  } = req.body;

  if (!farmer_id || !crop_name || !entry_date || !start_time || !end_time) {
    return res.status(400).json({
      success: false,
      message: 'ખેડૂત, પાક, તારીખ, શરૂ સમય અને અંત સમય જરૂરી છે (Farmer, crop, date, start time, and end time are required)',
    });
  }

  const rate = parseFloat(hourly_rate);
  if (isNaN(rate) || rate < 0) {
    return res.status(400).json({ success: false, message: 'માન્ય કલાક દીઠ ભાવ દાખલ કરો (Invalid hourly rate)' });
  }

  // Calculate actual hours (or use userProvidedHours if explicitly calculated and provided)
  const calcHours = userProvidedHours ? parseFloat(userProvidedHours) : calculateHours(start_time, end_time);
  if (isNaN(calcHours) || calcHours <= 0) {
    return res.status(400).json({ success: false, message: 'માન્ય સમય દાખલ કરો (Invalid water supply hours)' });
  }

  const totalAmount = Math.round(calcHours * rate * 100) / 100;

  try {
    const result = await query(
      `INSERT INTO water_entries (
        farmer_id,
        crop_name,
        entry_date,
        start_time,
        end_time,
        total_hours,
        hourly_rate,
        total_amount,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        farmer_id,
        crop_name.trim(),
        entry_date,
        start_time.trim(),
        end_time.trim(),
        calcHours,
        rate,
        totalAmount,
        (notes || '').trim(),
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'પાણીની નોંધ સફળતાપૂર્વક સાચવવામાં આવી (Water supply entry saved successfully)',
    });
  } catch (err) {
    console.error('Error creating water entry:', err);
    res.status(500).json({ success: false, message: 'પાણીની નોંધ સાચવવામાં ભૂલ (Failed to save water entry)' });
  }
});

// DELETE water entry
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM water_entries WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'નોંધ મળી નથી (Water entry not found)' });
    }
    res.json({ success: true, message: 'પાણીની નોંધ કાઢી નાખવામાં આવી (Entry deleted successfully)' });
  } catch (err) {
    console.error('Error deleting water entry:', err);
    res.status(500).json({ success: false, message: 'નોંધ કાઢી નાખવામાં ભૂલ (Failed to delete water entry)' });
  }
});

export default router;
