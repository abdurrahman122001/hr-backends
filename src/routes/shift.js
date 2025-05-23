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

module.exports = router;
