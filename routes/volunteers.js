const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Submit volunteer application (public)
router.post('/', [
  body('full_name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { full_name, email, phone, skills, availability, motivation } = req.body;

    const result = await pool.query(
      `INSERT INTO volunteers (full_name, email, phone, skills, availability, motivation)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [full_name, email, phone, skills, availability, motivation]
    );

    res.status(201).json({ 
      message: 'Volunteer application submitted successfully',
      volunteer: result.rows[0]
    });
  } catch (error) {
    console.error('Submit volunteer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all volunteers (admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM volunteers';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM volunteers';
    if (status) {
      countQuery += ' WHERE status = $1';
    }
    const countResult = await pool.query(countQuery, status ? [status] : []);

    res.json({
      volunteers: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get volunteer by ID (admin only)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM volunteers WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get volunteer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update volunteer status (admin only)
router.patch('/:id/status', authMiddleware, adminOnly, [
  body('status').isIn(['pending', 'approved', 'rejected', 'active', 'inactive'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;

    const result = await pool.query(
      `UPDATE volunteers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update volunteer status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete volunteer (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM volunteers WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Delete volunteer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
