const express           = require('express');
const requireAuth       = require('../middleware/auth');
const EmployeeHierarchy = require('../models/EmployeeHierarchy');

const router = express.Router();

// POST /api/hierarchy/create
router.post(
  '/create',
  requireAuth,
  async (req, res) => {
    const { senior, junior, relation } = req.body;

    if (!senior || !junior || !relation) {
      return res
        .status(400)
        .json({ status: 'error', message: 'senior, junior and relation are required' });
    }

    try {
      // owner comes from requireAuth → req.user
      const hierarchy = new EmployeeHierarchy({
        owner:    req.user._id,
        senior,
        junior,
        relation
      });
      await hierarchy.save();
      res.json({ status: 'success', data: hierarchy });
    } catch (err) {
      console.error('Hierarchy create error:', err);
      res
        .status(500)
        .json({ status: 'error', message: 'Server error' });
    }
  }
);

module.exports = router;
