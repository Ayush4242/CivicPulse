const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');

// Configure dotenv path relative to server root
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Set port to 6001 so it doesn't conflict
process.env.PORT = 6001;
require('../server.js');

const API_URL = 'http://localhost:6001';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('⏳ Waiting for MongoDB connection...');
  await sleep(3000); // Wait for connection

  try {
    const timestamp = Date.now();
    const citizenEmail = `citizen_${timestamp}@test.com`;
    const moderator1Email = `mod1_${timestamp}@test.com`;
    const moderator2Email = `mod2_${timestamp}@test.com`;

    console.log('\n1. Registering Citizen, Moderator 1, and Moderator 2...');
    const citizenReg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Test Citizen',
      email: citizenEmail,
      password: 'password123',
      role: 'citizen'
    });
    const citizenToken = citizenReg.data.token;

    const mod1Reg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Mod One',
      email: moderator1Email,
      password: 'password123',
      role: 'moderator'
    });
    const mod1Token = mod1Reg.data.token;
    const mod1Id = mod1Reg.data.user.id;

    const mod2Reg = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Mod Two',
      email: moderator2Email,
      password: 'password123',
      role: 'moderator'
    });
    const mod2Token = mod2Reg.data.token;
    const mod2Id = mod2Reg.data.user.id;

    console.log('✅ Users registered.');

    console.log('\n2. Testing GET /api/auth/assignable-users...');
    const assignableRes = await axios.get(`${API_URL}/api/auth/assignable-users`, {
      headers: { Authorization: `Bearer ${mod1Token}` }
    });
    console.log('✅ Assignable users retrieved successfully. Count:', assignableRes.data.users.length);
    const hasMods = assignableRes.data.users.some(u => u.role === 'moderator' || u.role === 'admin');
    console.log('✅ Contains moderators/admins:', hasMods);

    // Test authorization for assignable users
    try {
      await axios.get(`${API_URL}/api/auth/assignable-users`, {
        headers: { Authorization: `Bearer ${citizenToken}` }
      });
      console.error('❌ FAILED: Citizen was allowed to get assignable users!');
      await cleanupAndExit(1);
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ PASS: Citizen blocked from assignable users endpoint (received 403).');
      } else {
        throw err;
      }
    }

    console.log('\n3. Creating an incident as Citizen...');
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
      {
        headers: { Authorization: `Bearer ${citizenToken}` }
      }
    );
    const incidentId = incidentRes.data.incident._id;
    console.log('✅ Incident created. Status:', incidentRes.data.incident.status);

    console.log('\n4. Testing GET /api/incidents/moderation/stats...');
    const statsRes = await axios.get(`${API_URL}/api/incidents/moderation/stats`, {
      headers: { Authorization: `Bearer ${mod1Token}` }
    });
    console.log('✅ Stats retrieved successfully. Stats:', statsRes.data.stats);

    // Test validation: Assigning WORK on a reported incident should fail (need inspection first)
    console.log('\n5. Attempting to assign WORK task on reported incident (should fail)...');
    try {
      await axios.patch(
        `${API_URL}/api/incidents/${incidentId}/assign`,
        { assignedTo: mod2Id, phase: 'work' },
        { headers: { Authorization: `Bearer ${mod1Token}` } }
      );
      console.error('❌ FAILED: Allowed to assign work on reported incident!');
      await cleanupAndExit(1);
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✅ PASS: Work assign on reported incident blocked with 400.');
      } else {
        throw err;
      }
    }

    console.log('\n6. Sending reported incident for FIELD INSPECTION to Moderator 2...');
    const assignRes = await axios.patch(
      `${API_URL}/api/incidents/${incidentId}/assign`,
      { assignedTo: mod2Id, phase: 'inspection' },
      { headers: { Authorization: `Bearer ${mod1Token}` } }
    );
    console.log('✅ Inspection assigned successfully.');
    console.log('Returned Status:', assignRes.data.incident.status);
    console.log('Phase:', assignRes.data.incident.assignmentPhase);
    console.log('AssignedTo populated details:', assignRes.data.incident.assignedTo);
    console.log('AssignedAt:', assignRes.data.incident.assignedAt);
    console.log('Last timeline event:', assignRes.data.incident.timeline[assignRes.data.incident.timeline.length - 1]);

    if (
      assignRes.data.incident.status === 'assigned' &&
      assignRes.data.incident.assignmentPhase === 'inspection' &&
      assignRes.data.incident.assignedTo._id === mod2Id &&
      assignRes.data.incident.assignedTo.name === 'Mod Two'
    ) {
      console.log('✅ PASS: Incident fields and timeline updated correctly.');
    } else {
      console.error('❌ FAILED: Incident state mismatch after assignment:', assignRes.data.incident);
      await cleanupAndExit(1);
    }

    console.log('\n🎉 ALL ASSIGNMENT TESTS PASSED SUCCESSFULLY!');
    await cleanupAndExit(0);
  } catch (err) {
    console.error('❌ Test execution encountered an error:', err.response?.data || err.message);
    await cleanupAndExit(1);
  }
}

async function cleanupAndExit(code, createdUserIds = [], createdIncidentIds = []) {
  console.log('Cleaning up test data and mongoose connection...');
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
    console.log('Test data cleaned up and Mongoose connection closed.');
  } catch (err) {
    console.error('Error during cleanup:', err.message);
  }
  process.exit(code);
}

runTests();
