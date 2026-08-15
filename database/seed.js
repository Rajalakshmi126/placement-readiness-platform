/**
 * Seeds the database with job roles, a master skill list, weighted
 * role<->skill requirements, sample aptitude/technical questions and
 * a recommendation catalogue. Run once after creating the schema:
 *
 *   node database/seed.js
 */
require('dotenv').config();
const pool = require('../config/db');

const ROLES = [
  { title: 'Frontend Developer', description: 'Builds user-facing web interfaces.' },
  { title: 'Backend Developer', description: 'Builds server-side APIs and business logic.' },
  { title: 'Full Stack Developer', description: 'Works across frontend and backend.' },
  { title: 'Data Analyst', description: 'Analyzes data to drive business decisions.' },
  { title: 'Java Developer', description: 'Builds enterprise applications using Java.' },
];

const SKILLS = [
  'HTML', 'CSS', 'JavaScript', 'React', 'TypeScript', 'Responsive Design',
  'Node.js', 'Express.js', 'REST API', 'MongoDB', 'MySQL', 'System Design',
  'Python', 'Pandas', 'NumPy', 'SQL', 'Data Visualization', 'Excel',
  'Java', 'Spring Boot', 'OOP', 'DSA', 'Git', 'Docker'
];

// role title -> [ [skillName, weight 1-5], ... ]
const ROLE_SKILLS = {
  'Frontend Developer': [
    ['HTML', 5], ['CSS', 5], ['JavaScript', 5], ['React', 4],
    ['TypeScript', 3], ['Responsive Design', 4], ['Git', 3], ['REST API', 2],
  ],
  'Backend Developer': [
    ['Node.js', 5], ['Express.js', 5], ['REST API', 5], ['MySQL', 4],
    ['MongoDB', 3], ['System Design', 3], ['Git', 3], ['DSA', 3],
  ],
  'Full Stack Developer': [
    ['HTML', 4], ['CSS', 4], ['JavaScript', 5], ['React', 4], ['Node.js', 4],
    ['Express.js', 4], ['MySQL', 3], ['REST API', 4], ['Git', 3],
  ],
  'Data Analyst': [
    ['Python', 5], ['Pandas', 5], ['NumPy', 3], ['SQL', 5],
    ['Data Visualization', 4], ['Excel', 4],
  ],
  'Java Developer': [
    ['Java', 5], ['Spring Boot', 5], ['OOP', 4], ['DSA', 4],
    ['MySQL', 3], ['System Design', 3], ['Git', 2],
  ],
};

// A handful of generic aptitude questions (role_id = NULL) and
// role-specific technical questions to seed the assessment bank.
const APTITUDE_QUESTIONS = [
  {
    question_text: 'A train 120m long crosses a pole in 12 seconds. What is its speed?',
    option_a: '10 m/s', option_b: '12 m/s', option_c: '36 m/s', option_d: '20 m/s',
    correct_option: 'A', difficulty: 'easy',
  },
  {
    question_text: 'Find the next number in the series: 2, 6, 12, 20, 30, ?',
    option_a: '38', option_b: '40', option_c: '42', option_d: '44',
    correct_option: 'C', difficulty: 'medium',
  },
  {
    question_text: 'If CODING is written as DPEJOH, how is FLOWER written?',
    option_a: 'GMPXFS', option_b: 'GMPXES', option_c: 'GMQXFS', option_d: 'HNQYGT',
    correct_option: 'A', difficulty: 'medium',
  },
  {
    question_text: 'A can complete a work in 10 days, B in 15 days. Working together, how many days?',
    option_a: '5', option_b: '6', option_c: '8', option_d: '12',
    correct_option: 'B', difficulty: 'medium',
  },
  {
    question_text: 'Choose the odd one out.',
    option_a: 'Triangle', option_b: 'Square', option_c: 'Circle', option_d: 'Cube',
    correct_option: 'D', difficulty: 'easy',
  },
];

