const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: __dirname + '/../.env' });

async function listUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({});
  console.log('--- MONGODB ALL USERS ---');
  users.forEach((u) => {
    console.log(`ID: ${u._id} | Name: "${u.name}" | Email: "${u.email}" | Role: "${u.role}"`);
  });
  console.log('-------------------------');
  await mongoose.disconnect();
}

listUsers().catch(console.error);
