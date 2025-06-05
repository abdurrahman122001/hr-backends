// backend/src/routes/staff.js
const express           = require("express");
const multer            = require("multer");
const path              = require("path");
const router            = express.Router();
const requireAuth       = require("../middleware/auth");
const Employee          = require("../models/Employees");
const SalarySlip        = require("../models/SalarySlip");
const EmployeeHierarchy = require("../models/EmployeeHierarchy");

// Multer setup for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads/photos"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

router.post(
  "/create",
  requireAuth,
  upload.single("photographFile"),
  async (req, res) => {
    const {
      // ────────────────────────────────────────────────────────────────────
      // Personal
      name,
      email,
      fatherOrHusbandName,
      cnic,
      dateOfBirth,
      gender,
      nationality,
      cnicIssueDate,
      cnicExpiryDate,
      maritalStatus,
      religion,
      latestQualification,
      phone,
      permanentAddress,
      presentAddress,
      bankName,
      bankAccountNumber,
      nomineeName,
      nomineeRelation,
      nomineeCnic,
      nomineeEmergencyNo,
      rt,

      // ─ Employment ───────────────────────────────────────────────────────
      department,
      designation,
      joiningDate,
      leaveEntitlement,

      // ─ Compensation ────────────────────────────────────────────────────
      basic,
      dearnessAllowance,
      houseRentAllowance,
      conveyanceAllowance,
      medicalAllowance,
      utilityAllowance,
      overtimeComp,
      dislocationAllowance,
      leaveEncashment,
      bonus,
      arrears,
      autoAllowance,
      incentive,
      fuelAllowance,
      othersAllowances,
      grossSalary,

      // ─ Deductions ───────────────────────────────────────────────────────
      leaveDeductions,
      lateDeductions,
      eobiDeduction,
      sessiDeduction,
      providentFundDeduction,
      gratuityFundDeduction,
      vehicleLoanDeduction,
      otherLoanDeductions,
      advanceSalaryDeductions,
      medicalInsurance,
      lifeInsurance,
      penalties,
      otherDeductions,
      taxDeduction,

      // ─ Hierarchy ────────────────────────────────────────────────────────
      seniorId,
      juniorId,
      relation,

      // ─ HR/Admin flags ───────────────────────────────────────────────────
      isHR,
      isAdmin,
      password,
    } = req.body;

    // Required fields
    if (!name || !department || !designation) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: name, department, designation",
      });
    }

    try {
      // ────────────────────────────────────────────────────────────────────
      // If marking as HR, ensure a password was provided
      // ────────────────────────────────────────────────────────────────────
      const hrFlag = isHR === "true" || isHR === true;
      if (hrFlag && !password) {
        return res.status(400).json({
          status: "error",
          message: "Password is required when isHR = true.",
        });
      }

      // ────────────────────────────────────────────────────────────────────
      // 1) Create Employee record (Mongoose pre-save will hash `password`)
      // ────────────────────────────────────────────────────────────────────
      const emp = new Employee({
        owner:               req.user._id,
        name,
        email,
        password:            hrFlag ? password : null,
        fatherOrHusbandName,
        cnic,
        photographUrl:       req.file ? `/uploads/photos/${req.file.filename}` : undefined,
        dateOfBirth:         dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        nationality,
        cnicIssueDate:       cnicIssueDate ? new Date(cnicIssueDate) : undefined,
        cnicExpiryDate:      cnicExpiryDate ? new Date(cnicExpiryDate) : undefined,
        maritalStatus,
        religion,
        latestQualification,
        phone,
        permanentAddress,
        presentAddress,
        bankName,
        bankAccountNumber,
        nomineeName,
        nomineeRelation,
        nomineeCnic,
        nomineeEmergencyNo,
        rt,

        department,
        designation,
        joiningDate:         joiningDate ? new Date(joiningDate) : undefined,

        leaveEntitlement: {
          total:    Number(leaveEntitlement) || 0,
          usedPaid:   0,
          usedUnpaid: 0,
        },

        compensation: {
          basic:                Number(basic)               || 0,
          dearnessAllowance:    Number(dearnessAllowance)   || 0,
          houseRentAllowance:   Number(houseRentAllowance)  || 0,
          conveyanceAllowance:  Number(conveyanceAllowance) || 0,
          medicalAllowance:     Number(medicalAllowance)    || 0,
          utilityAllowance:     Number(utilityAllowance)    || 0,
          overtimeComp:         Number(overtimeComp)        || 0,
          dislocationAllowance: Number(dislocationAllowance)|| 0,
          leaveEncashment:      Number(leaveEncashment)     || 0,
          bonus:                Number(bonus)               || 0,
          arrears:              Number(arrears)             || 0,
          autoAllowance:        Number(autoAllowance)       || 0,
          incentive:            Number(incentive)           || 0,
          fuelAllowance:        Number(fuelAllowance)       || 0,
          others:               Number(othersAllowances)    || 0,
          grossSalary:          Number(grossSalary)         || 0,
        },

        deductions: {
          leaveDeductions:         Number(leaveDeductions)         || 0,
          lateDeductions:          Number(lateDeductions)          || 0,
          eobi:                    Number(eobiDeduction)           || 0,
          sessi:                   Number(sessiDeduction)          || 0,
          providentFund:           Number(providentFundDeduction)  || 0,
          gratuityFund:            Number(gratuityFundDeduction)   || 0,
          loanDeductions: {
            vehicleLoan: Number(vehicleLoanDeduction) || 0,
            otherLoans:  Number(otherLoanDeductions)  || 0,
          },
          advanceSalary:            Number(advanceSalaryDeductions)|| 0,
          medicalInsurance:         Number(medicalInsurance)       || 0,
          lifeInsurance:            Number(lifeInsurance)          || 0,
          penalties:                Number(penalties)              || 0,
          others:                   Number(otherDeductions)        || 0,
          tax:                      Number(taxDeduction)           || 0,
        },

        isHR:    hrFlag,
        isAdmin: isAdmin === "true" || isAdmin === true,
      });

      await emp.save();

      // ────────────────────────────────────────────────────────────────────
      // 2) Create SalarySlip
      // ────────────────────────────────────────────────────────────────────
      const slip = new SalarySlip({
        employee:             emp._id,
        generatedOn:          new Date(),

        basic:                emp.compensation.basic,
        dearnessAllowance:    emp.compensation.dearnessAllowance,
        houseRentAllowance:   emp.compensation.houseRentAllowance,
        conveyanceAllowance:  emp.compensation.conveyanceAllowance,
        medicalAllowance:     emp.compensation.medicalAllowance,
        utilityAllowance:     emp.compensation.utilityAllowance,
        overtimeCompensation: emp.compensation.overtimeComp,
        dislocationAllowance: emp.compensation.dislocationAllowance,
        leaveEncashment:      emp.compensation.leaveEncashment,
        bonus:                emp.compensation.bonus,
        arrears:              emp.compensation.arrears,
        autoAllowance:        emp.compensation.autoAllowance,
        incentive:            emp.compensation.incentive,
        fuelAllowance:        emp.compensation.fuelAllowance,
        othersAllowances:     emp.compensation.others,
        grossSalary:          emp.compensation.grossSalary,

        leaveDeductions:         emp.deductions.leaveDeductions,
        lateDeductions:          emp.deductions.lateDeductions,
        eobiDeduction:           emp.deductions.eobi,
        sessiDeduction:          emp.deductions.sessi,
        providentFundDeduction:  emp.deductions.providentFund,
        gratuityFundDeduction:   emp.deductions.gratuityFund,
        loanDeductions: {
          vehicleLoan:           emp.deductions.loanDeductions.vehicleLoan,
          otherLoans:            emp.deductions.loanDeductions.otherLoans,
        },
        advanceSalaryDeductions: emp.deductions.advanceSalary,
        medicalInsurance:        emp.deductions.medicalInsurance,
        lifeInsurance:           emp.deductions.lifeInsurance,
        penalties:               emp.deductions.penalties,
        othersDeductions:        emp.deductions.others,
        taxDeduction:            emp.deductions.tax,
      });
      await slip.save();

      // ────────────────────────────────────────────────────────────────────
      // 3) Hierarchy links
      // ────────────────────────────────────────────────────────────────────
      if (seniorId) {
        await EmployeeHierarchy.create({
          owner:   req.user._id,
          senior:  seniorId,
          junior:  emp._id,
          relation,
        });
      }
      if (juniorId) {
        await EmployeeHierarchy.create({
          owner:   req.user._id,
          senior:  emp._id,
          junior:  juniorId,
          relation,
        });
      }

      // ────────────────────────────────────────────────────────────────────
      // 4) Return success
      // ────────────────────────────────────────────────────────────────────
      res.json({
        status: "success",
        data: { employee: emp, salarySlip: slip },
      });
    } catch (err) {
      console.error("❌ staff/create error:", err);
      res.status(500).json({ status: "error", message: err.message });
    }
  }
);

module.exports = router;
