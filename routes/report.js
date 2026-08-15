const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const {
  predictSkillGap,
  scoreProjectsAndCertifications,
  calculateReadinessScore,
  buildRecommendations,
} = require('../services/readinessEngine');

const router = express.Router();

// POST /api/report/generate
// body: { roleId, resumeId, assessmentId }
// Pulls everything together: resume skills vs role skills (gap prediction),
// projects/certs, aptitude + technical scores -> final Placement Readiness Score.
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { roleId, resumeId, assessmentId } = req.body;
    if (!roleId || !resumeId || !assessmentId) {
      return res.status(400).json({ error: 'roleId, resumeId and assessmentId are required.' });
    }

    // 1. Required skills for the target role
    const [requiredSkills] = await pool.query(
      `SELECT s.id AS skill_id, s.name, rs.weight
       FROM role_skills rs JOIN skills s ON s.id = rs.skill_id
       WHERE rs.role_id = ?`,
      [roleId]
    );

    // 2. Skills detected on the student's resume
    const [resumeSkills] = await pool.query(
      `SELECT s.id AS skill_id, s.name, rsk.confidence
       FROM resume_skills rsk JOIN skills s ON s.id = rsk.skill_id
       WHERE rsk.resume_id = ?`,
      [resumeId]
    );

    // 3. Resume projects/certifications counts
    const [[resumeRow]] = await pool.query(
      'SELECT projects_count, certifications_count FROM resumes WHERE id=?',
      [resumeId]
    );
    if (!resumeRow) return res.status(404).json({ error: 'Resume not found.' });

    // 4. Assessment scores
    const [[assessmentRow]] = await pool.query(
      'SELECT aptitude_score, technical_score FROM assessment_results WHERE id=?',
      [assessmentId]
    );
    if (!assessmentRow) return res.status(404).json({ error: 'Assessment result not found.' });

    // --- Dynamic Skill Gap Prediction ---
    const { matched, missing, resumeMatchScore } = predictSkillGap(requiredSkills, resumeSkills);

    // --- Projects/Certifications strength ---
    const projectsCertScore = scoreProjectsAndCertifications(
      resumeRow.projects_count,
      resumeRow.certifications_count
    );

    // --- Final Placement Readiness Score ---
    const { readinessScore, breakdown, band } = calculateReadinessScore({
      resumeMatchScore,
      technicalScore: Number(assessmentRow.technical_score),
      aptitudeScore: Number(assessmentRow.aptitude_score),
      projectsCertScore,
    });

    // --- Personalized recommendations for missing skills ---
    const skillIds = missing.map((m) => m.skill_id);
    let catalogueBySkillId = {};
    if (skillIds.length > 0) {
      const placeholders = skillIds.map(() => '?').join(',');
      const [recRows] = await pool.query(
        `SELECT skill_id, type, title, resource_url FROM recommendations WHERE skill_id IN (${placeholders})`,
        skillIds
      );
      catalogueBySkillId = recRows.reduce((acc, r) => {
        (acc[r.skill_id] = acc[r.skill_id] || []).push({
          type: r.type,
          title: r.title,
          resource_url: r.resource_url,
        });
        return acc;
      }, {});
    }
    const recommendations = buildRecommendations(missing, catalogueBySkillId);

    // --- Persist the report ---
    const [insertResult] = await pool.query(
      `INSERT INTO readiness_reports
        (user_id, role_id, resume_id, assessment_id, resume_match_score, aptitude_score,
         technical_score, project_cert_score, readiness_score, matched_skills, missing_skills)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        roleId,
        resumeId,
        assessmentId,
        resumeMatchScore,
        assessmentRow.aptitude_score,
        assessmentRow.technical_score,
        projectsCertScore,
        readinessScore,
        JSON.stringify(matched),
        JSON.stringify(missing),
      ]
    );

    res.status(201).json({
      reportId: insertResult.insertId,
      readinessScore,
      band,
      breakdown,
      matchedSkills: matched,
      missingSkills: missing,
      recommendations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate readiness report.' });
  }
});

// GET /api/report/history - all past reports for the logged-in student
router.get('/history', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rr.id, jr.title AS role_title, rr.readiness_score, rr.generated_at
       FROM readiness_reports rr JOIN job_roles jr ON jr.id = rr.role_id
       WHERE rr.user_id = ? ORDER BY rr.generated_at DESC`,
      [req.user.id]
    );
    res.json({ reports: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch report history.' });
  }
});

module.exports = router;
