// backend/seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/Users');

async function seedUsers() {
  // 1) connect
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('▶ MongoDB connected for seeding');

  // 2) define the users you want to create
  const users = [
    {
      username: 'admin',
      email: 'admin@brannovate.com',
      password: 'Admin@1234',
    },
    {
      username: 'jdoe',
      email: 'jdoe@example.com',
      password: 'Password1!',
    },
    // add more as needed…
  ];

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`⚠️  Skipped ${u.email} (already exists)`);
      continue;
    }
    const user = new User(u);
    await user.save();   // <-- your pre-save hook will hash `u.password`
    console.log(`✅ Created user ${u.email}`);
  }

  await mongoose.disconnect();
  console.log('▶ MongoDB connection closed');
}

seedUsers().catch(err => {
  console.error('Seeder error:', err);
  mongoose.disconnect();
});
