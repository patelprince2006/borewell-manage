-- Borewell Water Hisab (બોરવેલ પાણી હિસાબ) Database Schema

CREATE TABLE IF NOT EXISTS crops (
    id SERIAL PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL UNIQUE,
    name_gu VARCHAR(100) NOT NULL,
    default_hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS farmers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    mobile VARCHAR(20),
    village VARCHAR(100),
    crop_name VARCHAR(100),
    farm_identifier VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS water_entries (
    id SERIAL PRIMARY KEY,
    farmer_id INT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    entry_date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    total_hours NUMERIC(6, 2) NOT NULL,
    hourly_rate NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    farmer_id INT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    water_entry_id INT REFERENCES water_entries(id) ON DELETE SET NULL,
    amount_paid NUMERIC(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial default crops
INSERT INTO crops (name_en, name_gu, default_hourly_rate) VALUES
('Cotton', 'કપાસ', 200.00),
('Wheat', 'ઘઉં', 180.00),
('Groundnut', 'મગફળી', 220.00),
('Cumin', 'જીરું', 210.00),
('Mustard', 'રાયડો', 190.00),
('Castor', 'એરંડા (દિવેલા)', 200.00),
('Bajra', 'બાજરી', 180.00)
ON CONFLICT (name_en) DO NOTHING;

-- Seed sample farmers if table is empty
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM farmers) THEN
        INSERT INTO farmers (name, mobile, village, crop_name, farm_identifier) VALUES
        ('Ramesh Patel (રમેશભાઈ પટેલ)', '9876543210', 'Pipardi (પીપરડી)', 'Cotton', 'Khata No. 42'),
        ('Suresh Patel (સુરેશભાઈ પટેલ)', '9898123456', 'Anandpar (આણંદપર)', 'Wheat', 'Plot 12'),
        ('Mahesh Patel (મહેશભાઈ પટેલ)', '9723456789', 'Motavad (મોટાવડ)', 'Groundnut', 'Survey 88');

        -- Seed initial water entry: Ramesh Patel Cotton 15 hours total
        -- 30/10/2026: 06:00 to 09:00 = 3h @ 200 = 600
        INSERT INTO water_entries (farmer_id, crop_name, entry_date, start_time, end_time, total_hours, hourly_rate, total_amount, notes)
        SELECT id, 'Cotton', CURRENT_DATE, '06:00 AM', '09:00 AM', 3.00, 200.00, 600.00, 'Morning irrigation'
        FROM farmers WHERE name LIKE 'Ramesh Patel%' LIMIT 1;

        -- Previous entries for Ramesh Patel to make total 15 hours
        INSERT INTO water_entries (farmer_id, crop_name, entry_date, start_time, end_time, total_hours, hourly_rate, total_amount, notes)
        SELECT id, 'Cotton', CURRENT_DATE - INTERVAL '3 days', '07:00 AM', '01:00 PM', 6.00, 200.00, 1200.00, 'First turn'
        FROM farmers WHERE name LIKE 'Ramesh Patel%' LIMIT 1;

        INSERT INTO water_entries (farmer_id, crop_name, entry_date, start_time, end_time, total_hours, hourly_rate, total_amount, notes)
        SELECT id, 'Cotton', CURRENT_DATE - INTERVAL '7 days', '06:00 AM', '12:00 PM', 6.00, 200.00, 1200.00, 'Previous week'
        FROM farmers WHERE name LIKE 'Ramesh Patel%' LIMIT 1;

        -- Ramesh Patel payment: 1000
        INSERT INTO payments (farmer_id, amount_paid, payment_date, payment_method, notes)
        SELECT id, 1000.00, CURRENT_DATE - INTERVAL '1 day', 'Cash', 'Advance deposit'
        FROM farmers WHERE name LIKE 'Ramesh Patel%' LIMIT 1;

        -- Suresh Patel: 10 hours @ 180 = 1800, plus extra to match 2000 or custom 200/hr = 2000
        INSERT INTO water_entries (farmer_id, crop_name, entry_date, start_time, end_time, total_hours, hourly_rate, total_amount, notes)
        SELECT id, 'Wheat', CURRENT_DATE - INTERVAL '2 days', '08:00 AM', '06:00 PM', 10.00, 200.00, 2000.00, 'Full day irrigation'
        FROM farmers WHERE name LIKE 'Suresh Patel%' LIMIT 1;

        INSERT INTO payments (farmer_id, amount_paid, payment_date, payment_method, notes)
        SELECT id, 2000.00, CURRENT_DATE, 'UPI', 'Full payment done via GPay'
        FROM farmers WHERE name LIKE 'Suresh Patel%' LIMIT 1;

        -- Mahesh Patel: 12 hours @ 200 = 2400
        INSERT INTO water_entries (farmer_id, crop_name, entry_date, start_time, end_time, total_hours, hourly_rate, total_amount, notes)
        SELECT id, 'Groundnut', CURRENT_DATE - INTERVAL '4 days', '06:00 AM', '06:00 PM', 12.00, 200.00, 2400.00, 'Groundnut watering'
        FROM farmers WHERE name LIKE 'Mahesh Patel%' LIMIT 1;

        INSERT INTO payments (farmer_id, amount_paid, payment_date, payment_method, notes)
        SELECT id, 1000.00, CURRENT_DATE - INTERVAL '2 days', 'Cash', 'Part payment'
        FROM farmers WHERE name LIKE 'Mahesh Patel%' LIMIT 1;
    END IF;
END $$;
