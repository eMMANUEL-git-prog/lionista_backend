const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Submit contact inquiry (public)
router.post('/', [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('message').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, subject, message } = req.body;

    const result = await pool.query(
      `INSERT INTO contact_inquiries (name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email, phone, subject, message]
    );

    res.status(201).json({ 
      message: 'Your inquiry has been submitted. We will get back to you soon.',
      inquiry: result.rows[0]
    });
  } catch (error) {
    console.error('Submit contact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all inquiries (admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM contact_inquiries';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM contact_inquiries';
    if (status) {
      countQuery += ' WHERE status = $1';
    }
    const countResult = await pool.query(countQuery, status ? [status] : []);

    res.json({
      inquiries: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Get inquiries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update inquiry status (admin only)
router.patch('/:id/status', authMiddleware, adminOnly, [
  body('status').isIn(['unread', 'read', 'replied', 'archived'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;

    const result = await pool.query(
      `UPDATE contact_inquiries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update inquiry status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete inquiry (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM contact_inquiries WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({ message: 'Inquiry deleted successfully' });
  } catch (error) {
    console.error('Delete inquiry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
