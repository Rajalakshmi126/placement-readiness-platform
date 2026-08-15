#!/usr/bin/env python3
"""
skill_extractor.py
-------------------
The "AI" analysis component of the Placement Readiness Platform.

Given raw resume text, this script:
  1. Detects known technical skills mentioned in the resume (keyword +
     synonym matching, case-insensitive, word-boundary aware).
  2. Estimates the number of projects and certifications listed, using
     section-header and bullet-pattern heuristics.
  3. Prints a single JSON object to stdout so the Node.js backend can
     consume it directly via child_process.

Usage:
    python3 skill_extractor.py "<path-to-resume-text-file>"

    or pipe text in:
    cat resume.txt | python3 skill_extractor.py -

This is intentionally dependency-light (standard library only) so it
runs anywhere Python 3 is installed, without extra pip installs.
For real PDF parsing, the Node layer extracts text first (via
pdf-parse) and passes plain text to this script.
"""

import sys
import json
import re

# Master skill list with common synonyms/aliases mapped to a canonical name.
# This mirrors (and should stay in sync with) database/seed.js SKILLS list.
SKILL_ALIASES = {
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3"],
    "JavaScript": ["javascript", "js", "es6", "ecmascript"],
    "React": ["react", "react.js", "reactjs"],
    "TypeScript": ["typescript", "ts"],
    "Responsive Design": ["responsive design", "responsive web design", "mobile-first"],
    "Node.js": ["node.js", "nodejs", "node js"],
    "Express.js": ["express.js", "expressjs", "express js", "express"],
    "REST API": ["rest api", "restful api", "rest apis", "restful services"],
    "MongoDB": ["mongodb", "mongo db"],
    "MySQL": ["mysql", "my sql"],
    "System Design": ["system design", "low level design", "high level design", "hld", "lld"],
    "Python": ["python", "python3"],
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "SQL": ["sql", "structured query language"],
    "Data Visualization": ["data visualization", "tableau", "power bi", "matplotlib", "seaborn"],
    "Excel": ["excel", "ms excel", "microsoft excel"],
    "Java": ["java"],
    "Spring Boot": ["spring boot", "springboot", "spring framework"],
    "OOP": ["oop", "object oriented programming", "object-oriented programming"],
    "DSA": ["dsa", "data structures", "algorithms", "data structures and algorithms"],
    "Git": ["git", "github", "gitlab", "version control"],
    "Docker": ["docker", "containerization"],
}

PROJECT_HEADER_RE = re.compile(r"(?im)^\s*(projects?|academic projects?|personal projects?)\s*[:\-]?\s*$")
CERT_HEADER_RE = re.compile(r"(?im)^\s*(certifications?|licenses?( *&|and)? *certifications?)\s*[:\-]?\s*$")
BULLET_LINE_RE = re.compile(r"(?m)^\s*[-•*▪●○\u2022]\s+.+$")


def extract_skills(text: str):
    """Return list of {name, confidence} for skills detected in text."""
    lower = text.lower()
    found = []
    for canonical, aliases in SKILL_ALIASES.items():
        best_hits = 0
        for alias in aliases:
            pattern = r"(?<![a-zA-Z0-9])" + re.escape(alias) + r"(?![a-zA-Z0-9])"
            hits = len(re.findall(pattern, lower))
            best_hits = max(best_hits, hits)
        if best_hits > 0:
            # simple confidence heuristic: more mentions -> higher confidence, capped at 0.99
            confidence = min(0.6 + 0.1 * best_hits, 0.99)
            found.append({"name": canonical, "mentions": best_hits, "confidence": round(confidence, 2)})
    found.sort(key=lambda s: (-s["mentions"], s["name"]))
    return found


def count_section_items(text: str, header_re: re.Pattern) -> int:
    """
    Roughly estimate how many bullet items sit under a given section
    header (Projects / Certifications) before the next all-caps/header
    line begins. Falls back to counting header occurrences if no
    bullets are detected (e.g. comma separated certifications).
    """
    lines = text.splitlines()
    count = 0
    in_section = False
    found_any_header = False

    generic_header_re = re.compile(r"(?im)^\s*[A-Z][A-Za-z &/]{2,40}\s*[:\-]?\s*$")

    for line in lines:
        if header_re.match(line):
            in_section = True
            found_any_header = True
            continue
        if in_section:
            if generic_header_re.match(line) and not header_re.match(line):
                in_section = False
                continue
            if BULLET_LINE_RE.match(line):
                count += 1
            elif line.strip() == "" :
                continue

    if found_any_header and count == 0:
        # fallback: count comma / semicolon separated items on lines under header
        return 1
    return count


def analyze(text: str) -> dict:
    skills = extract_skills(text)
    projects = count_section_items(text, PROJECT_HEADER_RE)
    certifications = count_section_items(text, CERT_HEADER_RE)

    return {
        "skills": skills,
        "projects_count": projects,
        "certifications_count": certifications,
        "word_count": len(text.split()),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided. Pass a file path or '-' for stdin."}))
        sys.exit(1)

    source = sys.argv[1]
    if source == "-":
        text = sys.stdin.read()
    else:
        with open(source, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

    result = analyze(text)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
