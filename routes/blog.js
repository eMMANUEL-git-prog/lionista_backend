const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all published posts (public)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT * FROM blog_posts 
       WHERE status = 'published' 
       ORDER BY published_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM blog_posts WHERE status = 'published'"
    );

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Get blog posts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get post by slug (public)
router.get('/slug/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published'",
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get blog post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all posts (admin only)
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM blog_posts';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM blog_posts';
    if (status) {
      countQuery += ' WHERE status = $1';
    }
    const countResult = await pool.query(countQuery, status ? [status] : []);

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Get all blog posts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get post by ID (admin)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM blog_posts WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get blog post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create post (admin only)
router.post('/', authMiddleware, adminOnly, [
  body('title').notEmpty().trim(),
  body('slug').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, slug, excerpt, content, image_url, author, status } = req.body;

    const result = await pool.query(
      `INSERT INTO blog_posts (title, slug, excerpt, content, image_url, author, status, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, slug, excerpt, content, image_url, author, status || 'draft', status === 'published' ? new Date() : null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A post with this slug already exists' });
    }
    console.error('Create blog post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update post (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, slug, excerpt, content, image_url, author, status } = req.body;

    // Get current post status
    const currentPost = await pool.query('SELECT status FROM blog_posts WHERE id = $1', [req.params.id]);
    
    let published_at = null;
    if (status === 'published' && currentPost.rows[0]?.status !== 'published') {
      published_at = new Date();
    }

    const result = await pool.query(
      `UPDATE blog_posts SET 
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        excerpt = COALESCE($3, excerpt),
        content = COALESCE($4, content),
        image_url = COALESCE($5, image_url),
        author = COALESCE($6, author),
        status = COALESCE($7, status),
        published_at = COALESCE($8, published_at),
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [title, slug, excerpt, content, image_url, author, status, published_at, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update blog post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete post (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM blog_posts WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete blog post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
