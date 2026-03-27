const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get impact stats (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM impact_stats ORDER BY display_order ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update stat (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { stat_name, stat_value, stat_description, display_order } = req.body;

    const result = await pool.query(
      `UPDATE impact_stats SET 
        stat_name = COALESCE($1, stat_name),
        stat_value = COALESCE($2, stat_value),
        stat_description = COALESCE($3, stat_description),
        display_order = COALESCE($4, display_order),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [stat_name, stat_value, stat_description, display_order, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stat not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update stat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create stat (admin only)
router.post('/', authMiddleware, adminOnly, [
  body('stat_name').notEmpty().trim(),
  body('stat_value').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { stat_name, stat_value, stat_description, display_order } = req.body;

    const result = await pool.query(
      `INSERT INTO impact_stats (stat_name, stat_value, stat_description, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [stat_name, stat_value, stat_description, display_order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create stat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete stat (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM impact_stats WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stat not found' });
    }

    res.json({ message: 'Stat deleted successfully' });
  } catch (error) {
    console.error('Delete stat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get team members (public)
router.get('/team', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM team_members ORDER BY display_order ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reports (public)
router.get('/reports', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reports ORDER BY year DESC, created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get gallery (public)
router.get('/gallery', async (req, res) => {
  try {
    const { program_id } = req.query;
    let query = 'SELECT * FROM gallery';
    const params = [];

    if (program_id) {
      query += ' WHERE program_id = $1';
      params.push(program_id);
    }

    query += ' ORDER BY display_order ASC, created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get gallery error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard overview (admin only)
router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [donations, volunteers, inquiries, programs] = await Promise.all([
      pool.query("SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as amount FROM donations WHERE payment_status = 'completed'"),
      pool.query("SELECT COUNT(*) as total FROM volunteers WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) as total FROM contact_inquiries WHERE status = 'unread'"),
      pool.query("SELECT COUNT(*) as total FROM programs WHERE status = 'active'")
    ]);

    res.json({
      donations: {
        count: parseInt(donations.rows[0].total),
        amount: parseFloat(donations.rows[0].amount)
      },
      pendingVolunteers: parseInt(volunteers.rows[0].total),
      unreadInquiries: parseInt(inquiries.rows[0].total),
      activePrograms: parseInt(programs.rows[0].total)
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
