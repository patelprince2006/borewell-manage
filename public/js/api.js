// API Client for Borewell Water Hisab

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Error occurred while contacting server');
    }
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // Hisab Summary & Ledger
  getSummary: () => request('/hisab/summary'),
  getFarmerBill: (farmerId, startDate, endDate) => {
    const params = new URLSearchParams({ farmer_id: farmerId });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return request(`/hisab/farmer-bill?${params.toString()}`);
  },
  getAllFarmersHisab: (startDate, endDate, search, activeOnly) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (search) params.append('search', search);
    if (activeOnly !== undefined) params.append('active_only', activeOnly);
    return request(`/hisab/all-farmers?${params.toString()}`);
  },

  // Farmers
  getFarmers: (search = '') => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return request(`/farmers${params}`);
  },
  getFarmer: (id) => request(`/farmers/${id}`),
  createFarmer: (farmer) =>
    request('/farmers', {
      method: 'POST',
      body: JSON.stringify(farmer),
    }),
  updateFarmer: (id, farmer) =>
    request(`/farmers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(farmer),
    }),
  deleteFarmer: (id) =>
    request(`/farmers/${id}`, {
      method: 'DELETE',
    }),

  // Crops
  getCrops: () => request('/crops'),
  createCrop: (crop) =>
    request('/crops', {
      method: 'POST',
      body: JSON.stringify(crop),
    }),
  updateCropRate: (id, data) =>
    request(`/crops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Water Entries
  getWaterEntries: (farmerId = '', startDate = '', endDate = '') => {
    const params = new URLSearchParams();
    if (farmerId) params.append('farmer_id', farmerId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return request(`/water-entries?${params.toString()}`);
  },
  createWaterEntry: (entry) =>
    request('/water-entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),
  deleteWaterEntry: (id) =>
    request(`/water-entries/${id}`, {
      method: 'DELETE',
    }),

  // Payments
  getPayments: (farmerId = '') => {
    const params = farmerId ? `?farmer_id=${encodeURIComponent(farmerId)}` : '';
    return request(`/payments${params}`);
  },
  createPayment: (payment) =>
    request('/payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    }),
  deletePayment: (id) =>
    request(`/payments/${id}`, {
      method: 'DELETE',
    }),
};
