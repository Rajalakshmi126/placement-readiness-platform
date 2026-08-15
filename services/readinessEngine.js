/**
 * readinessEngine.js
 * -------------------
 * The scoring brain of the platform. Pure functions, no DB access,
 * so they're easy to unit test.
 *
 * Dynamic Skill Gap Prediction:
 *   Compares the skills detected in a student's resume against the
 *   weighted skill requirements of their target job role, producing
 *   matched skills, missing skills, and a resume-match percentage
 *   that accounts for how *important* each missing skill is
 *   (a missing high-weight skill hurts more than a missing low-weight one).
 *
 * Placement Readiness Score:
 *   A weighted composite of four signals:
 *     - Resume skill match   (40%)
 *     - Technical test score (25%)
 *     - Aptitude test score  (20%)
 *     - Projects/Certifications strength (15%)
 */

const WEIGHTS = {
  resumeMatch: 0.40,
  technical: 0.25,
  aptitude: 0.20,
  projectsCerts: 0.15,
};

/**
 * @param {Array<{skill_id:number, name:string, weight:number}>} requiredSkills
 *        Skills required for the target role, each with an importance weight (1-5).
 * @param {Array<{skill_id:number, name:string, confidence:number}>} resumeSkills
 *        Skills detected in the student's resume.
 * @returns {{matched: Array, missing: Array, resumeMatchScore: number}}
 */
function predictSkillGap(requiredSkills, resumeSkills) {
  const resumeSkillIds = new Set(resumeSkills.map((s) => s.skill_id));

  const matched = [];
  const missing = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const req of requiredSkills) {
    totalWeight += req.weight;
    if (resumeSkillIds.has(req.skill_id)) {
      earnedWeight += req.weight;
      matched.push({ skill_id: req.skill_id, name: req.name, weight: req.weight });
    } else {
      missing.push({ skill_id: req.skill_id, name: req.name, weight: req.weight });
    }
  }

  // Sort missing skills so the highest-impact gaps surface first.
  missing.sort((a, b) => b.weight - a.weight);

  const resumeMatchScore = totalWeight === 0 ? 0 : round2((earnedWeight / totalWeight) * 100);

  return { matched, missing, resumeMatchScore };
}

/**
 * Converts raw projects/certifications counts into a 0-100 strength score.
 * Diminishing returns after a healthy baseline (3 projects, 2 certs) so
 * the score rewards *some* proof of applied learning without requiring
 * an unrealistic volume.
 */
function scoreProjectsAndCertifications(projectsCount, certificationsCount) {
  const projectScore = Math.min(projectsCount / 3, 1) * 70;   // projects worth up to 70
  const certScore = Math.min(certificationsCount / 2, 1) * 30; // certs worth up to 30
  return round2(projectScore + certScore);
}

/**
 * Combines all four signals into the final Placement Readiness Score.
 * @returns {{readinessScore:number, breakdown:object, band:string}}
 */
function calculateReadinessScore({ resumeMatchScore, technicalScore, aptitudeScore, projectsCertScore }) {
  const readinessScore = round2(
    resumeMatchScore * WEIGHTS.resumeMatch +
    technicalScore * WEIGHTS.technical +
    aptitudeScore * WEIGHTS.aptitude +
    projectsCertScore * WEIGHTS.projectsCerts
  );

  return {
    readinessScore,
    breakdown: {
      resumeMatchScore,
      technicalScore,
      aptitudeScore,
      projectsCertScore,
      weights: WEIGHTS,
    },
    band: readinessBand(readinessScore),
  };
}

function readinessBand(score) {
  if (score >= 85) return 'Placement Ready';
  if (score >= 65) return 'Almost Ready';
  if (score >= 40) return 'Needs Improvement';
  return 'Getting Started';
}

/**
 * Builds a personalized recommendation list, prioritized by missing
 * skill weight, from a recommendation catalogue keyed by skill_id.
 * @param {Array} missingSkills  from predictSkillGap()
 * @param {Object} catalogueBySkillId  { [skill_id]: [ {type,title,resource_url}, ... ] }
 * @param {number} limit
 */
function buildRecommendations(missingSkills, catalogueBySkillId, limit = 8) {
  const recs = [];
  for (const skill of missingSkills) {
    const entries = catalogueBySkillId[skill.skill_id] || [];
    for (const entry of entries) {
      recs.push({ skill: skill.name, priority: skill.weight, ...entry });
    }
    if (entries.length === 0) {
      // Fallback generic recommendation so every gap gets *something* actionable.
      recs.push({
        skill: skill.name,
        priority: skill.weight,
        type: 'practice_topic',
        title: `Learn the fundamentals of ${skill.name} and build one small project with it`,
        resource_url: null,
      });
    }
    if (recs.length >= limit) break;
  }
  return recs.slice(0, limit);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  predictSkillGap,
  scoreProjectsAndCertifications,
  calculateReadinessScore,
  buildRecommendations,
  readinessBand,
  WEIGHTS,
};
