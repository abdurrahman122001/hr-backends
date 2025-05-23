// backend/seedUsers.js
require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./src/models/Users');  // CommonJS model

(async () => {
  // 1) Connect
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('🔗 Connected to MongoDB');

  // 2) Remove old admin if any (so we don’t skip)
  await User.deleteOne({ username: 'admin' });
  console.log('🗑️  Old admin record removed (if existed)');

  // 3) Create new admin with plain password
  const admin = new User({
    username: 'admin',
    email:    'abdullahahmedqureshint@gmail.com',
    password: 'Admin@123',
  });
  await admin.save();  // pre-save hook will hash once
  console.log('🎉 New admin user created');

  // 4) Tear down
  await mongoose.disconnect();
  process.exit(0);
})();
