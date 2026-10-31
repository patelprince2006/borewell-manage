// Borewell Water Hisab (બોરવેલ પાણી હિસાબ) - Main Application Script
import { api } from './api.js';
import { translations } from './translations.js';

let currentLang = 'gu'; // Default language is Gujarati
let cachedFarmers = [];
let cachedCrops = [];
let activeBillData = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  setupLanguage();
  setupNavigation();
  setupWaterLiveCalc();
  setupFormHandlers();
  setupBillActions();
  setupHisabFilters();
  setupPaymentsActions();

  // Set default dates
  const todayStr = new Date().toISOString().split('T')[0];
  const waterDateInput = document.getElementById('water-entry-date');
  if (waterDateInput) waterDateInput.value = todayStr;

  const paymentDateInput = document.getElementById('payment-date');
  if (paymentDateInput) paymentDateInput.value = todayStr;

  // Pre-render invoice and receipt title canvases
  renderInvoiceTitleCanvas();
  renderReceiptTitleCanvas();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      renderInvoiceTitleCanvas();
      renderReceiptTitleCanvas();
    });
  }

  // Initial Data Load
  await refreshAllData();
});

// ==========================================
// 1. Language Toggle & i18n
// ==========================================
function setupLanguage() {
  const toggleBtn = document.getElementById('lang-toggle-btn');
  const langText = document.getElementById('lang-btn-text');

  toggleBtn.addEventListener('click', () => {
    currentLang = currentLang === 'gu' ? 'en' : 'gu';
    applyLanguage();
  });

  applyLanguage();
}

function applyLanguage() {
  const dict = translations[currentLang];
  const langBtnText = document.getElementById('lang-btn-text');
  if (langBtnText) {
    langBtnText.textContent = currentLang === 'gu' ? 'English માં જુઓ' : 'ગુજરાતીમાં જુઓ';
  }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Re-render select options & dynamic tables
  populateFarmerDropdowns();
  populateCropDropdowns();
}

function t(key) {
  return translations[currentLang][key] || key;
}

// ==========================================
// 2. Navigation & View Switching
// ==========================================
function setupNavigation() {
  const brandHome = document.getElementById('brand-home-link');
  const backHomeBtn = document.getElementById('btn-back-home');

  brandHome.addEventListener('click', () => showView('view-home'));
  backHomeBtn.addEventListener('click', () => showView('view-home'));

  // 4 Primary Buttons
  document.getElementById('home-card-farmers').addEventListener('click', () => {
    showView('view-farmers', t('btn_farmers'));
    loadFarmersTable();
  });

  document.getElementById('home-card-water').addEventListener('click', () => {
    showView('view-water', t('btn_water'));
    loadWaterEntriesTable();
  });

  document.getElementById('home-card-bill').addEventListener('click', () => {
    showView('view-bill', t('btn_bill'));
  });

  document.getElementById('home-card-all-hisab').addEventListener('click', () => {
    showView('view-all-hisab', t('btn_all_hisab'));
    loadAllFarmersHisab();
  });

  // Secondary Buttons
  document.getElementById('home-card-payment').addEventListener('click', () => {
    showView('view-payments', t('btn_payment'));
    loadPaymentsTable();
  });

  document.getElementById('home-card-crops').addEventListener('click', () => {
    showView('view-crops', t('btn_crops'));
    loadCropsTable();
  });
}

