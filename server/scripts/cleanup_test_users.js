const mongoose = require('mongoose');
const User = require('../models/User');
const Incident = require('../models/Incident');
require('dotenv').config({ path: __dirname + '/../.env' });

async function cleanupTestData() {
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Find test users to delete
  const testUsers = await User.find({
    $or: [
      { email: { $regex: /@test\.com$/i } },
      { email: 'test@example.com' }
    ]
  });

  const testUserIds = testUsers.map((u) => u._id);
  console.log('Found test users to delete:', testUsers.map((u) => `${u.name} (${u.email})`));

  // 2. Delete test incidents reported by test users or with title 'Pothole on Main St'
  const deletedIncidents = await Incident.deleteMany({
    $or: [
      { reportedBy: { $in: testUserIds } },
      { title: 'Pothole on Main St' }
    ]
  });
  console.log('Deleted test incidents count:', deletedIncidents.deletedCount);

  // 3. For any remaining incidents assigned to test users, set assignedTo to null
  const updatedIncidents = await Incident.updateMany(
    { assignedTo: { $in: testUserIds } },
    { $set: { assignedTo: null } }
  );
  console.log('Updated remaining incidents assignedTo count:', updatedIncidents.modifiedCount);

  // 4. Delete test users
  const deletedUsers = await User.deleteMany({ _id: { $in: testUserIds } });
  console.log('Deleted test users count:', deletedUsers.deletedCount);

  // 5. List remaining users
  const remainingUsers = await User.find({}, '_id name email role');
  console.log('Remaining Users in Database:\n', JSON.stringify(remainingUsers, null, 2));

  await mongoose.disconnect();
}

cleanupTestData().catch(console.error);
