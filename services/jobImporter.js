const axios = require('axios');
const pool = require('../config/db');
const JOB_SOURCES = require('./jobSources');

// ----------------------------------------------------
// Skill dictionary
// ----------------------------------------------------

const SKILLS = [
  'Python',
  'Java',
  'HTML',
  'CSS',
  'JavaScript',
  'SQL',
  'MySQL',
  'React',
  'Node.js',
  'Express.js',
  'MongoDB',
  'Git',
  'Docker',
  'Excel',
  'Pandas',
  'NumPy',
  'OOP',
  'DSA',
  'Spring Boot',
  'REST API',
  'Responsive Design',
  'System Design',
  'Data Visualization'
];

// ----------------------------------------------------
// Fetch Greenhouse jobs
// ----------------------------------------------------

async function fetchGreenhouseJobs(token) {

  const url =
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;

  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PlacementReadinessPlatform/1.0'
    }
  });

  return (response.data.jobs || []).map(job => {

    const description =
      stripHtml(job.content || '');

    return {
      externalId: String(job.id),

      title: job.title || '',

      location:
        job.location?.name ||
        'Not specified',

      description,

      url:
        job.absolute_url || '',

      postedAt:
        job.updated_at
          ? new Date(job.updated_at)
          : new Date()
    };
  });
}

// ----------------------------------------------------
// Fetch Lever jobs
// ----------------------------------------------------

