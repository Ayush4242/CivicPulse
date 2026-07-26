const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.PORT = 6002;
require('../server.js');

const API_URL = 'http://localhost:6002';

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
    const inspectorEmail = `inspector_${timestamp}@test.com`;
    const crewEmail = `crew_${timestamp}@test.com`;

    console.log('\n1. Registering Citizen, Moderator, Inspector, and Work Crew...');
    const citizenReg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Test Citizen',
      email: citizenEmail,
      password: 'password123',
      role: 'citizen'
    });
    const citizenToken = citizenReg.data.token;

    const modReg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Test Moderator',
      email: moderatorEmail,
      password: 'password123',
      role: 'moderator'
    });
    const modToken = modReg.data.token;

    const inspectorReg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Field Inspector A',
      email: inspectorEmail,
      password: 'password123',
      role: 'staff'
    });
    const inspectorToken = inspectorReg.data.token;
    const inspectorId = inspectorReg.data.user.id;

    const crewReg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Work Crew B',
      email: crewEmail,
      password: 'password123',
      role: 'staff'
    });
    const crewToken = crewReg.data.token;
    const crewId = crewReg.data.user.id;

    console.log('✅ Users registered.');

    console.log('\n2. Creating an incident as Citizen...');
    const incidentRes = await axios.post(
      `${API_URL}/api/incidents`,
      {
        title: 'Water pipe leak on 5th Ave',
        description: 'Water spraying onto the sidewalk.',
        category: 'water_leakage',
        severity: 'medium',
        address: '5th Ave, Block C',
        longitude: 77.5946,
        latitude: 12.9716
      },
      { headers: { Authorization: `Bearer ${citizenToken}` } }
    );
    const incidentId = incidentRes.data.incident._id;
    console.log('✅ Incident created. Status:', incidentRes.data.incident.status);

    console.log('\n3. Moderator sends for FIELD INSPECTION (not work yet)...');
    const inspectAssign = await axios.patch(
      `${API_URL}/api/incidents/${incidentId}/assign`,
      { assignedTo: inspectorId, phase: 'inspection' },
      { headers: { Authorization: `Bearer ${modToken}` } }
    );
    console.log('✅ Inspection assigned. Status:', inspectAssign.data.incident.status);
    console.log('Phase:', inspectAssign.data.incident.assignmentPhase);

    console.log('\n4. Inspector starts inspection...');
    await axios.post(
      `${API_URL}/api/incidents/${incidentId}/staff-report`,
      { status: 'started', message: 'On site, checking the leak.' },
      { headers: { Authorization: `Bearer ${inspectorToken}` } }
    );
    console.log('✅ Inspection started.');

    console.log('\n5. Inspector reports ISSUE CONFIRMED back to moderator...');
    const inspectReport = await axios.post(
      `${API_URL}/api/incidents/${incidentId}/staff-report`,
      { status: 'verified', message: 'Confirmed active pipe rupture near hydrant.' },
      { headers: { Authorization: `Bearer ${inspectorToken}` } }
    );
    console.log('✅ Inspection report submitted.');
    console.log('Public Status (expected verified):', inspectReport.data.incident.status);
    console.log('Staff Status:', inspectReport.data.incident.staffStatus);
    console.log('Phase still inspection:', inspectReport.data.incident.assignmentPhase);

    if (inspectReport.data.incident.status !== 'verified') {
      throw new Error('Expected status verified after successful inspection');
    }

    console.log('\n6. Moderator NOW assigns WORK TASK to crew...');
    const workAssign = await axios.patch(
      `${API_URL}/api/incidents/${incidentId}/assign`,
      { assignedTo: crewId, phase: 'work' },
      { headers: { Authorization: `Bearer ${modToken}` } }
    );
    console.log('✅ Work assigned. Status:', workAssign.data.incident.status);
    console.log('Phase:', workAssign.data.incident.assignmentPhase);
    console.log('Assignee:', workAssign.data.incident.assignedTo.name);

    console.log('\n7. Work crew starts and reports verified...');
    await axios.post(
      `${API_URL}/api/incidents/${incidentId}/staff-report`,
      { status: 'started', message: 'Shutting valve, beginning repair.' },
      { headers: { Authorization: `Bearer ${crewToken}` } }
    );
    const workDone = await axios.post(
      `${API_URL}/api/incidents/${incidentId}/staff-report`,
      { status: 'verified', message: 'Pipe patched and pressure restored.' },
      { headers: { Authorization: `Bearer ${crewToken}` } }
    );
    console.log('✅ Work report submitted. Status:', workDone.data.incident.status);
    console.log('Staff Status:', workDone.data.incident.staffStatus);

    console.log('\n8. Moderator marks resolved...');
    const resolveRes = await axios.put(
      `${API_URL}/api/incidents/${incidentId}/status`,
      { status: 'resolved', message: 'Repair verified after work crew report.' },
      { headers: { Authorization: `Bearer ${modToken}` } }
    );
    console.log('✅ Resolved. Status:', resolveRes.data.incident.status);

    console.log('\n9. Citizen confirms close...');
    const closeRes = await axios.put(
      `${API_URL}/api/incidents/${incidentId}/status`,
      { status: 'closed', message: 'Looks fixed. Thanks!' },
      { headers: { Authorization: `Bearer ${citizenToken}` } }
    );
    console.log('✅ Closed. Status:', closeRes.data.incident.status);

    console.log('\n10. Stats include closed in resolvedTotal...');
    const statsRes = await axios.get(
      `${API_URL}/api/incidents/moderation/stats`,
      { headers: { Authorization: `Bearer ${modToken}` } }
    );
    if ((statsRes.data.stats.closed || 0) < 1) throw new Error('Expected closed >= 1');
    if ((statsRes.data.stats.resolvedTotal || 0) < 1) throw new Error('Expected resolvedTotal >= 1');

    console.log('\n🎉 TWO-PHASE (inspection → work) FLOW PASSED!');
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
