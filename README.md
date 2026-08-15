# AI-Powered Placement Readiness Platform

A web-based platform that helps students assess and improve their readiness
for campus placements. Students upload a resume, pick a target job role, and
complete a short aptitude + technical assessment. The platform runs **Dynamic
Skill Gap Prediction** against the target role, calculates a **Placement
Readiness Score**, and returns personalized recommendations — skills to
learn, practice topics, mini projects, and resources.

## Tech stack

| Layer            | Technology                              |
|-------------------|------------------------------------------|
| Frontend          | HTML5, CSS3, vanilla JavaScript          |
| Backend / API      | Node.js, Express.js                     |
| Database           | MySQL                                   |
| Resume analysis ("AI" layer) | Python (skill extraction, project/certification detection) |
| Auth               | JWT + bcrypt password hashing            |

## How it works

```
Resume (PDF/TXT)                Target role
      │                              │
      ▼                              ▼
pdf-parse (Node) ──text──► skill_extractor.py (Python)
      │                              │
      ▼                              ▼
resume_skills table          role_skills table (weighted)
      │                              │
      └───────────► readinessEngine.js ◄───────────┐
                          │                          │
              Dynamic Skill Gap Prediction   Aptitude + Technical
              (matched / missing skills)        test scores
                          │
                          ▼
              Placement Readiness Score (0-100)
                          │
                          ▼
              Personalized recommendations
```

**Placement Readiness Score** is a weighted composite:

- Resume ↔ role skill match — **40%** (weighted by how important each skill is to the role)
- Technical test score — **25%**
- Aptitude test score — **20%**
- Projects & certifications strength — **15%**

See `services/readinessEngine.js` for the exact formulas — they're pure,
dependency-free functions so you can unit test or tune the weights easily.

## Project structure

```
placement-readiness-platform/
├── server.js                  # Express app entry point
├── config/db.js                # MySQL connection pool
├── database/
│   ├── schema.sql              # Full table definitions
│   └── seed.js                 # Seeds job roles, skills, questions, recommendations
├── python/
│   └── skill_extractor.py      # Resume skill / project / certification detection
├── services/
│   ├── resumeParser.js         # PDF text extraction + calls the Python extractor
│   └── readinessEngine.js      # Skill gap prediction + readiness score formulas
├── middleware/auth.js          # JWT auth guard
├── routes/
│   ├── auth.js                 # Register / login
│   ├── roles.js                # Job roles + required skills
│   ├── resume.js                # Resume upload + analysis
│   ├── assessment.js           # Aptitude/technical question delivery + scoring
│   └── report.js                # Orchestrates the full readiness report
└── public/                     # Frontend (static, served by Express)
    ├── index.html               # Landing page
    ├── css/style.css            # Design system
    ├── js/{api.js,gauge.js,app-nav.js}
    └── pages/
        ├── login.html / register.html
        ├── dashboard.html
        ├── upload-resume.html   # Step 1
        ├── select-role.html     # Step 2
        ├── assessment.html      # Step 3
        └── results.html         # Step 4 — score + skill gap + recommendations
```

## Setup

### 1. Prerequisites
- Node.js 18+
- MySQL 8+
- Python 3.8+ (standard library only, no pip installs required)

### 2. Install dependencies
```bash
cd placement-readiness-platform
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# then edit .env with your MySQL credentials and a JWT secret
```

### 4. Create and seed the database
```bash
mysql -u root -p < database/schema.sql
npm run seed
```
This creates the `placement_readiness_db` database and populates:
- 5 sample job roles (Frontend, Backend, Full Stack, Data Analyst, Java Developer)
- A master skill list with weighted requirements per role
- Sample aptitude + role-specific technical questions
- A starter recommendation catalogue

### 5. Run the app
```bash
npm start          # production
npm run dev         # with nodemon auto-reload
```
Visit **http://localhost:5000**.

## Extending it

- **More roles/skills**: add rows to `ROLES`, `SKILLS`, `ROLE_SKILLS` in
  `database/seed.js` and re-run `npm run seed`.
- **Smarter resume parsing**: `python/skill_extractor.py` currently uses
  keyword/alias matching (dependency-free, runs anywhere). Swap in spaCy,
  a trained NER model, or an LLM call for more nuanced extraction — the
  Node ↔ Python contract (`stdin` text in, one JSON object out) stays the same.
  For DOCX resumes, add a text-extraction step before the file reaches
  `resumeParser.js` (e.g. `mammoth` for .docx).
- **Bigger question bank / adaptive difficulty**: extend the `questions`
  table and adjust the `ORDER BY RAND() LIMIT n` queries in `routes/assessment.js`.
- **Tuning the score formula**: adjust `WEIGHTS` in `services/readinessEngine.js`.
