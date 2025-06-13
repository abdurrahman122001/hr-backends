const mongoose = require("mongoose");

const CompanyProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  logoUrl: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Or "Employee" if that's your login model
}, { timestamps: true });

module.exports = mongoose.model("CompanyProfile", CompanyProfileSchema);