const TECHNICAL_QUESTIONS = {
  'Frontend Developer': [
    {
      question_text: 'Which CSS property controls the stacking order of elements?',
      option_a: 'z-index', option_b: 'order', option_c: 'position', option_d: 'flex',
      correct_option: 'A', difficulty: 'easy',
    },
    {
      question_text: 'In React, what hook is used to manage local component state?',
      option_a: 'useEffect', option_b: 'useState', option_c: 'useRef', option_d: 'useMemo',
      correct_option: 'B', difficulty: 'easy',
    },
    {
      question_text: 'What does the "box-sizing: border-box" property do?',
      option_a: 'Removes borders', option_b: 'Includes padding & border in element width/height',
      option_c: 'Adds a shadow box', option_d: 'Disables box model',
      correct_option: 'B', difficulty: 'medium',
    },
  ],
  'Backend Developer': [
    {
      question_text: 'Which HTTP method is idempotent and used to update a full resource?',
      option_a: 'POST', option_b: 'PUT', option_c: 'PATCH', option_d: 'CONNECT',
      correct_option: 'B', difficulty: 'medium',
    },
    {
      question_text: 'In Express.js, what does "next()" do inside middleware?',
      option_a: 'Ends the response', option_b: 'Passes control to the next middleware',
      option_c: 'Restarts the server', option_d: 'Skips routing',
      correct_option: 'B', difficulty: 'easy',
    },
    {
      question_text: 'Which SQL clause is used to filter grouped results?',
      option_a: 'WHERE', option_b: 'GROUP BY', option_c: 'HAVING', option_d: 'ORDER BY',
      correct_option: 'C', difficulty: 'medium',
    },
  ],
  'Full Stack Developer': [
    {
      question_text: 'What does REST stand for?',
      option_a: 'Remote State Transfer', option_b: 'Representational State Transfer',
      option_c: 'Relational State Transfer', option_d: 'Reactive State Transfer',
      correct_option: 'B', difficulty: 'easy',
    },
    {
      question_text: 'Which of these is used for client-side routing in React apps?',
      option_a: 'Express Router', option_b: 'React Router', option_c: 'MySQL Router', option_d: 'Node Router',
      correct_option: 'B', difficulty: 'easy',
    },
  ],
  'Data Analyst': [
    {
      question_text: 'Which Pandas function is used to handle missing values by filling them?',
      option_a: 'dropna()', option_b: 'fillna()', option_c: 'isnull()', option_d: 'merge()',
      correct_option: 'B', difficulty: 'easy',
    },
    {
      question_text: 'Which SQL keyword combines rows from two or more tables?',
      option_a: 'UNION', option_b: 'JOIN', option_c: 'GROUP BY', option_d: 'DISTINCT',
      correct_option: 'B', difficulty: 'medium',
    },
  ],
  'Java Developer': [
    {
      question_text: 'Which keyword is used to inherit a class in Java?',
      option_a: 'implements', option_b: 'extends', option_c: 'inherits', option_d: 'super',
      correct_option: 'B', difficulty: 'easy',
    },
    {
      question_text: 'What annotation marks a class as a Spring Boot REST controller?',
      option_a: '@Controller', option_b: '@RestController', option_c: '@Service', option_d: '@Bean',
      correct_option: 'B', difficulty: 'medium',
    },
  ],
};

// A short list of recommendation resources per skill (used as fallback / seed data)
const RECOMMENDATIONS = {
  'React': [
    { type: 'course', title: 'React Official Docs - Learn React', resource_url: 'https://react.dev/learn' },
    { type: 'mini_project', title: 'Build a Kanban board with drag-and-drop', resource_url: null },
  ],
  'Node.js': [
    { type: 'course', title: 'Node.js Official Guides', resource_url: 'https://nodejs.org/en/docs/guides' },
    { type: 'mini_project', title: 'Build a REST API for a todo app', resource_url: null },
  ],
  'SQL': [
    { type: 'practice_topic', title: 'Joins, subqueries and window functions', resource_url: null },
    { type: 'mini_project', title: 'Design and query a library management DB', resource_url: null },
  ],
  'DSA': [
    { type: 'practice_topic', title: 'Arrays, Linked Lists, Trees, Graphs, DP', resource_url: null },
  ],
};

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Seeding job roles...');
    const roleIdByTitle = {};
    for (const r of ROLES) {
      await conn.query(
        'INSERT INTO job_roles (title, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description=VALUES(description)',
        [r.title, r.description]
      );
      const [[row]] = await conn.query('SELECT id FROM job_roles WHERE title=?', [r.title]);
      roleIdByTitle[r.title] = row.id;
    }

    console.log('Seeding master skills...');
    const skillIdByName = {};
    for (const s of SKILLS) {
      await conn.query('INSERT IGNORE INTO skills (name) VALUES (?)', [s]);
      const [[row]] = await conn.query('SELECT id FROM skills WHERE name=?', [s]);
      skillIdByName[s] = row.id;
    }

    console.log('Mapping role -> required skills...');
    for (const [roleTitle, skillList] of Object.entries(ROLE_SKILLS)) {
      const roleId = roleIdByTitle[roleTitle];
      for (const [skillName, weight] of skillList) {
        const skillId = skillIdByName[skillName];
        await conn.query(
          'INSERT INTO role_skills (role_id, skill_id, weight) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE weight=VALUES(weight)',
          [roleId, skillId, weight]
        );
      }
    }

    console.log('Seeding aptitude questions...');
    for (const q of APTITUDE_QUESTIONS) {
      await conn.query(
        `INSERT INTO questions (category, role_id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty)
         VALUES ('aptitude', NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.difficulty]
      );
    }

    console.log('Seeding technical questions...');
    for (const [roleTitle, qs] of Object.entries(TECHNICAL_QUESTIONS)) {
      const roleId = roleIdByTitle[roleTitle];
      for (const q of qs) {
        await conn.query(
          `INSERT INTO questions (category, role_id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty)
           VALUES ('technical', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [roleId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.difficulty]
        );
      }
    }

    console.log('Seeding recommendation catalogue...');
    for (const [skillName, recs] of Object.entries(RECOMMENDATIONS)) {
      const skillId = skillIdByName[skillName];
      for (const rec of recs) {
        await conn.query(
          'INSERT INTO recommendations (skill_id, type, title, resource_url) VALUES (?, ?, ?, ?)',
          [skillId, rec.type, rec.title, rec.resource_url]
        );
      }
    }

    console.log('✅ Seed complete.');
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
