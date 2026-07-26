const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: __dirname + '/../.env' });

async function resetPasswords() {
  await mongoose.connect(process.env.MONGO_URI);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  const result = await User.updateMany({}, { $set: { password: hashedPassword } });
  console.log('Reset passwords for accounts:', result.modifiedCount);

  const users = await User.find({}, '_id name email role');
  console.log('Updated Accounts:\n', JSON.stringify(users, null, 2));

  await mongoose.disconnect();
}

resetPasswords().catch(console.error);
