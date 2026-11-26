/**
 * Live API Test Runner for PulseNotify Backend
 * Executes end-to-end integration tests across all 7 endpoint groups.
 *
 * Usage:
 *   node scripts/test-api-live.js
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';

async function runTests() {
  console.log(`\n======================================================`);
  console.log(` PulseNotify Live Integration Test Suite`);
  console.log(` Target Backend: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
      passed++;
    } else {
      console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}`);
      failed++;
    }
  }

  // 1. Mock Flight Price Feed
  console.log(`[1] Testing Live Flight Price Feed...`);
  try {
    const res = await fetch(`${BASE_URL}/api/flights/price/?route=DEL-BOM`);
    const data = await res.json();
    assert(res.status === 200, 'GET /api/flights/price/?route=DEL-BOM returns 200');
    assert(data.route === 'DEL-BOM' && data.price >= 3000 && data.price <= 7000, `Valid route returns price within bounds (₹${data.price})`);

    const badRes = await fetch(`${BASE_URL}/api/flights/price/?route=INVALID-ROUTE`);
    assert(badRes.status === 404, 'Invalid route returns 404 Not Found');
  } catch (err) {
    console.error(`Failed price feed test:`, err.message);
    failed++;
  }

  // 2. Auth: Register & Login Regular User
  console.log(`\n[2] Testing Traveler Authentication...`);
  const testUser = `test_traveler_${Date.now()}`;
  const testPass = 'Tester@0555';
  let token = null;

  try {
    const regRes = await fetch(`${BASE_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: testPass }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, `POST /api/auth/register/ creates user (${testUser})`);
    assert(regData.role === 'user', 'New user role strictly defaults to "user"');

    const loginRes = await fetch(`${BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: testPass }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'POST /api/auth/login/ returns 200 OK');
    assert(typeof loginData.access === 'string' && loginData.access.length > 20, 'Returns valid JWT access token');
    token = loginData.access;
  } catch (err) {
    console.error(`Failed auth test:`, err.message);
    failed++;
  }

  // 3. Price Alert CRUD
  console.log(`\n[3] Testing Price Alert Management...`);
  let alertId = null;
  if (token) {
    try {
      // Create Alert
      const createRes = await fetch(`${BASE_URL}/api/alerts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          origin: 'DEL',
          destination: 'BOM',
          threshold_price: 4500,
        }),
      });
      const createData = await createRes.json();
      assert(createRes.status === 201, 'POST /api/alerts/ creates price alert');
      assert(createData.status === 'active', 'Initial alert status is "active"');
      alertId = createData.id;

      // List Alerts
      const listRes = await fetch(`${BASE_URL}/api/alerts/?status=active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listData = await listRes.json();
      assert(listRes.status === 200 && Array.isArray(listData), 'GET /api/alerts/?status=active returns array');
      assert(listData.some((a) => a.id === alertId), 'Created alert present in active list');

      // Detail by ID
      const detailRes = await fetch(`${BASE_URL}/api/alerts/${alertId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(detailRes.status === 200, `GET /api/alerts/${alertId}/ returns 200 OK`);

      // Deactivate (Soft Delete)
      const deleteRes = await fetch(`${BASE_URL}/api/alerts/${alertId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const deleteData = await deleteRes.json();
      assert(deleteRes.status === 200 && deleteData.status === 'inactive', 'DELETE /api/alerts/<id>/ sets status to inactive');
    } catch (err) {
      console.error(`Failed alert test:`, err.message);
      failed++;
    }
  }

  // 4. Notifications
  console.log(`\n[4] Testing Notification History...`);
  if (token) {
    try {
      const notifRes = await fetch(`${BASE_URL}/api/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(notifRes.status === 200, 'GET /api/notifications/ returns 200 OK with JWT');

      const unauthNotif = await fetch(`${BASE_URL}/api/notifications/`);
      assert(unauthNotif.status === 401, 'GET /api/notifications/ returns 401 without JWT');
    } catch (err) {
      console.error(`Failed notification test:`, err.message);
      failed++;
    }
  }

  // 5. RBAC Admin Endpoint
  console.log(`\n[5] Testing RBAC Security & Admin Summary...`);
  if (token) {
    try {
      const forbiddenRes = await fetch(`${BASE_URL}/api/admin/summary/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(forbiddenRes.status === 403, 'GET /api/admin/summary/ returns 403 Forbidden for regular traveler');

      // Try with admin user
      const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin_user', password: 'Tester@0555' }),
      });

      if (adminLoginRes.status === 200) {
        const adminData = await adminLoginRes.json();
        const adminSummaryRes = await fetch(`${BASE_URL}/api/admin/summary/`, {
          headers: { Authorization: `Bearer ${adminData.access}` },
        });
        const summaryJson = await adminSummaryRes.json();
        assert(adminSummaryRes.status === 200, 'GET /api/admin/summary/ returns 200 OK for admin role');
        assert(typeof summaryJson.total_alerts === 'number' && Array.isArray(summaryJson.top_routes), 'Admin summary contains valid telemetry metrics');
      } else {
        console.log(`  \x1b[33mℹ INFO\x1b[0m: admin_user password check skipped (use Django promotion for custom credentials)`);
      }
    } catch (err) {
      console.error(`Failed admin test:`, err.message);
      failed++;
    }
  }

  // 6. External Flight Provider & Quota Milestone Alerts
  console.log(`\n[6] Testing External API Quota Telemetry & Milestone Alerts...`);
  try {
    // Check initial quota telemetry
    const quotaRes = await fetch(`${BASE_URL}/api/admin/quota/`);
    const quotaData = await quotaRes.json();
    assert(quotaRes.status === 200, 'GET /api/admin/quota/ returns 200 OK');
    assert(typeof quotaData.monthly_limit === 'number' && quotaData.monthly_limit > 0, 'Quota limit is properly configured (e.g. 2000)');
    assert(Array.isArray(quotaData.alert_thresholds), 'Alert thresholds array configured ([25, 50, 60, 70, 80, 90])');

    // Simulate 25% milestone crossing
    const sim25Res = await fetch(`${BASE_URL}/api/admin/quota/simulate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_percentage: 25, route: 'DEL-BOM', provider: 'amadeus' }),
    });
    const sim25Data = await sim25Res.json();
    assert(sim25Res.status === 200, 'POST /api/admin/quota/simulate/ returns 200 OK');
    assert(sim25Data.percentage >= 25, `Quota consumption successfully advanced to ${sim25Data.percentage}%`);
    assert(sim25Data.newly_triggered.some(al => al.milestone === 25), 'Milestone alert for 25% triggered on threshold crossing');

    // Simulate 50% milestone crossing
    const sim50Res = await fetch(`${BASE_URL}/api/admin/quota/simulate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_percentage: 50, route: 'BLR-HYD', provider: 'amadeus' }),
    });
    const sim50Data = await sim50Res.json();
    assert(sim50Data.percentage >= 50, `Quota consumption successfully advanced to ${sim50Data.percentage}%`);
    assert(sim50Data.newly_triggered.some(al => al.milestone === 50), 'Milestone alert for 50% triggered on threshold crossing');

    // Verify rich flight pricing payload includes provider and quota
    const flightRes = await fetch(`${BASE_URL}/api/flights/price/?route=DEL-BOM`);
    const flightData = await flightRes.json();
    assert(typeof flightData.provider === 'string', `Flight feed reports provider: ${flightData.provider}`);
    assert(typeof flightData.quota === 'object', 'Flight feed response includes real-time quota telemetry object');

    // Reset quota
    const resetRes = await fetch(`${BASE_URL}/api/admin/quota/`, { method: 'POST' });
    const resetData = await resetRes.json();
    assert(resetRes.status === 200 && resetData.used_calls === 0, 'POST /api/admin/quota/ resets counter back to 0');
  } catch (err) {
    console.error(`Failed quota test:`, err.message);
    failed++;
  }

  console.log(`\n======================================================`);

  console.log(` Test Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[${failed > 0 ? '31' : '32'}m${failed} Failed\x1b[0m`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
