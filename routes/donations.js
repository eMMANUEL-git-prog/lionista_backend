const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Create donation (public)
router.post('/', [
  body('donor_name').notEmpty().trim(),
  body('donor_email').isEmail().normalizeEmail(),
  body('amount').isFloat({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      donor_name, 
      donor_email, 
      donor_phone, 
      amount, 
      currency, 
      payment_method, 
      program_id, 
      is_recurring, 
      is_anonymous, 
      message 
    } = req.body;

    const payment_reference = `DON-${uuidv4().substring(0, 8).toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO donations 
       (donor_name, donor_email, donor_phone, amount, currency, payment_method, payment_reference, program_id, is_recurring, is_anonymous, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [donor_name, donor_email, donor_phone, amount, currency || 'KES', payment_method, payment_reference, program_id, is_recurring || false, is_anonymous || false, message]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create donation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all donations (admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, program_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT d.*, p.title as program_title 
      FROM donations d 
      LEFT JOIN programs p ON d.program_id = p.id
    `;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push(`d.payment_status = $${params.length + 1}`);
      params.push(status);
    }

    if (program_id) {
      conditions.push(`d.program_id = $${params.length + 1}`);
      params.push(program_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM donations d';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      donations: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get donation statistics (admin only)
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const totalResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM donations WHERE payment_status = 'completed'"
    );

    const monthlyResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
       FROM donations 
       WHERE payment_status = 'completed' 
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    const byProgramResult = await pool.query(
      `SELECT p.title, COALESCE(SUM(d.amount), 0) as total
       FROM programs p
       LEFT JOIN donations d ON p.id = d.program_id AND d.payment_status = 'completed'
       GROUP BY p.id, p.title
       ORDER BY total DESC
       LIMIT 5`
    );

    res.json({
      total: {
        amount: parseFloat(totalResult.rows[0].total),
        count: parseInt(totalResult.rows[0].count)
      },
      thisMonth: {
        amount: parseFloat(monthlyResult.rows[0].total),
        count: parseInt(monthlyResult.rows[0].count)
      },
      byProgram: byProgramResult.rows
    });
  } catch (error) {
    console.error('Get donation stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update donation status (admin only)
router.patch('/:id/status', authMiddleware, adminOnly, [
  body('payment_status').isIn(['pending', 'completed', 'failed', 'refunded'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { payment_status } = req.body;

    const result = await pool.query(
      `UPDATE donations SET payment_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [payment_status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    // Update program raised amount if donation is completed
    if (payment_status === 'completed' && result.rows[0].program_id) {
      await pool.query(
        `UPDATE programs SET raised_amount = raised_amount + $1 WHERE id = $2`,
        [result.rows[0].amount, result.rows[0].program_id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update donation status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