export function showView(viewId, sectionTitle = '') {
  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
  }

  const backBar = document.getElementById('nav-back-bar');
  const currentTitleEl = document.getElementById('section-current-title');

  if (viewId === 'view-home') {
    backBar.style.display = 'none';
  } else {
    backBar.style.display = 'flex';
    currentTitleEl.textContent = sectionTitle;
  }

  // Refresh summary metrics when moving to home
  if (viewId === 'view-home') {
    loadSummary();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 3. Data Refreshing & Dropdowns
// ==========================================
async function refreshAllData() {
  await Promise.all([loadSummary(), loadCrops(), loadFarmers()]);
}

async function loadSummary() {
  try {
    const res = await api.getSummary();
    if (res.success) {
      const d = res.data;
      document.getElementById('sum-total-farmers').textContent = d.total_farmers;
      const hours = d.total_hours !== undefined ? d.total_hours : d.today_hours;
      const bill = d.total_bill !== undefined ? d.total_bill : d.today_bill;
      document.getElementById('sum-today-hours').textContent = `${hours} ${t('hours_unit')}`;
      document.getElementById('sum-today-bill').textContent = `₹${parseFloat(bill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      document.getElementById('sum-total-pending').textContent = `₹${parseFloat(d.total_pending).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
  } catch (err) {
    console.error('Failed to load summary:', err);
  }
}

async function loadCrops() {
  try {
    const res = await api.getCrops();
    if (res.success) {
      cachedCrops = res.data;
      populateCropDropdowns();
      renderCropsTable(cachedCrops);
    }
  } catch (err) {
    console.error('Failed to load crops:', err);
  }
}

function populateCropDropdowns() {
  const cropSelect = document.getElementById('water-crop-select');
  if (!cropSelect) return;

  const prevVal = cropSelect.value;
  cropSelect.innerHTML = '';

  cachedCrops.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.name_en;
    opt.textContent = `${c.name_gu} (${c.name_en}) - ₹${c.default_hourly_rate}/કલાક`;
    opt.dataset.rate = c.default_hourly_rate;
    cropSelect.appendChild(opt);
  });

  if (prevVal) {
    cropSelect.value = prevVal;
  } else if (cachedCrops.length > 0) {
    cropSelect.value = cachedCrops[0].name_en;
    const rateInput = document.getElementById('water-hourly-rate');
    if (rateInput) rateInput.value = cachedCrops[0].default_hourly_rate;
  }

  recalculateWaterDuration();
}

async function loadFarmers() {
  try {
    const res = await api.getFarmers();
    if (res.success) {
      cachedFarmers = res.data;
      populateFarmerDropdowns();
      renderFarmersTable(cachedFarmers);
    }
  } catch (err) {
    console.error('Failed to load farmers:', err);
  }
}

function populateFarmerDropdowns() {
  const waterSelect = document.getElementById('water-farmer-select');
  const billSelect = document.getElementById('bill-farmer-select');
  const paymentSelect = document.getElementById('payment-farmer-select');

  const selects = [waterSelect, billSelect, paymentSelect];

  selects.forEach((sel) => {
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="">${t('select_farmer_ph')}</option>`;

    cachedFarmers.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      const remaining = parseFloat(f.remaining_balance || 0);
      const remText = remaining > 0 ? ` [બાકી: ₹${remaining.toFixed(0)}]` : ' [ચૂકતે]';
      opt.textContent = `${f.name} - ${f.village || ''} ${remText}`;
      opt.dataset.village = f.village || '';
      opt.dataset.crop = f.crop_name || '';
      opt.dataset.farmId = f.farm_identifier || '';
      opt.dataset.remaining = remaining;
      sel.appendChild(opt);
    });

    if (prev) sel.value = prev;
  });
}

// ==========================================
// 4. Live Water Supply Duration & Bill Calc
// ==========================================
function setupWaterLiveCalc() {
  const startTime = document.getElementById('water-start-time');
  const endTime = document.getElementById('water-end-time');
  const rateInput = document.getElementById('water-hourly-rate');
  const cropSelect = document.getElementById('water-crop-select');
  const farmerSelect = document.getElementById('water-farmer-select');

  // When crop changes, auto-fill default hourly rate
  cropSelect.addEventListener('change', () => {
    const selectedOpt = cropSelect.selectedOptions[0];
    if (selectedOpt && selectedOpt.dataset.rate) {
      rateInput.value = selectedOpt.dataset.rate;
    }
    recalculateWaterDuration();
  });

  // When farmer changes, match farmer's default crop if set
  farmerSelect.addEventListener('change', () => {
    const selectedOpt = farmerSelect.selectedOptions[0];
    if (selectedOpt && selectedOpt.dataset.crop) {
      const farmerCrop = selectedOpt.dataset.crop;
      const matching = cachedCrops.find(
        (c) => c.name_en.toLowerCase() === farmerCrop.toLowerCase() || c.name_gu === farmerCrop
      );
      if (matching) {
        cropSelect.value = matching.name_en;
        rateInput.value = matching.default_hourly_rate;
      }
    }
    recalculateWaterDuration();
  });

  [startTime, endTime, rateInput].forEach((el) => {
    if (el) {
      el.addEventListener('input', recalculateWaterDuration);
      el.addEventListener('change', recalculateWaterDuration);
    }
  });

  recalculateWaterDuration();
}

function recalculateWaterDuration() {
  const startTimeVal = document.getElementById('water-start-time')?.value || '06:00';
  const endTimeVal = document.getElementById('water-end-time')?.value || '09:00';
  const rateVal = parseFloat(document.getElementById('water-hourly-rate')?.value || 200);

  function parseMinutes(tStr) {
    if (!tStr) return 0;
    const parts = tStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  let startMins = parseMinutes(startTimeVal);
  let endMins = parseMinutes(endTimeVal);
  let diff = endMins - startMins;
  if (diff <= 0) diff += 24 * 60; // Crossing midnight safe

  const decimalHours = Math.round((diff / 60) * 100) / 100;
  const hoursPart = Math.floor(diff / 60);
  const minsPart = diff % 60;

  const totalBill = Math.round(decimalHours * rateVal * 100) / 100;

  const hoursEl = document.getElementById('calc-display-hours');
  const rateEl = document.getElementById('calc-display-rate');
  const totalEl = document.getElementById('calc-display-total');

  if (hoursEl) {
    hoursEl.textContent = `${decimalHours.toFixed(2)} કલાક (${hoursPart} કલાક ${minsPart.toString().padStart(2, '0')} મિનિટ)`;
  }
  if (rateEl) {
    rateEl.textContent = `₹${rateVal.toFixed(2)}`;
  }
  if (totalEl) {
    totalEl.textContent = `₹${totalBill.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  return { decimalHours, totalBill };
}

// ==========================================
// 5. Form Submissions
// ==========================================
function setupFormHandlers() {
  // Add Farmer
  const farmerForm = document.getElementById('form-add-farmer');
  farmerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('farmer-name').value;
    const mobile = document.getElementById('farmer-mobile').value;
    const village = document.getElementById('farmer-village').value;
    const crop_name = document.getElementById('farmer-crop').value;
    const farm_identifier = document.getElementById('farmer-farm-id').value;

    try {
      const res = await api.createFarmer({ name, mobile, village, crop_name, farm_identifier });
      if (res.success) {
        showToast(res.message || 'ખેડૂત સફળતાપૂર્વક સાચવવામાં આવ્યા!', 'success');
        farmerForm.reset();
        await refreshAllData();
        loadFarmersTable();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Edit Farmer Form
  const editFarmerForm = document.getElementById('form-edit-farmer');
  editFarmerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-farmer-id').value;
    const name = document.getElementById('edit-farmer-name').value;
    const mobile = document.getElementById('edit-farmer-mobile').value;
    const village = document.getElementById('edit-farmer-village').value;
    const crop_name = document.getElementById('edit-farmer-crop').value;
    const farm_identifier = document.getElementById('edit-farmer-farm-id').value;

    try {
      const res = await api.updateFarmer(id, { name, mobile, village, crop_name, farm_identifier });
      if (res.success) {
        showToast('ખેડૂતની માહિતી સફળતાપૂર્વક સુધારી!', 'success');
        closeModal('modal-edit-farmer');
        await refreshAllData();
        loadFarmersTable();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('modal-edit-farmer-close').addEventListener('click', () => closeModal('modal-edit-farmer'));
  document.getElementById('btn-cancel-edit-farmer').addEventListener('click', () => closeModal('modal-edit-farmer'));

  // Water Supply Entry Form
  const waterForm = document.getElementById('form-water-entry');
  waterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const farmer_id = document.getElementById('water-farmer-select').value;
    const crop_name = document.getElementById('water-crop-select').value;
    const entry_date = document.getElementById('water-entry-date').value;
    const start_time = document.getElementById('water-start-time').value;
    const end_time = document.getElementById('water-end-time').value;
    const hourly_rate = document.getElementById('water-hourly-rate').value;
    const notes = document.getElementById('water-notes').value;

    const { decimalHours } = recalculateWaterDuration();

    try {
      const res = await api.createWaterEntry({
        farmer_id,
        crop_name,
        entry_date,
        start_time,
        end_time,
        hourly_rate,
        total_hours: decimalHours,
        notes,
      });

      if (res.success) {
        showToast(res.message || 'પાણીની નોંધ સફળતાપૂર્વક સાચવવામાં આવી!', 'success');
        document.getElementById('water-notes').value = '';
        await refreshAllData();
        loadWaterEntriesTable();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Payment Form
  const paymentSelect = document.getElementById('payment-farmer-select');
  paymentSelect.addEventListener('change', () => {
    const selectedOpt = paymentSelect.selectedOptions[0];
    const rem = selectedOpt ? parseFloat(selectedOpt.dataset.remaining || 0) : 0;
    const balanceInput = document.getElementById('payment-current-balance');
    balanceInput.value = `₹${rem.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('payment-amount').value = rem > 0 ? rem : '';
  });

  const paymentForm = document.getElementById('form-payment-entry');
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const farmer_id = document.getElementById('payment-farmer-select').value;
    const amount_paid = document.getElementById('payment-amount').value;
    const payment_date = document.getElementById('payment-date').value;
    const payment_method = document.getElementById('payment-method').value;
    const notes = document.getElementById('payment-notes').value;

    try {
      const res = await api.createPayment({
        farmer_id,
        amount_paid,
        payment_date,
        payment_method,
        notes,
      });

      if (res.success) {
        showToast(res.message || 'ચૂકવણી સફળતાપૂર્વક જમા થઈ ગઈ!', 'success');
        paymentForm.reset();
        document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
        await refreshAllData();
        loadPaymentsTable();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Crop & Pricing Form
  const cropForm = document.getElementById('form-crop-entry');
  cropForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name_en = document.getElementById('crop-name-en').value;
    const name_gu = document.getElementById('crop-name-gu').value;
    const default_hourly_rate = document.getElementById('crop-rate').value;

    try {
      const res = await api.createCrop({ name_en, name_gu, default_hourly_rate });
      if (res.success) {
        showToast(res.message || 'પાક અને ભાવ સાચવવામાં આવ્યા!', 'success');
        cropForm.reset();
        await loadCrops();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Search Farmers
  const searchFarmersInput = document.getElementById('search-farmers-input');
  searchFarmersInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = cachedFarmers.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.village && f.village.toLowerCase().includes(q)) ||
        (f.mobile && f.mobile.includes(q))
    );
    renderFarmersTable(filtered);
  });
}

// ==========================================
// 6. Farmers Table
// ==========================================
async function loadFarmersTable() {
  await loadFarmers();
}

function renderFarmersTable(farmers) {
  const tbody = document.getElementById('table-farmers-body');
  if (!tbody) return;

  if (farmers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">${t('no_records')}</td></tr>`;
    return;
  }

  tbody.innerHTML = farmers
    .map((f, i) => {
      const rem = parseFloat(f.remaining_balance || 0);
      const badgeClass = rem <= 0 ? 'badge-paid' : 'badge-pending';
      const badgeText = rem <= 0 ? t('status_paid') : `₹${rem.toFixed(2)}`;

      return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(f.name)}</strong></td>
        <td>${escapeHtml(f.village || '-')}</td>
        <td>${escapeHtml(f.mobile || '-')}</td>
        <td>${escapeHtml(f.crop_name || '-')}</td>
        <td>${escapeHtml(f.farm_identifier || '-')}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn-secondary" style="padding: 6px 10px; font-size: 13px;" onclick="window.actionAddWaterForFarmer(${f.id})">💧 પાણી</button>
            <button class="btn-secondary" style="padding: 6px 10px; font-size: 13px;" onclick="window.actionViewFarmerBill(${f.id})">🧾 બિલ</button>
            <button class="btn-secondary" style="padding: 6px 10px; font-size: 13px;" onclick="window.actionEditFarmer(${f.id})">✏️</button>
            <button class="btn-danger" style="padding: 6px 10px; font-size: 13px;" onclick="window.actionDeleteFarmer(${f.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

// Global actions for inline button clicks
window.actionAddWaterForFarmer = (id) => {
  showView('view-water', t('btn_water'));
  const sel = document.getElementById('water-farmer-select');
  if (sel) {
    sel.value = id;
    sel.dispatchEvent(new Event('change'));
  }
};

window.actionViewFarmerBill = (id, startDate = '', endDate = '') => {
  showView('view-bill', t('btn_bill'));
  const sel = document.getElementById('bill-farmer-select');
  if (sel) {
    sel.value = id;
  }
  const sInput = document.getElementById('bill-start-date');
  const eInput = document.getElementById('bill-end-date');
  if (sInput) sInput.value = startDate || '';
  if (eInput) eInput.value = endDate || '';
  document.getElementById('btn-load-farmer-bill').click();
};

window.actionEditFarmer = (id) => {
  const farmer = cachedFarmers.find((f) => f.id === id);
  if (!farmer) return;

  document.getElementById('edit-farmer-id').value = farmer.id;
  document.getElementById('edit-farmer-name').value = farmer.name;
  document.getElementById('edit-farmer-mobile').value = farmer.mobile || '';
  document.getElementById('edit-farmer-village').value = farmer.village || '';
  document.getElementById('edit-farmer-crop').value = farmer.crop_name || '';
  document.getElementById('edit-farmer-farm-id').value = farmer.farm_identifier || '';

  openModal('modal-edit-farmer');
};

window.actionDeleteFarmer = async (id) => {
  if (!confirm('શું તમે ખરેખર આ ખેડૂત અને તેમનો તમામ હિસાબ કાઢી નાખવા માંગો છો? (Are you sure you want to delete this farmer?)')) {
    return;
  }
  try {
    const res = await api.deleteFarmer(id);
    if (res.success) {
      showToast(res.message, 'success');
      await refreshAllData();
      loadFarmersTable();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ==========================================
// 7. Water Entries Table
// ==========================================
async function loadWaterEntriesTable() {
  const tbody = document.getElementById('table-water-entries-body');
  try {
    const res = await api.getWaterEntries();
    if (res.success) {
      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">${t('no_records')}</td></tr>`;
        return;
      }
      tbody.innerHTML = res.data
        .map((w) => {
          const formattedDate = formatDate(w.entry_date);
          return `
          <tr>
            <td><strong>${formattedDate}</strong></td>
            <td>${escapeHtml(w.farmer_name)}</td>
            <td>${escapeHtml(w.crop_name)}</td>
            <td>${escapeHtml(w.start_time)}</td>
            <td>${escapeHtml(w.end_time)}</td>
            <td style="font-weight: 800; color: var(--primary-dark);">${parseFloat(w.total_hours).toFixed(2)} કલાક</td>
            <td>₹${parseFloat(w.hourly_rate).toFixed(0)}</td>
            <td style="font-weight: 800; color: #1b5e20;">₹${parseFloat(w.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>
              <button class="btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="window.actionDeleteWaterEntry(${w.id})">🗑️</button>
            </td>
          </tr>
        `;
        })
        .join('');
    }
  } catch (err) {
    console.error('Failed to load water entries:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: #c62828;">માહિતી લોડ કરવામાં ભૂલ આવી. (${escapeHtml(err.message)})</td></tr>`;
  }
}

window.actionDeleteWaterEntry = async (id) => {
  if (!confirm('આ પાણીની નોંધ કાઢી નાખવી છે?')) return;
  try {
    const res = await api.deleteWaterEntry(id);
    if (res.success) {
      showToast(res.message, 'success');
      await refreshAllData();
      loadWaterEntriesTable();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ==========================================
// 8. Bill Calculation & Invoice Actions
// ==========================================
function setupBillActions() {
  const loadBillBtn = document.getElementById('btn-load-farmer-bill');
  const presetAllBtn = document.getElementById('btn-bill-preset-all');
  const presetMonthBtn = document.getElementById('btn-bill-preset-month');

  presetAllBtn.addEventListener('click', () => {
    document.getElementById('bill-start-date').value = '';
    document.getElementById('bill-end-date').value = '';
    loadBillBtn.click();
  });

  presetMonthBtn.addEventListener('click', () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('bill-start-date').value = firstDay;
    document.getElementById('bill-end-date').value = lastDay;
    loadBillBtn.click();
  });

  loadBillBtn.addEventListener('click', async () => {
    const farmerId = document.getElementById('bill-farmer-select').value;
    if (!farmerId) {
      showToast('કૃપા કરીને ખેડૂત પસંદ કરો (Please select a farmer)', 'error');
      return;
    }

    const startDate = document.getElementById('bill-start-date').value;
    const endDate = document.getElementById('bill-end-date').value;

    try {
      const res = await api.getFarmerBill(farmerId, startDate, endDate);
      if (res.success) {
        activeBillData = res.data;
        renderBillOutput(activeBillData);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 3 Large Buttons: View, Download PDF, Print
  document.getElementById('btn-bill-action-view').addEventListener('click', () => {
    if (!activeBillData) return;
    populateInvoiceModal(activeBillData);
    openModal('modal-invoice');
  });

  document.getElementById('btn-bill-action-print').addEventListener('click', () => {
    if (!activeBillData) return;
    populateInvoiceModal(activeBillData);
    openModal('modal-invoice');
    setTimeout(() => {
      window.print();
    }, 300);
  });

  document.getElementById('btn-bill-action-download').addEventListener('click', () => {
    if (!activeBillData) return;
    downloadBillPdf(activeBillData);
  });

  document.getElementById('modal-invoice-close').addEventListener('click', () => closeModal('modal-invoice'));
  document.getElementById('btn-modal-close').addEventListener('click', () => closeModal('modal-invoice'));
  document.getElementById('btn-modal-print').addEventListener('click', () => window.print());
  const modalDownloadBtn = document.getElementById('btn-modal-download');
  if (modalDownloadBtn) {
    modalDownloadBtn.addEventListener('click', () => {
      if (!activeBillData) return;
      downloadBillPdf(activeBillData);
    });
  }
}

async function downloadBillPdf(billData) {
  if (!billData) return;

  // Populate invoice modal with the bill data and make it visible so html2canvas measures fonts correctly
  populateInvoiceModal(billData);
  openModal('modal-invoice');

  const element = document.getElementById('printable-bill-content');
  if (!element) return;

  const f = billData.farmer || {};
  const safeFarmerName = (f.name || 'Farmer').replace(/[^a-zA-Z0-9_\u0A80-\u0AFF]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Borewell_Bill_${safeFarmerName}_${dateStr}.pdf`;

  if (typeof window.html2pdf === 'function') {
    showToast('⏳ PDF ડાઉનલોડ થઈ રહ્યું છે...', 'success');

    // Wait for Gujarati web fonts to load completely
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Small delay to ensure layout and text shaping are stabilized in the DOM
    await new Promise((r) => setTimeout(r, 200));

    const opt = {
      margin: [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: false,
        logging: false,
        scrollY: 0
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };

    try {
      await window.html2pdf().set(opt).from(element).save();
      showToast('✅ PDF સફળતાપૂર્વક ડાઉનલોડ થઈ ગયું!', 'success');
    } catch (err) {
      console.error('html2pdf generation error:', err);
      showToast('પ્રિન્ટ વિન્ડો ખોલી રહ્યા છીએ...', 'info');
      window.print();
    }
  } else {
    // Graceful fallback to browser print dialog
    setTimeout(() => {
      window.print();
    }, 300);
  }
}

function renderBillOutput(data) {
  const container = document.getElementById('bill-output-container');
  container.style.display = 'block';

  const sum = data.summary;
  const rem = parseFloat(sum.remaining_amount);

  document.getElementById('bill-disp-name').textContent = sum.farmer_name;
  document.getElementById('bill-disp-village').textContent = sum.village || '-';
  document.getElementById('bill-disp-crop').textContent = sum.crop;
  document.getElementById('bill-disp-hours').textContent = `${sum.total_hours} કલાક (${sum.total_hours} Hours)`;
  document.getElementById('bill-disp-rate').textContent = `₹${parseFloat(sum.hourly_rate).toFixed(2)}/કલાક`;
  document.getElementById('bill-disp-total').textContent = `₹${parseFloat(sum.total_bill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('bill-disp-paid').textContent = `₹${parseFloat(sum.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('bill-disp-remaining').textContent = `₹${rem.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const statusBadge = document.getElementById('bill-status-badge');
  if (rem <= 0) {
    statusBadge.className = 'badge badge-paid';
    statusBadge.textContent = 'ચૂકતે (Paid)';
  } else {
    statusBadge.className = 'badge badge-pending';
    statusBadge.textContent = 'બાકી (Pending)';
  }

  // Render Date-wise Breakdown
  const tbody = document.getElementById('table-bill-sessions-body');
  if (data.entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 14px;">આ સમયગાળામાં કોઈ પાણીની નોંધ નથી.</td></tr>`;
  } else {
    tbody.innerHTML = data.entries
      .map(
        (e) => `
      <tr>
        <td><strong>${formatDate(e.entry_date)}</strong></td>
        <td>${escapeHtml(e.crop_name)}</td>
        <td>${escapeHtml(e.start_time)}</td>
        <td>${escapeHtml(e.end_time)}</td>
        <td>${parseFloat(e.total_hours).toFixed(2)} કલાક</td>
        <td>₹${parseFloat(e.hourly_rate).toFixed(0)}</td>
        <td style="font-weight: 700;">₹${parseFloat(e.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `
      )
      .join('');
  }

  container.scrollIntoView({ behavior: 'smooth' });
}

function renderInvoiceTitleCanvas() {
  const canvas = document.getElementById('inv-title-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(window.devicePixelRatio || 1, 3);
  const w = 540;
  const h = 42;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.maxWidth = `${w}px`;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  ctx.font = '700 24px "Noto Sans Gujarati", "Shruti", "Gujarati Sangam MN", "Segoe UI", sans-serif';
  ctx.fillStyle = '#1b5e20';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('બોરવેલ પાણી સપ્લાય બિલ પાવતી', w / 2, h / 2);
}

function populateInvoiceModal(data) {
  const sum = data.summary;
  const f = data.farmer;

  renderInvoiceTitleCanvas();

  document.getElementById('inv-current-date').textContent = new Date().toLocaleDateString('gu-IN');
  document.getElementById('inv-farmer-name').textContent = f.name;
  document.getElementById('inv-village').textContent = f.village || '-';
  document.getElementById('inv-mobile').textContent = f.mobile || '-';
  document.getElementById('inv-crop').textContent = sum.crop;

  const farmIdEl = document.getElementById('inv-farm-id');
  if (farmIdEl) farmIdEl.textContent = f.farm_identifier || '-';
  const periodEl = document.getElementById('inv-period');
  if (periodEl) periodEl.textContent = `${data.filter.start_date} થી ${data.filter.end_date}`;

  document.getElementById('inv-total-hours').textContent = `${sum.total_hours} કલાક`;
  document.getElementById('inv-total-bill').textContent = `₹${parseFloat(sum.total_bill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('inv-total-paid').textContent = `₹${parseFloat(sum.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('inv-total-remaining').textContent = `₹${parseFloat(sum.remaining_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const tbody = document.getElementById('inv-sessions-body');
  if (data.entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">કોઈ પાણી સપ્લાય રેકોર્ડ નથી.</td></tr>`;
  } else {
    tbody.innerHTML = data.entries
      .map(
        (e) => `
      <tr>
        <td>${formatDate(e.entry_date)}</td>
        <td>${escapeHtml(e.crop_name)}</td>
        <td class="text-center">${escapeHtml(e.start_time)} - ${escapeHtml(e.end_time)}</td>
        <td class="text-right">${parseFloat(e.total_hours).toFixed(2)}</td>
        <td class="text-right">₹${parseFloat(e.hourly_rate).toFixed(0)}</td>
        <td class="text-right" style="font-weight: 700; color: #1b5e20;">₹${parseFloat(e.total_amount).toFixed(2)}</td>
      </tr>
    `
      )
      .join('');
  }
}

// ==========================================
// 9. All Farmers' Hisab Ledger
// ==========================================
function setupHisabFilters() {
  const searchInput = document.getElementById('hisab-search-input');
  const startInput = document.getElementById('hisab-filter-start');
  const endInput = document.getElementById('hisab-filter-end');
  const applyBtn = document.getElementById('btn-hisab-filter-apply');
  const todayBtn = document.getElementById('btn-hisab-filter-today');
  const monthBtn = document.getElementById('btn-hisab-filter-month');
  const clearBtn = document.getElementById('btn-hisab-filter-clear');
  const activeOnlyCheckbox = document.getElementById('hisab-filter-active-only');
  const printBtn = document.getElementById('btn-all-hisab-print');
  const downloadBtn = document.getElementById('btn-all-hisab-download');

  const triggerFilter = () => {
    const activeOnly = activeOnlyCheckbox ? activeOnlyCheckbox.checked : true;
    loadAllFarmersHisab(startInput.value, endInput.value, searchInput.value, activeOnly);
  };

  if (applyBtn) applyBtn.addEventListener('click', triggerFilter);
  if (searchInput) searchInput.addEventListener('input', triggerFilter);
  if (startInput) startInput.addEventListener('change', triggerFilter);
  if (endInput) endInput.addEventListener('change', triggerFilter);
  if (activeOnlyCheckbox) activeOnlyCheckbox.addEventListener('change', triggerFilter);

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      startInput.value = todayStr;
      endInput.value = todayStr;
      triggerFilter();
    });
  }

  if (monthBtn) {
    monthBtn.addEventListener('click', () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      startInput.value = firstDay;
      endInput.value = lastDay;
      triggerFilter();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      startInput.value = '';
      endInput.value = '';
      if (activeOnlyCheckbox) activeOnlyCheckbox.checked = true;
      loadAllFarmersHisab();
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadHisabCSV);
  }
}

let cachedHisabData = [];
let cachedHisabTotals = null;

async function loadAllFarmersHisab(startDate = '', endDate = '', search = '', activeOnly = true) {
  const tbody = document.getElementById('table-all-hisab-body');
  const badgeContainer = document.getElementById('hisab-date-badge-container');
  const periodText = document.getElementById('hisab-active-period-text');

  // Update active period indicator badge
  if (badgeContainer && periodText) {
    if (startDate || endDate) {
      badgeContainer.style.display = 'flex';
      let periodLabel = '📅 સમયગાળો: ';
      if (startDate && endDate) {
        periodLabel += `${formatDate(startDate)} થી ${formatDate(endDate)}`;
      } else if (startDate) {
        periodLabel += `${formatDate(startDate)} થી આગળ`;
      } else {
        periodLabel += `${formatDate(endDate)} સુધી`;
      }
      periodText.textContent = periodLabel;
    } else {
      badgeContainer.style.display = 'none';
    }
  }

  try {
    const res = await api.getAllFarmersHisab(startDate, endDate, search, activeOnly);
    if (res.success) {
      cachedHisabData = res.data;
      cachedHisabTotals = res.totals;

      if (res.data.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center; padding: 30px; font-size: 15px; color: #475569;">
              <div style="font-size: 26px; margin-bottom: 8px;">🔍</div>
              <strong style="color: #1e293b;">પસંદ કરેલ તારીખ મુજબ કોઈ પાણી સપ્લાય કે ચૂકવણીનો હિસાબ મળ્યો નથી.</strong><br>
              <span style="font-size: 13px; color: #64748b;">(No records found for the selected date range. Try selecting different dates or click "બધો હિસાબ".)</span>
            </td>
          </tr>
        `;
        document.getElementById('grand-total-hours').textContent = '0.00 કલાક';
        document.getElementById('grand-total-bill').textContent = '₹0.00';
        document.getElementById('grand-total-paid').textContent = '₹0.00';
        document.getElementById('grand-total-remaining').textContent = '₹0.00';
        return;
      }

      tbody.innerHTML = res.data
        .map((r) => {
          const rem = parseFloat(r.remaining_amount || 0);
          const badgeClass = rem <= 0 ? 'badge-paid' : 'badge-pending';
          const badgeText = rem <= 0 ? t('status_paid') : t('status_pending');

          return `
          <tr>
            <td><strong>${escapeHtml(r.farmer_name)}</strong></td>
            <td>${escapeHtml(r.village || '-')}</td>
            <td>${escapeHtml(r.crop_name || '-')}</td>
            <td style="text-align: right; font-weight: 700;">${parseFloat(r.total_hours).toFixed(2)}</td>
            <td style="text-align: right; font-weight: 700;">₹${parseFloat(r.total_bill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right; font-weight: 700; color: #2e7d32;">₹${parseFloat(r.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right; font-weight: 800; color: #c62828;">₹${rem.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td>
              <button class="btn-secondary" style="padding: 6px 12px; font-size: 13px;" onclick="window.actionViewFarmerBill(${r.id}, '${startDate}', '${endDate}')">🧾 બિલ</button>
            </td>
          </tr>
        `;
        })
        .join('');

      // Update grand totals
      const totals = res.totals;
      document.getElementById('grand-total-hours').textContent = `${totals.total_hours} કલાક`;
      document.getElementById('grand-total-bill').textContent = `₹${parseFloat(totals.total_bill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      document.getElementById('grand-total-paid').textContent = `₹${parseFloat(totals.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      document.getElementById('grand-total-remaining').textContent = `₹${parseFloat(totals.total_remaining).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
  } catch (err) {
    console.error('Failed to load all hisab:', err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: #c62828;">માહિતી લોડ કરવામાં ભૂલ આવી. (${escapeHtml(err.message)})</td></tr>`;
  }
}

function downloadHisabCSV() {
  if (!cachedHisabData || cachedHisabData.length === 0) {
    showToast('ડાઉનલોડ કરવા માટે કોઈ ડેટા નથી.', 'error');
    return;
  }

  const headers = ['ખેડૂતનું નામ', 'ગામ', 'પાક', 'કુલ કલાક', 'કુલ બિલ (₹)', 'જમા રકમ (₹)', 'બાકી પૈસા (₹)'];
  const rows = cachedHisabData.map((r) => [
    `"${r.farmer_name}"`,
    `"${r.village || ''}"`,
    `"${r.crop_name || ''}"`,
    r.total_hours,
    r.total_bill,
    r.total_paid,
    r.remaining_amount,
  ]);

  if (cachedHisabTotals) {
    rows.push([
      '"કુલ સરવાળો (Grand Total)"',
      '""',
      '""',
      cachedHisabTotals.total_hours,
      cachedHisabTotals.total_bill,
      cachedHisabTotals.total_paid,
      cachedHisabTotals.total_remaining,
    ]);
  }

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Borewell_Water_Hisab_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('રિપોર્ટ સફળતાપૂર્વક ડાઉનલોડ થયો!', 'success');
}

// ==========================================
// 10. Payments Table, PDF & CSV Export, Receipt
// ==========================================
let cachedPaymentsData = [];
let filteredPaymentsData = [];
let activeReceiptData = null;

function setupPaymentsActions() {
  const pdfBtn = document.getElementById('btn-payments-pdf');
  const csvBtn = document.getElementById('btn-payments-csv');
  const searchInput = document.getElementById('payments-search-input');
  const startInput = document.getElementById('payments-filter-start');
  const endInput = document.getElementById('payments-filter-end');
  const applyBtn = document.getElementById('btn-payments-filter-apply');
  const clearBtn = document.getElementById('btn-payments-filter-clear');

  if (pdfBtn) pdfBtn.addEventListener('click', downloadPaymentsPDF);
  if (csvBtn) csvBtn.addEventListener('click', downloadPaymentsCSV);

  if (searchInput) searchInput.addEventListener('input', applyPaymentsFilter);
  if (applyBtn) applyBtn.addEventListener('click', applyPaymentsFilter);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (startInput) startInput.value = '';
      if (endInput) endInput.value = '';
      applyPaymentsFilter();
    });
  }

  // Receipt modal buttons
  const closeBtn = document.getElementById('modal-receipt-close');
  const closeBtn2 = document.getElementById('btn-receipt-modal-close');
  const printReceiptBtn = document.getElementById('btn-receipt-modal-print');
  const downloadReceiptBtn = document.getElementById('btn-receipt-modal-download');

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modal-payment-receipt'));
  if (closeBtn2) closeBtn2.addEventListener('click', () => closeModal('modal-payment-receipt'));
  if (printReceiptBtn) printReceiptBtn.addEventListener('click', () => window.print());
  if (downloadReceiptBtn) downloadReceiptBtn.addEventListener('click', downloadPaymentReceiptPDF);
}

async function loadPaymentsTable() {
  try {
    const res = await api.getPayments();
    if (res.success) {
      cachedPaymentsData = res.data;
      applyPaymentsFilter();
    }
  } catch (err) {
    console.error('Failed to load payments:', err);
    const tbody = document.getElementById('table-payments-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #c62828;">માહિતી લોડ કરવામાં ભૂલ આવી. (${escapeHtml(err.message)})</td></tr>`;
  }
}

function applyPaymentsFilter() {
  const search = (document.getElementById('payments-search-input')?.value || '').trim().toLowerCase();
  const start = document.getElementById('payments-filter-start')?.value || '';
  const end = document.getElementById('payments-filter-end')?.value || '';

  filteredPaymentsData = cachedPaymentsData.filter((p) => {
    if (search) {
      const match =
        (p.farmer_name && p.farmer_name.toLowerCase().includes(search)) ||
        (p.farmer_village && p.farmer_village.toLowerCase().includes(search)) ||
        (p.payment_method && p.payment_method.toLowerCase().includes(search)) ||
        (p.notes && p.notes.toLowerCase().includes(search));
      if (!match) return false;
    }

    const pDate = (p.payment_date || '').slice(0, 10);
    if (start && pDate < start) return false;
    if (end && pDate > end) return false;
    return true;
  });

  renderPaymentsTable(filteredPaymentsData);
}

function renderPaymentsTable(data) {
  const tbody = document.getElementById('table-payments-body');
  const grandTotalEl = document.getElementById('payments-grand-total');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">${t('no_records')}</td></tr>`;
    if (grandTotalEl) grandTotalEl.textContent = '₹0.00';
    return;
  }

  let totalAmount = 0;
  tbody.innerHTML = data
    .map((p) => {
      const amount = parseFloat(p.amount_paid || 0);
      totalAmount += amount;
      return `
      <tr>
        <td><strong>${formatDate(p.payment_date)}</strong></td>
        <td><strong>${escapeHtml(p.farmer_name)}</strong> ${p.farmer_village ? `<span style="font-size:12px; color:#64748b;">(${escapeHtml(p.farmer_village)})</span>` : ''}</td>
        <td style="font-weight: 800; color: #2e7d32; font-size: 15px;">₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td><span class="badge" style="background:#e0f2f1; color:#00695c; font-weight:700;">${escapeHtml(p.payment_method)}</span></td>
        <td>${escapeHtml(p.notes || '-')}</td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn-secondary" style="padding: 5px 10px; font-size: 13px;" onclick="window.actionPrintPaymentReceipt(${p.id})">🧾 પાવતી</button>
            <button class="btn-danger" style="padding: 5px 8px; font-size: 13px;" onclick="window.actionDeletePayment(${p.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  if (grandTotalEl) {
    grandTotalEl.textContent = `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }
}

function downloadPaymentsCSV() {
  const data = filteredPaymentsData.length > 0 ? filteredPaymentsData : cachedPaymentsData;
  if (!data || data.length === 0) {
    showToast('ડાઉનલોડ કરવા માટે કોઈ ડેટા નથી.', 'error');
    return;
  }

  const headers = ['તારીખ (Date)', 'ખેડૂતનું નામ (Farmer Name)', 'ગામ (Village)', 'જમા રકમ (Amount Paid ₹)', 'ચૂકવણી પદ્ધતિ (Method)', 'નોંધ (Notes)'];
  let totalPaid = 0;

  const rows = data.map((p) => {
    const amt = parseFloat(p.amount_paid || 0);
    totalPaid += amt;
    return [
      `"${formatDate(p.payment_date)}"`,
      `"${(p.farmer_name || '').replace(/"/g, '""')}"`,
      `"${(p.farmer_village || '').replace(/"/g, '""')}"`,
      amt.toFixed(2),
      `"${(p.payment_method || '').replace(/"/g, '""')}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ];
  });

  // Grand Total Row
  rows.push([
    '"કુલ જમા રકમ (Grand Total Paid)"',
    '""',
    '""',
    totalPaid.toFixed(2),
    '""',
    '""',
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `Borewell_Payments_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ચૂકવણી એક્સેલ/CSV સફળતાપૂર્વક ડાઉનલોડ થયો!', 'success');
}

async function downloadPaymentsPDF() {
  const data = filteredPaymentsData.length > 0 ? filteredPaymentsData : cachedPaymentsData;
  if (!data || data.length === 0) {
    showToast('PDF બનાવવા માટે કોઈ ડેટા નથી.', 'error');
    return;
  }

  const dateStr = new Date().toLocaleDateString('gu-IN');
  const count = data.length;
  let totalAmount = 0;

  const reportContainer = document.getElementById('printable-payments-report');
  const reportDateEl = document.getElementById('pdf-report-date');
  const reportCountEl = document.getElementById('pdf-report-count');
  const reportBody = document.getElementById('pdf-payments-report-body');
  const reportGrandTotal = document.getElementById('pdf-payments-grand-total');

  if (reportDateEl) reportDateEl.textContent = dateStr;
  if (reportCountEl) reportCountEl.textContent = `${count}`;

  if (reportBody) {
    reportBody.innerHTML = data
      .map((p, idx) => {
        const amt = parseFloat(p.amount_paid || 0);
        totalAmount += amt;
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
        <tr style="background: ${bg};">
          <td style="border: 1px solid #444; padding: 7px 8px;">${formatDate(p.payment_date)}</td>
          <td style="border: 1px solid #444; padding: 7px 8px; font-weight: 700;">${escapeHtml(p.farmer_name)}</td>
          <td style="border: 1px solid #444; padding: 7px 8px;">${escapeHtml(p.farmer_village || '-')}</td>
          <td style="border: 1px solid #444; padding: 7px 8px; text-align: right; font-weight: 700; color: #1b5e20;">₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="border: 1px solid #444; padding: 7px 8px;">${escapeHtml(p.payment_method)}</td>
          <td style="border: 1px solid #444; padding: 7px 8px;">${escapeHtml(p.notes || '-')}</td>
        </tr>
      `;
      })
      .join('');
  }

  if (reportGrandTotal) {
    reportGrandTotal.textContent = `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  if (typeof window.html2pdf === 'function') {
    showToast('⏳ ચૂકવણી PDF ડાઉનલોડ થઈ રહ્યું છે...', 'success');

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((r) => setTimeout(r, 200));

    // Temporarily make container accessible for capture
    reportContainer.style.position = 'static';
    reportContainer.style.left = '0';
    reportContainer.style.top = '0';
    reportContainer.style.display = 'block';

    const filename = `Borewell_Payments_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    const opt = {
      margin: [10, 8, 10, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: false,
        logging: false,
        scrollY: 0,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
    };

    try {
      await window.html2pdf().set(opt).from(reportContainer).save();
      showToast('✅ ચૂકવણી PDF સફળતાપૂર્વક ડાઉનલોડ થઈ ગયું!', 'success');
    } catch (err) {
      console.error('html2pdf generation error:', err);
      window.print();
    } finally {
      reportContainer.style.position = 'absolute';
      reportContainer.style.left = '-9999px';
      reportContainer.style.top = '-9999px';
    }
  } else {
    window.print();
  }
}

function renderReceiptTitleCanvas() {
  const canvas = document.getElementById('receipt-title-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(window.devicePixelRatio || 1, 3);
  const w = 540;
  const h = 42;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.maxWidth = `${w}px`;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  ctx.font = '700 24px "Noto Sans Gujarati", "Shruti", "Gujarati Sangam MN", "Segoe UI", sans-serif';
  ctx.fillStyle = '#1b5e20';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('બોરવેલ પાણી સપ્લાય - જમા રકમ પાવતી', w / 2, h / 2);
}

window.actionPrintPaymentReceipt = async (id) => {
  const payment = cachedPaymentsData.find((p) => p.id === id);
  if (!payment) return;
  activeReceiptData = payment;

  renderReceiptTitleCanvas();

  document.getElementById('rec-number').textContent = `#PAY-${payment.id}`;
  document.getElementById('rec-date').textContent = formatDate(payment.payment_date);
  document.getElementById('rec-farmer-name').textContent = payment.farmer_name;
  document.getElementById('rec-farmer-village').textContent = payment.farmer_village || '-';

  const farmer = cachedFarmers.find((f) => f.id === payment.farmer_id);
  document.getElementById('rec-farmer-mobile').textContent = farmer ? (farmer.mobile || '-') : '-';
  const remaining = farmer ? parseFloat(farmer.remaining_balance || 0) : 0;
  document.getElementById('rec-remaining-balance').textContent = `₹${remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  document.getElementById('rec-payment-method').textContent = payment.payment_method;
  document.getElementById('rec-payment-notes').textContent = payment.notes || '-';
  document.getElementById('rec-amount-paid').textContent = `₹${parseFloat(payment.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  openModal('modal-payment-receipt');
};

async function downloadPaymentReceiptPDF() {
  if (!activeReceiptData) return;
  const element = document.getElementById('printable-receipt-content');
  if (!element) return;

  const safeFarmerName = (activeReceiptData.farmer_name || 'Farmer').replace(/[^a-zA-Z0-9_\u0A80-\u0AFF]/g, '_');
  const dateStr = (activeReceiptData.payment_date || '').slice(0, 10);
  const filename = `Payment_Receipt_${safeFarmerName}_${dateStr}.pdf`;

  if (typeof window.html2pdf === 'function') {
    showToast('⏳ પાવતી PDF ડાઉનલોડ થઈ રહ્યું છે...', 'success');
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((r) => setTimeout(r, 200));

    const opt = {
      margin: [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: false,
        logging: false,
        scrollY: 0,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
    };

    try {
      await window.html2pdf().set(opt).from(element).save();
      showToast('✅ પાવતી PDF સફળતાપૂર્વક ડાઉનલોડ થઈ ગયું!', 'success');
    } catch (err) {
      console.error('html2pdf generation error:', err);
      window.print();
    }
  } else {
    window.print();
  }
}

window.actionDeletePayment = async (id) => {
  if (!confirm('આ ચૂકવણીની એન્ટ્રી કાઢી નાખવી છે?')) return;
  try {
    const res = await api.deletePayment(id);
    if (res.success) {
      showToast(res.message, 'success');
      await refreshAllData();
      loadPaymentsTable();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ==========================================
// 11. Crops Management
// ==========================================
async function loadCropsTable() {
  await loadCrops();
}

function renderCropsTable(crops) {
  const tbody = document.getElementById('table-crops-body');
  if (!tbody) return;

  if (crops.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 14px;">${t('no_records')}</td></tr>`;
    return;
  }

  tbody.innerHTML = crops
    .map(
      (c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(c.name_en)}</strong></td>
      <td><strong>${escapeHtml(c.name_gu)}</strong></td>
      <td style="font-size: 18px; font-weight: 800; color: var(--primary-dark);">₹${parseFloat(c.default_hourly_rate).toFixed(2)}/કલાક</td>
      <td>
        <button class="btn-secondary" style="padding: 4px 10px; font-size: 13px;" onclick="window.actionEditCropRate(${c.id}, '${escapeHtml(c.name_gu)}', ${c.default_hourly_rate})">ભાવ બદલો</button>
      </td>
    </tr>
  `
    )
    .join('');
}

window.actionEditCropRate = async (id, name, currentRate) => {
  const newRate = prompt(`${name} માટે નવો કલાક દીઠ ભાવ (₹) દાખલ કરો:`, currentRate);
  if (newRate === null) return;
  const parsed = parseFloat(newRate);
  if (isNaN(parsed) || parsed <= 0) {
    showToast('માન્ય ભાવ દાખલ કરો', 'error');
    return;
  }

  try {
    const res = await api.updateCropRate(id, { default_hourly_rate: parsed });
    if (res.success) {
      showToast(res.message, 'success');
      await loadCrops();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ==========================================
// 12. Utilities & Modals
// ==========================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <div>${escapeHtml(message)}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
