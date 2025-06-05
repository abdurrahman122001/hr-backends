// backend/src/routes/employees.js
const express = require("express");
const Employee = require("../models/Employees");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────
// GET /api/employees/:id/complete
//    - Returns the AI‐populated fields for that employee so the React form
//      can display them read‐only.
// ─────────────────────────────────────────────────────────────────────────
router.get("/:id/complete", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const emp = await Employee.findById(id).select(
      "name email cnic dateOfBirth fatherOrHusbandName phone nationality"
    );
    if (!emp) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }
    // Return exactly those fields as JSON
    return res.json({
      success: true,
      data: {
        _id: emp._id.toString(),
        name: emp.name,
        email: emp.email,
        cnic: emp.cnic,
        dateOfBirth: emp.dateOfBirth || "",
        fatherOrHusbandName: emp.fatherOrHusbandName || "",
        phone: emp.phone || "",
        nationality: emp.nationality || "",
      },
    });
  } catch (err) {
    console.error("❌ GET /api/employees/:id/complete error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/employees/:id/complete
//    - Accepts the “remaining” fields from the form and merges them into
//      the Employee document.
// ─────────────────────────────────────────────────────────────────────────
router.put("/:id/complete", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Only these fields are expected from the form
    const {
      photographUrl,
      gender,
      maritalStatus,
      religion,
      latestQualification,
      presentAddress,
      permanentAddress,
      bankName,
      bankAccountNumber,
      nomineeName,
      nomineeRelation,
      nomineeCnic,
      nomineeEmergencyNo,
      department,
      designation,
      joiningDate,
    } = req.body;

    const emp = await Employee.findById(id);
    if (!emp) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    // Merge only those “remaining” fields
    emp.photographUrl = photographUrl || emp.photographUrl;
    emp.gender = gender || emp.gender;
    emp.maritalStatus = maritalStatus || emp.maritalStatus;
    emp.religion = religion || emp.religion;
    emp.latestQualification = latestQualification || emp.latestQualification;
    emp.presentAddress = presentAddress || emp.presentAddress;
    emp.permanentAddress = permanentAddress || emp.permanentAddress;
    emp.bankName = bankName || emp.bankName;
    emp.bankAccountNumber = bankAccountNumber || emp.bankAccountNumber;
    emp.nomineeName = nomineeName || emp.nomineeName;
    emp.nomineeRelation = nomineeRelation || emp.nomineeRelation;
    emp.nomineeCnic = nomineeCnic || emp.nomineeCnic;
    emp.nomineeEmergencyNo = nomineeEmergencyNo || emp.nomineeEmergencyNo;
    emp.department = department || emp.department;
    emp.designation = designation || emp.designation;
    emp.joiningDate = joiningDate || emp.joiningDate;

    await emp.save();
    return res.json({ success: true, data: { _id: emp._id.toString() } });
  } catch (err) {
    console.error("❌ PUT /api/employees/:id/complete error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
