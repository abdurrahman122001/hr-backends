// backend/src/routes/salarySlips.js
const express     = require('express');
const PDFDocument = require('pdfkit');
const router      = express.Router();
const requireAuth = require('../middleware/auth');
const SalarySlip  = require('../models/SalarySlip');
const Employee    = require('../models/Employees');

// List of all allowance fields [Label, modelKey]
const allowances = [
  ['Basic', 'basic'],
  ['Dearness Allowance', 'dearnessAllowance'],
  ['House Rent Allowance', 'houseRentAllowance'],
  ['Conveyance Allowance', 'conveyanceAllowance'],
  ['Medical Allowance', 'medicalAllowance'],
  ['Utility Allowance', 'utilityAllowance'],
  ['Overtime Compensation', 'overtimeComp'],
  ['Dislocation Allowance', 'dislocationAllowance'],
  ['Leave Encashment', 'leaveEncashment'],
  ['Bonus', 'bonus'],
  ['Arrears', 'arrears'],
  ['Auto Allowance', 'autoAllowance'],
  ['Incentive', 'incentive'],
  ['Fuel Allowance', 'fuelAllowance'],
  ['Other Allowances', 'othersAllowances'],
];

// List of all deduction fields [Label, modelKey]
const deductions = [
  ['Leave Deductions', 'leaveDeductions'],
  ['Late Deductions', 'lateDeductions'],
  ['EOBI Deduction', 'eobiDeduction'],
  ['SESSI Deduction', 'sessiDeduction'],
  ['Provident Fund Deduction', 'providentFundDeduction'],
  ['Gratuity Fund Deduction', 'gratuityFundDeduction'],
  ['Vehicle Loan Deduction', 'vehicleLoanDeduction'],
  ['Other Loan Deductions', 'otherLoanDeductions'],
  ['Advance Salary Deductions', 'advanceSalaryDeductions'],
  ['Medical Insurance', 'medicalInsurance'],
  ['Life Insurance', 'lifeInsurance'],
  ['Penalties', 'penalties'],
  ['Other Deductions', 'otherDeductions'],
  ['Tax Deduction', 'taxDeduction'],
];

// GET all slips for the logged-in owner, newest first
router.get('/', requireAuth, async (req, res) => {
  try {
    // find all your employees
    const emps = await Employee.find({ owner: req.user._id }).select('_id');
    const ids = emps.map(e => e._id);

    // populate name, department & designation
    const slips = await SalarySlip
      .find({ employee: { $in: ids } })
      .populate('employee', 'name department designation')
      .sort({ createdAt: -1 });

    res.json({ slips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Download one slip as PDF
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    // Fetch and populate the *singular* employee field (no trailing 's')
    const slip = await SalarySlip
      .findById(req.params.id)
      .populate('employee', 'name department designation joiningDate owner');

    if (!slip) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    if (slip.employee.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    // Setup PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    const month = slip.createdAt.toISOString().slice(0, 7);
    const filename = `SalarySlip-${slip.employee.name.replace(/ /g, '')}-${month}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // — HEADER —
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('Mavens Advisor (PVT) Limited', { align: 'center' })
      .moveDown(0.2)
      .font('Helvetica')
      .fontSize(10)
      .text('Head Office • Karachi, Pakistan', { align: 'center' })
      .moveDown(1.5);

    // — EMPLOYEE DETAILS —
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Employee Details', 40, doc.y)
      .moveDown(0.5);

    const y0 = doc.y;
    doc.font('Helvetica').fontSize(10)
      .text(`Name: ${slip.employee.name}`, 40, y0)
      .text(`Department: ${slip.employee.department}`, 320, y0)
      .text(`Designation: ${slip.employee.designation}`, 40, y0 + 15)
      .text(`Joining Date: ${slip.employee.joiningDate.toISOString().slice(0, 10)}`, 320, y0 + 15)
      .moveDown(2);

    // — SALARY & ALLOWANCES vs DEDUCTIONS —
    const col1X = 40;
    const col2X = 320;
    const startY = doc.y;

    // Table headers
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('Salary & Allowances', col1X, startY)
      .text('Deductions', col2X, startY);

    // Rows
    const rowHeight = 18;
    const rows = Math.max(allowances.length, deductions.length);

    // Totals
    let totalAllow = 0;
    let totalDeduct = 0;

    for (let i = 0; i < rows; i++) {
      const y = startY + 20 + i * rowHeight;
      doc.font('Helvetica').fontSize(10);

      // Allowances column
      if (allowances[i]) {
        const [label, key] = allowances[i];
        const val = slip[key] || 0;
        totalAllow += val;
        doc.text(label, col1X, y);
        doc.text(val.toFixed(2), col1X + 150, y, { width: 60, align: 'right' });
      }

      // Deductions column
      if (deductions[i]) {
        const [label, key] = deductions[i];
        const val = slip[key] || 0;
        totalDeduct += val;
        doc.text(label, col2X, y);
        doc.text(val.toFixed(2), col2X + 150, y, { width: 60, align: 'right' });
      }
    }

    // — NET PAYABLE —
    const net = totalAllow - totalDeduct;
    doc.moveDown(2);
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(`Net Payable: ${net.toFixed(2)}`, { align: 'right' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;