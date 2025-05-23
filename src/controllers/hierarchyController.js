// src/controllers/hierarchyController.js
const Hierarchy = require('../models/EmployeeHierarchy');

exports.create = async (req, res) => {
  try {
    const { seniorId, juniorId, relation } = req.body;
    if (!seniorId || !juniorId || !relation) {
      return res
        .status(400)
        .json({ status: 'error', message: 'seniorId, juniorId & relation required' });
    }
    const link = await Hierarchy.create({
      owner:    req.users._id,
      senior:   seniorId,
      junior:   juniorId,
      relation,
    });
    res.json({ status: 'success', data: link });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};
