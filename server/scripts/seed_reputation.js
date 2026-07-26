const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: __dirname + '/../.env' });

async function seedReputation() {
  await mongoose.connect(process.env.MONGO_URI);

  const updates = [
    { email: 'ayushranjan4242@gmail.com', reputation: 210 },
    { email: 'deep1015@gmail.com', reputation: 85 },
    { email: 'madan1015@gmail.com', reputation: 160 },
    { email: 'anand1015@gmail.com', reputation: 120 },
    { email: 'civic1015@gmail.com', reputation: 50 },
  ];

  for (const u of updates) {
    await User.findOneAndUpdate({ email: u.email }, { $set: { reputation: u.reputation } });
    console.log(`Updated ${u.email} -> reputation: ${u.reputation}`);
  }

  const users = await User.find({}, '_id name email role reputation');
  console.log('\nFinal User Reputations:');
  users.forEach((u) => {
    console.log(`  ${u.name} (${u.role}) -> ${u.reputation} Karma`);
  });

  await mongoose.disconnect();
}

seedReputation().catch(console.error);