async function fetchLeverJobs(token) {

  const url =
    `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;

  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PlacementReadinessPlatform/1.0'
    }
  });

  return (response.data || []).map(job => {

    const description = [
      job.descriptionPlain,
      job.additionalPlain
    ]
      .filter(Boolean)
      .join('\n');

    return {
      externalId:
        String(job.id),

      title:
        job.text || '',

      location:
        job.categories?.location ||
        'Not specified',

      description,

      url:
        job.hostedUrl ||
        job.applyUrl ||
        '',

      postedAt:
        job.createdAt
          ? new Date(job.createdAt)
          : new Date()
    };
  });
}

// ----------------------------------------------------
// Extract skills
// ----------------------------------------------------

function extractSkills(text) {

  const lower =
    String(text || '').toLowerCase();

  const found = [];

  for (const skill of SKILLS) {

    const skillLower =
      skill.toLowerCase();

    if (lower.includes(skillLower)) {
      found.push(skill);
    }
  }

  return found;
}

// ----------------------------------------------------
// Match job to your roles
// ----------------------------------------------------

async function findRole(jobTitle, description) {

  const [roles] = await pool.query(
    `
    SELECT id, title, description
    FROM job_roles
    WHERE id > 0
    ORDER BY id
    `
  );

  const text = `${jobTitle} ${description}`.toLowerCase();

  /*
   * Role aliases.
   *
   * These allow real-world job titles such as:
   *
   * SDE
   * Software Development Engineer
   * Backend Engineer
   * Frontend Engineer
   * Data Engineer
   *
   * to match your existing database roles.
   */

  const ROLE_ALIASES = {

    'software engineer': [
      'software engineer',
      'software developer',
      'software development engineer',
      'sde',
      'backend engineer',
      'backend developer',
      'frontend engineer',
      'frontend developer',
      'application developer',
      'application engineer',
      'associate software engineer',
      'system engineer',
      'devops engineer'
    ],

    'java developer': [
      'java developer',
      'java engineer',
      'java software engineer',
      'java',
      'spring boot',
      'spring developer'
    ],

    'python developer': [
      'python developer',
      'python engineer',
      'python software engineer',
      'python'
    ],

    'full stack developer': [
      'full stack developer',
      'full-stack developer',
      'full stack engineer',
      'full-stack engineer',
      'fullstack developer',
      'fullstack engineer'
    ],

    'data analyst': [
      'data analyst',
      'business analyst',
      'business data analyst',
      'reporting analyst',
      'analytics analyst'
    ],

    'data scientist': [
      'data scientist',
      'data science',
      'machine learning engineer',
      'ml engineer',
      'machine learning scientist',
      'ai engineer',
      'artificial intelligence engineer'
    ]
  };

  let bestRole = null;
  let bestScore = 0;

  for (const role of roles) {

    const roleTitle =
      String(role.title || '').toLowerCase().trim();

    let score = 0;

    /*
     * Exact role title match
     */
    if (text.includes(roleTitle)) {
      score += 10;
    }

    /*
     * Alias matching
     */
    const aliases =
      ROLE_ALIASES[roleTitle] || [];

    for (const alias of aliases) {

      if (text.includes(alias)) {
        score += 8;
      }
    }

    /*
     * Match important words from role title.
     *
     * Example:
     * "Software Engineer"
     *
     * matches:
     * "Senior Software Development Engineer"
     */

    const roleWords =
      roleTitle
        .split(/\s+/)
        .filter(word => word.length >= 3);

    for (const word of roleWords) {

      if (text.includes(word)) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }

  /*
   * Require a meaningful match.
   *
   * This prevents unrelated jobs such as:
   * Legal
   * Finance
   * Security
   * HR
   * Marketing
   * Operations
   *
   * from entering job_openings.
   */

  if (bestScore < 4) {
    return null;
  }

  return bestRole;
}
// ----------------------------------------------------
// Detect experience
// ----------------------------------------------------

function detectExperience(text) {

  const lower =
    String(text || '').toLowerCase();

  if (
    lower.includes('fresher') ||
    lower.includes('entry level') ||
    lower.includes('entry-level') ||
    lower.includes('0-1 year') ||
    lower.includes('0 to 1 year') ||
    lower.includes('graduate') ||
    lower.includes('new graduate')
  ) {
    return 'Fresher';
  }

  return 'Not specified';
}
// ----------------------------------------------------
// Detect job type
// ----------------------------------------------------

function detectJobType(text) {

  const lower =
    String(text || '').toLowerCase();

  if (
    lower.includes('part-time') ||
    lower.includes('part time')
  ) {
    return 'Part-time';
  }

  if (lower.includes('internship')) {
    return 'Internship';
  }

  if (lower.includes('contract')) {
    return 'Contract';
  }

  return 'Full-time';
}

// ----------------------------------------------------
// Verify URL
// ----------------------------------------------------

async function verifyJobUrl(url, company) {

  if (!url) {
    return {
      verified: false,
      message: 'Missing job URL'
    };
  }

  try {

    const response =
      await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: status =>
          status >= 200 &&
          status < 400,
        headers: {
          'User-Agent':
            'PlacementReadinessPlatform/1.0'
        }
      });

    const finalUrl =
      response.request?.res?.responseUrl ||
      url;

    const domain =
      String(company.official_domain || '')
        .toLowerCase()
        .replace(/^www\./, '')
        .replace(/\/.*$/, '');

    const finalHost =
      new URL(finalUrl)
        .hostname
        .toLowerCase()
        .replace(/^www\./, '');

    /*
     * Direct company domain OR a known ATS host.
     *
     * ATS URLs are allowed because many companies
     * publish their official careers through ATS
     * hosted pages.
     */

    const allowedHosts = [
      domain,
      'boards.greenhouse.io',
      'job-boards.greenhouse.io',
      'api.lever.co',
      'jobs.lever.co',
      'apply.workable.com',
      'jobs.ashbyhq.com'
    ].filter(Boolean);

    const verified =
      allowedHosts.some(host =>
        finalHost === host ||
        finalHost.endsWith(`.${host}`)
      );

    return {
      verified,
      message:
        verified
          ? 'Official/approved career source'
          : `URL host ${finalHost} does not match approved source`,
      finalUrl
    };

  } catch (error) {

    return {
      verified: false,
      message:
        `URL check failed: ${error.message}`
    };
  }
}

// ----------------------------------------------------
// Save job
// ----------------------------------------------------

async function saveJob(company, job) {

  const role =
    await findRole(
      job.title,
      job.description
    );

  /*
   * If we cannot confidently match the job
   * to one of your roles, don't insert it.
   */

  if (!role) {

    console.log(
      `Skipping ${job.title} - no matching role`
    );

    return {
      inserted: false,
      reason: 'No matching role'
    };
  }

  const skills =
    extractSkills(
      `${job.title} ${job.description}`
    );

  const requiredSkills =
    skills.join(', ');

  const experience =
    detectExperience(
      `${job.title} ${job.description}`
    );

  const jobType =
    detectJobType(
      `${job.title} ${job.description}`
    );

  const verification =
    await verifyJobUrl(
      job.url,
      company
    );

  const verificationStatus =
    verification.verified
      ? 'verified'
      : 'failed';

  const isActive =
    verification.verified
      ? 1
      : 0;

  const finalUrl =
    verification.finalUrl ||
    job.url;

  // -----------------------------------------------
  // Check existing job
  // -----------------------------------------------

  const [existing] =
    await pool.query(
      `
      SELECT id
      FROM job_openings
      WHERE company_id = ?
        AND job_url = ?
      LIMIT 1
      `,
      [
        company.id,
        finalUrl
      ]
    );

  if (existing.length > 0) {

    await pool.query(
      `
      UPDATE job_openings
      SET
        role_id = ?,
        job_title = ?,
        location = ?,
        job_type = ?,
        experience = ?,
        required_skills = ?,
        is_active = ?,
        verification_status = ?,
        verified_at = ?,
        last_checked_at = NOW(),
        verification_message = ?
      WHERE id = ?
      `,
      [
        role.id,
        job.title,
        job.location,
        jobType,
        experience,
        requiredSkills,
        isActive,
        verificationStatus,
        verification.verified
          ? new Date()
          : null,
        verification.message,
        existing[0].id
      ]
    );

    return {
      inserted: false,
      updated: true,
      id: existing[0].id,
      title: job.title
    };
  }

  // -----------------------------------------------
  // Insert new job
  // -----------------------------------------------

  const [result] =
    await pool.query(
      `
      INSERT INTO job_openings
      (
        company_id,
        role_id,
        job_title,
        location,
        job_type,
        experience,
        required_skills,
        job_url,
        is_active,
        posted_at,
        verification_status,
        verified_at,
        last_checked_at,
        verification_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `,
      [
        company.id,
        role.id,
        job.title,
        job.location,
        jobType,
        experience,
        requiredSkills,
        finalUrl,
        isActive,
        job.postedAt,
        verificationStatus,
        verification.verified
          ? new Date()
          : null,
        verification.message
      ]
    );

  return {
    inserted: true,
    updated: false,
    id: result.insertId,
    title: job.title
  };
}

// ----------------------------------------------------
// Sync one company
// ----------------------------------------------------

async function syncCompany(company) {

  const source =
    JOB_SOURCES[company.name];

  if (!source) {

    console.log(
      `SKIP ${company.name}: no configured public job source`
    );

    return {
      company: company.name,
      skipped: true,
      reason: 'No configured job source'
    };
  }

  let jobs = [];

  try {

    if (source.type === 'greenhouse') {

      jobs =
        await fetchGreenhouseJobs(
          source.token
        );

    } else if (source.type === 'lever') {

      jobs =
        await fetchLeverJobs(
          source.token
        );

    } else {

      throw new Error(
        `Unsupported source type: ${source.type}`
      );
    }

  } catch (error) {

    console.error(
      `${company.name} fetch failed:`,
      error.message
    );

    return {
      company: company.name,
      error: error.message
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const job of jobs) {

    try {

      const result =
        await saveJob(
          company,
          job
        );

      if (result.inserted) {
        inserted++;
      }

      if (result.updated) {
        updated++;
      }

      if (
        !result.inserted &&
        !result.updated
      ) {
        skipped++;
      }

    } catch (error) {

      console.error(
        `Failed ${company.name} / ${job.title}:`,
        error.message
      );

      skipped++;
    }
  }

  return {
    company: company.name,
    total: jobs.length,
    inserted,
    updated,
    skipped
  };
}

// ----------------------------------------------------
// Sync all companies
// ----------------------------------------------------

async function syncAllCompanies() {

  const [companies] =
    await pool.query(
      `
      SELECT
        id,
        name,
        website,
        location,
        official_domain
      FROM companies
      WHERE id > 0
      ORDER BY id
      `
    );

  console.log(
    `Found ${companies.length} companies`
  );

  const results = [];

  for (const company of companies) {

    console.log(
      `\n========== ${company.name} ==========`
    );

    const result =
      await syncCompany(company);

    results.push(result);
  }

  return results;
}

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

function stripHtml(html) {

  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  syncAllCompanies,
  syncCompany
};