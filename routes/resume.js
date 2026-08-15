const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { analyzeResume } = require('../services/resumeParser');

const router = express.Router();

// --------------------------
// Upload Configuration
// --------------------------

const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),

  filename: (req, file, cb) => {
    const uniqueName =
      `user_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
const allowed = [
    ".pdf",
    ".txt",
    ".doc",
    ".docx"
];

if (allowed.includes(ext)) {

    cb(null, true);

} else {

    cb(
        new Error(
            "Only PDF, DOC, DOCX and TXT files are allowed."
        )
    );

}
  }
    
});

// ----------------------------------------------------
// POST /api/resume/upload
// ----------------------------------------------------

router.post(
  '/upload',
  requireAuth,
  upload.single('resume'),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: 'No resume uploaded.'
        });
      }
      console.log("\n========== FILE INFO ==========");
      console.log(req.file);
      console.log("File Path:", req.file.path);
      console.log("Original Name:", req.file.originalname);
      console.log("Saved Name:", req.file.filename);
      console.log("===============================\n");

      // --------------------------------------
      // Delete Previous Resume
      // --------------------------------------

      const [oldResume] = await pool.query(
        `SELECT id,file_path
         FROM resumes
         WHERE user_id=?
         ORDER BY id DESC
         LIMIT 1`,
        [req.user.id]
      );

      if (oldResume.length > 0) {

        try {

          if (fs.existsSync(oldResume[0].file_path)) {
            fs.unlinkSync(oldResume[0].file_path);
          }

        } catch (err) {

          console.log(
            "Unable to delete old PDF:",
            err.message
          );

        }

        await pool.query(
          `DELETE FROM resume_skills
           WHERE resume_id=?`,
          [oldResume[0].id]
        );

        await pool.query(
          `DELETE FROM resumes
           WHERE id=?`,
          [oldResume[0].id]
        );

        console.log("Old resume removed.");
      }

      console.log("\n========== RESUME UPLOAD ==========");

      const analysis = await analyzeResume(req.file.path);

      console.log("Analysis Result:");
      console.log(JSON.stringify(analysis, null, 2));

      console.log("Detected Skills:");
      console.log(analysis.skills);
      console.log("Saving resume to database...");
      console.log({
      user_id: req.user.id,
      file_path: req.file.path,
      raw_text_length: analysis.rawText.length,
      projects_count: analysis.projects_count,
      certifications_count: analysis.certifications_count
});

      const [resumeResult] = await pool.query(
        `INSERT INTO resumes
        (user_id,file_path,raw_text,projects_count,certifications_count)
        VALUES(?,?,?,?,?)`,
        [
          req.user.id,
          req.file.path,
          analysis.rawText,
          analysis.projects_count,
          analysis.certifications_count
        ]
      );

      const resumeId = resumeResult.insertId;

      console.log("Resume ID:", resumeId);

      // --------------------------------------
      // Save Skills
      // --------------------------------------

      if (analysis.skills.length > 0) {

        const detectedNames = analysis.skills.map(
          s => s.name
        );

        const placeholders = detectedNames
          .map(() => '?')
          .join(',');

        const [skillRows] = await pool.query(
          `SELECT id,name
           FROM skills
           WHERE name IN (${placeholders})`,
          detectedNames
        );

        for (const row of skillRows) {

          const match = analysis.skills.find(
            s => s.name === row.name
          );

          await pool.query(
            `INSERT INTO resume_skills
            (resume_id,skill_id,confidence)
            VALUES(?,?,?)`,
            [
              resumeId,
              row.id,
              match.confidence
            ]
          );
        }

      }

      console.log("========== DONE ==========\n");

      res.status(201).json({

        success: true,

        resumeId,

        detectedSkills: analysis.skills,

        projectsCount: analysis.projects_count,

        certificationsCount: analysis.certifications_count,

        wordCount: analysis.word_count

      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message
      });

    }

  }
);

// ----------------------------------------------------
// GET Latest Resume
// ----------------------------------------------------

router.get(
  '/latest',
  requireAuth,
  async (req, res) => {

    try {

      const [resumeRows] = await pool.query(
        `SELECT *
         FROM resumes
         WHERE user_id=?
         ORDER BY id DESC
         LIMIT 1`,
        [req.user.id]
      );

      if (resumeRows.length === 0) {

        return res.status(404).json({
          error: "Resume not found."
        });

      }

      const resume = resumeRows[0];

      const [skills] = await pool.query(
        `SELECT
          skills.id,
          skills.name,
          resume_skills.confidence
         FROM resume_skills
         JOIN skills
         ON skills.id=resume_skills.skill_id
         WHERE resume_skills.resume_id=?`,
        [resume.id]
      );

      resume.skills = skills;

      res.json(resume);

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message
      });

    }

  }
);

module.exports = router;
