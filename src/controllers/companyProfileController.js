const CompanyProfile = require("../models/CompanyProfile");

// Create or Update (Upsert) profile for logged-in owner
exports.upsertProfile = async (req, res) => {
  try {
    const ownerId = req.user._id; // From auth middleware
    const data = { ...req.body, owner: ownerId };

    const profile = await CompanyProfile.findOneAndUpdate(
      { owner: ownerId },
      data,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get profile for logged-in owner
exports.getMyProfile = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const profile = await CompanyProfile.findOne({ owner: ownerId });
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
