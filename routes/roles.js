const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /api/roles - list all target job roles
router.get('/', async (req, res) => {
  try {
    const [roles] = await pool.query('SELECT id, title, description FROM job_roles ORDER BY title');
    res.json({ roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch job roles.' });
  }
});

// GET /api/roles/:id/skills - required skills for a role (with weight)
router.get('/:id/skills', async (req, res) => {
  try {
    const [skills] = await pool.query(
      `SELECT s.id AS skill_id, s.name, rs.weight
       FROM role_skills rs
       JOIN skills s ON s.id = rs.skill_id
       WHERE rs.role_id = ?
       ORDER BY rs.weight DESC`,
      [req.params.id]
    );
    res.json({ skills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch role skills.' });
  }
});

module.exports = router;
