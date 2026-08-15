const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/*
 GET /api/assessment/:roleId

 Returns:
 - 10 random aptitude questions
 - 10 random technical questions for the selected role

 correct_option is NOT sent to the frontend.
*/
router.get('/:roleId', requireAuth, async (req, res) => {
  try {
    const { roleId } = req.params;

    // Random Aptitude Questions
    const [aptitude] = await pool.query(`
      SELECT
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        difficulty
      FROM questions
      WHERE category = 'aptitude'
      ORDER BY RAND()
      LIMIT 10
    `);

    // Random Technical Questions
    const [technical] = await pool.query(
      `
      SELECT
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        difficulty
      FROM questions
      WHERE category = 'technical'
      AND role_id = ?
      ORDER BY RAND()
      LIMIT 10
      `,
      [roleId]
    );

    res.json({
      aptitude,
      technical
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to fetch assessment questions.'
    });
  }
});

/*
 POST /api/assessment/:roleId/submit

 Body:
 {
    aptitudeAnswers: [
      {
        questionId,
        selectedOption
      }
    ],
    technicalAnswers: [
      {
        questionId,
        selectedOption
      }
    ]
 }
*/
router.post('/:roleId/submit', requireAuth, async (req, res) => {
  try {

    const { roleId } = req.params;
    const {
      aptitudeAnswers = [],
      technicalAnswers = []
    } = req.body;

    const aptitudeScore = await scoreAnswers(aptitudeAnswers);
    const technicalScore = await scoreAnswers(technicalAnswers);

    const [result] = await pool.query(
      `
      INSERT INTO assessment_results
      (
        user_id,
        role_id,
        aptitude_score,
        technical_score
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        req.user.id,
        roleId,
        aptitudeScore,
        technicalScore
      ]
    );

    res.status(201).json({
      assessmentId: result.insertId,
      aptitudeScore,
      technicalScore
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to submit assessment.'
    });
  }
});

/*
 Calculate score
*/
async function scoreAnswers(answers) {

  if (!answers || answers.length === 0) {
    return 0;
  }

  const ids = answers.map(a => a.questionId);

  const placeholders = ids.map(() => '?').join(',');

  const [rows] = await pool.query(
    `
    SELECT
      id,
      correct_option
    FROM questions
    WHERE id IN (${placeholders})
    `,
    ids
  );

  const answerMap = new Map();

  rows.forEach(row => {
    answerMap.set(row.id, row.correct_option);
  });

  let correct = 0;

  answers.forEach(ans => {
    if (answerMap.get(ans.questionId) === ans.selectedOption) {
      correct++;
    }
  });

  return Math.round((correct / answers.length) * 10000) / 100;
}

module.exports = router;