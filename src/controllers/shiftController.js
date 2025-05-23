// backend/src/controllers/shiftController.js
const Shift = require('../models/Shift');

exports.getShifts = async (req, res) => {
  try {
    const shifts = await Shift.find({ owner: req.user._id }).lean();
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

 exports.createShift = async (req, res) => {
   try {
     // pull exactly the fields your schema requires:
     const { name, timezone, start, end } = req.body;
     const shift = await Shift.create({
       owner:    req.user._id,
       name,
       timezone,
       start,
       end,
     });
     res.status(201).json(shift);
   } catch (err) {
     res.status(400).json({ error: err.message });
   }
 };
exports.updateShift = async (req, res) => {
   try {
     const { id } = req.params;
     const { name, timezone, start, end } = req.body;
     const shift = await Shift.findOneAndUpdate(
       { _id: id, owner: req.user._id },
       { name, timezone, start, end },
       { new: true }
     );
    if (!shift) return res.status(404).json({ error: 'Not found' });
    res.json(shift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Shift.deleteOne({ _id: id, owner: req.user._id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
