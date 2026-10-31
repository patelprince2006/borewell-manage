// Automated End-to-End Verification Test for Borewell Water Hisab
import { calculateHours } from '../src/routes/waterEntries.js';

const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('🧪 Starting automated E2E tests for Borewell Water Hisab...\n');
  let passCount = 0;
  let failCount = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failCount++;
    }
  }

  try {
    // 1. Duration & Midnight crossing logic
    console.log('1. Testing Duration Calculations & Partial Hours:');
    const h1 = calculateHours('06:00', '09:00');
    assert(h1 === 3.0, `06:00 to 09:00 = 3.0 hrs (got ${h1})`);

    const h2 = calculateHours('14:00', '16:30');
    assert(h2 === 2.5, `14:00 to 16:30 = 2.5 hrs (got ${h2})`);

    const h3 = calculateHours('22:00', '02:00');
    assert(h3 === 4.0, `Midnight crossing 22:00 to 02:00 = 4.0 hrs (got ${h3})`);

    const h4 = calculateHours('06:00 AM', '09:30 AM');
    assert(h4 === 3.5, `12-hour format 06:00 AM to 09:30 AM = 3.5 hrs (got ${h4})`);

    // 2. Test Summary Endpoint
    console.log('\n2. Testing /api/hisab/summary:');
    const sumRes = await fetch(`${BASE_URL}/hisab/summary`).then((r) => r.json());
    assert(sumRes.success === true, 'Summary endpoint returns success');
    assert(typeof sumRes.data.total_farmers === 'number', 'Total farmers count is numeric');
    console.log('     Summary data:', sumRes.data);

    // 3. Test Farmer CRUD
    console.log('\n3. Testing Farmer Management:');
    const newFarmer = {
      name: 'Govindbhai Patel (ગોવિંદભાઈ)',
      mobile: '9998887776',
      village: 'Kotda Sangani',
      crop_name: 'Cumin',
      farm_identifier: 'Khata No. 99',
    };
    const createFarmerRes = await fetch(`${BASE_URL}/farmers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFarmer),
    }).then((r) => r.json());
    assert(createFarmerRes.success === true, 'Created new farmer Govindbhai');
    const farmerId = createFarmerRes.data.id;

    // Search for Govindbhai
    const searchRes = await fetch(`${BASE_URL}/farmers?search=Govindbhai`).then((r) => r.json());
    assert(searchRes.data.some((f) => f.id === farmerId), 'Farmer found via search query');

    // 4. Test Water Supply Entry
    console.log('\n4. Testing Water Supply Entry:');
    // Entry 1: 3 hours @ 200 = 600
    const entry1Res = await fetch(`${BASE_URL}/water-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmer_id: farmerId,
        crop_name: 'Cumin',
        entry_date: '2026-10-30',
        start_time: '06:00',
        end_time: '09:00',
        hourly_rate: 200,
      }),
    }).then((r) => r.json());
    assert(entry1Res.success === true, 'Created water entry (3 hours @ ₹200)');
    assert(parseFloat(entry1Res.data.total_amount) === 600.0, `Total amount = 600 (got ${entry1Res.data.total_amount})`);

    // Entry 2: Partial hours (2.5 hours @ 200 = 500) on a past date
    const entry2Res = await fetch(`${BASE_URL}/water-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmer_id: farmerId,
        crop_name: 'Cumin',
        entry_date: '2026-10-25',
        start_time: '14:00',
        end_time: '16:30',
        hourly_rate: 200,
      }),
    }).then((r) => r.json());
    assert(entry2Res.success === true, 'Created past water entry (2.5 hours @ ₹200)');
    assert(parseFloat(entry2Res.data.total_amount) === 500.0, `Total amount = 500 (got ${entry2Res.data.total_amount})`);

    // 5. Test Bill Calculation for Govindbhai
    console.log('\n5. Testing Bill Calculation:');
    const billRes = await fetch(`${BASE_URL}/hisab/farmer-bill?farmer_id=${farmerId}`).then((r) => r.json());
    assert(billRes.success === true, 'Fetched farmer bill successfully');
    assert(parseFloat(billRes.data.summary.total_hours) === 5.5, `Total hours = 5.5 (got ${billRes.data.summary.total_hours})`);
    assert(parseFloat(billRes.data.summary.total_bill) === 1100.0, `Total bill = 1100 (got ${billRes.data.summary.total_bill})`);
    assert(parseFloat(billRes.data.summary.remaining_amount) === 1100.0, 'Remaining balance initially = 1100');

    // 6. Test Payment Entry
    console.log('\n6. Testing Payment Entry:');
    const payRes = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmer_id: farmerId,
        amount_paid: 600,
        payment_date: '2026-10-30',
        payment_method: 'UPI',
        notes: 'GPay received',
      }),
    }).then((r) => r.json());
    assert(payRes.success === true, 'Payment of ₹600 recorded');
    assert(payRes.balance.remaining_balance === 500.0, `Remaining balance updated to 500 (got ${payRes.balance.remaining_balance})`);

    // Verify updated bill reflects remaining balance
    const updatedBill = await fetch(`${BASE_URL}/hisab/farmer-bill?farmer_id=${farmerId}`).then((r) => r.json());
    assert(parseFloat(updatedBill.data.summary.amount_paid) === 600.0, 'Bill reflects 600 paid');
    assert(parseFloat(updatedBill.data.summary.remaining_amount) === 500.0, 'Bill reflects 500 remaining');

    // 7. Test All Farmers Hisab Ledger
    console.log('\n7. Testing All Farmers Hisab Ledger:');
    const allHisabRes = await fetch(`${BASE_URL}/hisab/all-farmers`).then((r) => r.json());
    assert(allHisabRes.success === true, 'Fetched all farmers hisab');
    assert(allHisabRes.data.length >= 4, `Ledger contains at least 4 farmers (got ${allHisabRes.data.length})`);
    assert(parseFloat(allHisabRes.totals.total_bill) > 0, 'Grand total bill calculated correctly');
    console.log('     Grand totals:', allHisabRes.totals);

    // 8. Clean up test farmer
    console.log('\n8. Cleaning up test farmer:');
    const delRes = await fetch(`${BASE_URL}/farmers/${farmerId}`, { method: 'DELETE' }).then((r) => r.json());
    assert(delRes.success === true, 'Test farmer deleted cleanly');

    console.log(`\n====================================================`);
    console.log(`🏁 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`====================================================`);
    if (failCount > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
