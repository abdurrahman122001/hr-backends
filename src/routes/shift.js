const router      = require('express').Router();
const {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
} = require('../controllers/shiftController');

router.get('/',       getShifts);
router.post('/',      createShift);
router.put('/:id',    updateShift);
router.delete('/:id', deleteShift);

router.put('/:id/payroll-period', async (req, res) => {
  try {
    const { payrollPeriod } = req.body; // expecting payrollPeriod: "<ObjectId>"
    const updated = await require('../models/Shift').findByIdAndUpdate(
      req.params.id,
      { payrollPeriod },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Shift not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
module.exports = router;
