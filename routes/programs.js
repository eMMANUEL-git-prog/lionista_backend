const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all programs (public)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM programs';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get programs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single program by slug (public)
router.get('/slug/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM programs WHERE slug = $1',
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get program error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single program by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM programs WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get program error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create program (admin only)
router.post('/', authMiddleware, adminOnly, [
  body('title').notEmpty().trim(),
  body('slug').notEmpty().trim(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, slug, description, content, image_url, status, target_amount, start_date, end_date } = req.body;

    const result = await pool.query(
      `INSERT INTO programs (title, slug, description, content, image_url, status, target_amount, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, slug, description, content, image_url, status || 'active', target_amount, start_date, end_date]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A program with this slug already exists' });
    }
    console.error('Create program error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update program (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, slug, description, content, image_url, status, target_amount, raised_amount, start_date, end_date } = req.body;

    const result = await pool.query(
      `UPDATE programs SET 
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        description = COALESCE($3, description),
        content = COALESCE($4, content),
        image_url = COALESCE($5, image_url),
        status = COALESCE($6, status),
        target_amount = COALESCE($7, target_amount),
        raised_amount = COALESCE($8, raised_amount),
        start_date = COALESCE($9, start_date),
        end_date = COALESCE($10, end_date),
        updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [title, slug, description, content, image_url, status, target_amount, raised_amount, start_date, end_date, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update program error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete program (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM programs WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json({ message: 'Program deleted successfully' });
  } catch (error) {
    console.error('Delete program error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
