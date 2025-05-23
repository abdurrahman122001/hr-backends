// backend/src/routes/employees.js
const express  = require('express');
const router   = express.Router();

const Employee = require('../models/Employees');
const { getAllEmployees, createEmployee } = require('../controllers/employeeController');

router.get('/', async (req, res) => {
  try {
    const list = await Employee.find({ owner: req.user._id }).sort({ name: 1 }).lean();
    res.json({ status: 'success', data: list });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/employees/names
router.get('/names', async (req, res) => {
  try {
    const docs = await Employee
      .find({ owner: req.user._id })
      .sort({ name: 1 })
      .select('_id name')
      .lean();
    res.json({ status: 'success', data: docs });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/employees/create
router.post('/create', async (req, res) => {
  const { name, position, department, email, rt, salaryOffered, leaveEntitlement } = req.body;
  if (!name || !position || !department || !email) {
    return res.status(400).json({ status: 'error', message: 'Missing required fields' });
  }
  try {
    const emp = await Employee.create({
      owner:           req.user._id,
      name,
      position,
      department,
      email,
      rt,
      salaryOffered,
      leaveEntitlement
    });
    res.json({ status: 'success', data: emp });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/', getAllEmployees);
router.post('/', createEmployee);


module.exports = router;
