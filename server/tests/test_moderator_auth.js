const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.PORT = 5999;
require('../server.js');

const API_URL = 'http://localhost:5999';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('⏳ Waiting for MongoDB connection...');
  await sleep(3000);

  try {
    const timestamp = Date.now();
    const citizenEmail = `citizen_${timestamp}@test.com`;
    const moderatorEmail = `mod_${timestamp}@test.com`;
    const staffEmail = `staff_${timestamp}@test.com`;

    console.log('\n1. Registering users...');
    const citizenReg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Test Citizen',
      email: citizenEmail,
      password: 'password123',
      role: 'citizen'
    });
    const citizenToken = citizenReg.data.token;

    const moderatorReg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Test Moderator',
      email: moderatorEmail,
      password: 'password123',
      role: 'moderator'
    });
    const moderatorToken = moderatorReg.data.token;
    const moderatorId = moderatorReg.data.user.id;

    const staffReg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Test Staff',
      email: staffEmail,
      password: 'password123',
      role: 'staff'
    });
    const staffToken = staffReg.data.token;
    const staffId = staffReg.data.user.id;
    console.log('✅ Users registered.');

    console.log('\n2. Creating an incident as Citizen...');
    const incidentRes = await axios.post(
      `${API_URL}/api/incidents`,
      {
        title: 'Pothole on Main St',
        description: 'Large pothole blocking the left lane near 4th crossroad.',
        category: 'pothole',
        severity: 'high',
        address: 'Main St, Block 4',
        longitude: 77.5946,
        latitude: 12.9716
      },
      { headers: { Authorization: `Bearer ${citizenToken}` } }
    );
    const incidentId = incidentRes.data.incident._id;
    console.log('✅ Incident created. ID:', incidentId);

    console.log('\n3. Citizen cannot send for inspection...');
    try {
      await axios.patch(
        `${API_URL}/api/incidents/${incidentId}/assign`,
        { assignedTo: staffId, phase: 'inspection' },
        { headers: { Authorization: `Bearer ${citizenToken}` } }
      );
      console.error('❌ FAILED: Citizen was allowed to assign inspection!');
      await cleanupAndExit(1);
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ PASS: Citizen blocked from assign (403).');
      } else {
        throw err;
      }
    }

    console.log('\n4. Citizen cannot desk-verify (reported → verified)...');
    try {
      await axios.put(
        `${API_URL}/api/incidents/${incidentId}/status`,
        { status: 'verified', message: 'Approved by citizen' },
        { headers: { Authorization: `Bearer ${citizenToken}` } }
      );
      console.error('❌ FAILED: Citizen was allowed to verify!');
      await cleanupAndExit(1);
    } catch (err) {
      if (err.response && (err.response.status === 403 || err.response.status === 400)) {
        console.log('✅ PASS: Citizen blocked from verify (' + err.response.status + ').');
      } else {
        throw err;
      }
    }

    console.log('\n5. Moderator cannot desk-verify either (must use field inspection)...');
    try {
      await axios.put(
        `${API_URL}/api/incidents/${incidentId}/status`,
        { status: 'verified', message: 'Desk verify' },
        { headers: { Authorization: `Bearer ${moderatorToken}` } }
      );
      console.error('❌ FAILED: Desk verify should be blocked!');
      await cleanupAndExit(1);
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✅ PASS: Desk verify blocked (400) — inspection required.');
      } else {
        throw err;
      }
    }

    console.log('\n6. Moderator sends for field inspection...');
    let current = (await axios.patch(
      `${API_URL}/api/incidents/${incidentId}/assign`,
      { assignedTo: staffId, phase: 'inspection' },
      { headers: { Authorization: `Bearer ${moderatorToken}` } }
    )).data.incident;
    console.log('✅ Inspection assigned. Status:', current.status, 'Phase:', current.assignmentPhase);

    console.log('\n7. Staff inspects and confirms...');
    await axios.post(
      `${API_URL}/api/incidents/${incidentId}/staff-report`,
      { status: 'started', message: 'On site' },
      { headers: { Authorization: `Bearer ${staffToken}` } }
    );
    current = (await axios.post(
      `${API_URL}/api/incidents/${incidentId}/staff-report`,
      { status: 'verified', message: 'Pothole confirmed' },
      { headers: { Authorization: `Bearer ${staffToken}` } }
    )).data.incident;
    console.log('✅ Inspection confirmed. Status:', current.status);

    console.log('\n8. Moderator assigns work task...');
    current = (await axios.patch(
      `${API_URL}/api/incidents/${incidentId}/assign`,
      { assignedTo: moderatorId, phase: 'work' },
      { headers: { Authorization: `Bearer ${moderatorToken}` } }
    )).data.incident;
    console.log('✅ Work assigned. Status:', current.status, 'Phase:', current.assignmentPhase);

    console.log('\n9. Work crew reports done; moderator resolves; citizen closes...');
    await axios.post(
      `${API_URL}/api/incidents/${incidentId}/staff-report`,
      { status: 'started', message: 'Repairing' },
      { headers: { Authorization: `Bearer ${moderatorToken}` } }
    );
    await axios.post(
      `${API_URL}/api/incidents/${incidentId}/staff-report`,
      { status: 'verified', message: 'Filled and sealed' },
      { headers: { Authorization: `Bearer ${moderatorToken}` } }
    );
    current = (await axios.put(
      `${API_URL}/api/incidents/${incidentId}/status`,
      { status: 'resolved', message: 'Repairs completed' },
      { headers: { Authorization: `Bearer ${moderatorToken}` } }
    )).data.incident;
    console.log('✅ Resolved:', current.status);

    current = (await axios.put(
      `${API_URL}/api/incidents/${incidentId}/status`,
      { status: 'closed', message: 'Looks good!' },
      { headers: { Authorization: `Bearer ${citizenToken}` } }
    )).data.incident;
    console.log('✅ Closed:', current.status);

    console.log('\n🎉 ALL AUTH / FLOW TESTS PASSED!');
    await cleanupAndExit(0);
  } catch (err) {
    console.error('❌ Test error:', err.response?.data || err.message);
    await cleanupAndExit(1);
  }
}

async function cleanupAndExit(code, createdUserIds = [], createdIncidentIds = []) {
  try {
    const User = require('../models/User');
    const Incident = require('../models/Incident');
    if (createdIncidentIds.length > 0) {
      await Incident.deleteMany({ _id: { $in: createdIncidentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error during cleanup:', err.message);
  }
  process.exit(code);
}

runTests();
