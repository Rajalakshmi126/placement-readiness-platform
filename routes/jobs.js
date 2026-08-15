const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ----------------------------------------------------
// GET recommended openings
// ----------------------------------------------------

router.get(
  '/recommended/:roleId',
  requireAuth,
  async (req, res) => {

    try {

      const { roleId } =
        req.params;

      const userId =
        req.user.id;

      const limit =
        Math.min(
          parseInt(
            req.query.limit,
            10
          ) || 50,
          50
        );

      // ----------------------------------------------
      // Get latest resume
      // ----------------------------------------------

      const [resumeRows] =
        await pool.query(
          `
          SELECT id
          FROM resumes
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [userId]
        );

      if (resumeRows.length === 0) {

        return res.json({
          resume: null,
          jobs: []
        });
      }

      const resumeId =
        resumeRows[0].id;

      // ----------------------------------------------
      // Resume skills
      // ----------------------------------------------

      const [resumeSkills] =
        await pool.query(
          `
          SELECT
            s.name,
            rs.confidence
          FROM resume_skills rs
          JOIN skills s
            ON s.id = rs.skill_id
          WHERE rs.resume_id = ?
          `,
          [resumeId]
        );

      const userSkills =
        resumeSkills.map(
          skill =>
            skill.name.toLowerCase()
        );

      // ----------------------------------------------
      // Get verified jobs
      // ----------------------------------------------

      const [jobs] =
        await pool.query(
          `
          SELECT
            jo.id,
            jo.company_id,
            c.name AS companyName,
            c.official_domain,

            jo.role_id,

            jo.job_title AS jobTitle,
            jo.location,
            jo.job_type AS jobType,
            jo.experience,

            jo.required_skills AS requiredSkills,

            jo.job_url AS jobUrl,

            jo.posted_at AS postedAt,

            jo.verification_status
              AS verificationStatus,

            jo.verified_at AS verifiedAt,

            jo.last_checked_at
              AS lastCheckedAt

          FROM job_openings jo

          JOIN companies c
            ON c.id = jo.company_id

          WHERE jo.role_id = ?
            AND jo.is_active = 1
            AND jo.verification_status = 'verified'

          ORDER BY jo.posted_at DESC

          LIMIT ?
          `,
          [
            roleId,
            limit
          ]
        );

      // ----------------------------------------------
      // Match skills
      // ----------------------------------------------

      const recommendations =
        jobs.map(job => {

          const required =
            String(
              job.requiredSkills || ''
            )
              .split(',')
              .map(
                skill =>
                  skill.trim()
              )
              .filter(Boolean);

          const matchedSkills =
            required.filter(
              skill =>
                userSkills.includes(
                  skill.toLowerCase()
                )
            );

          const missingSkills =
            required.filter(
              skill =>
                !userSkills.includes(
                  skill.toLowerCase()
                )
            );

          const matchScore =
            required.length
              ? Math.round(
                  (
                    matchedSkills.length /
                    required.length
                  ) * 100
                )
              : 0;

          return {
            ...job,

            matchedSkills,

            missingSkills,

            matchScore
          };
        });

      // ----------------------------------------------
      // Sort best match first
      // ----------------------------------------------

      recommendations.sort(
        (a, b) =>
          b.matchScore -
          a.matchScore
      );

      res.json({

        resume: {
          id: resumeId,
          skills: resumeSkills
        },

        jobs:
          recommendations

      });

    } catch (error) {

      console.error(
        'Recommended jobs error:',
        error
      );

      res.status(500).json({
        error:
          'Failed to fetch recommended jobs.'
      });
    }
  }
);

module.exports = router;