// backend/src/routes/payrollPeriods.js
const router = require('express').Router();
const {
  getPayrollPeriod,
  createPayrollPeriod,
  updatePayrollPeriod,
} = require('../controllers/payrollPeriodController');

router.get('/', getPayrollPeriod);
router.post('/', createPayrollPeriod);
router.put('/', updatePayrollPeriod);

module.exports = router;
