# LinkedIn Job Search Automation - Architecture & Working

## Overview

This project automates the process of finding relevant software engineering jobs on LinkedIn, extracting detailed job information, matching jobs against a candidate's resume using Gemini AI, and exporting the final ranked shortlist into an Excel workbook.

The system is designed to:

* Search LinkedIn jobs automatically
* Collect detailed job information and descriptions
* Parse resume PDFs into text
* Match jobs against the resume using Gemini
* Rank jobs based on relevance
* Optionally enrich results with company ratings
* Export results into Excel for tracking and applications

---

# High Level Architecture

```text
LinkedIn Login Session
        ↓
Playwright Job Search
        ↓
Collect Job Cards
        ↓
Open Job Details
        ↓
Extract Job Description
        ↓
Resume PDF
        ↓
pdf-parse
        ↓
Extract Resume Text
        ↓
Simplify Job Objects
        ↓
Batch Jobs (10)
        ↓
Gemini Match Analysis
        ↓
Generate Match Scores
        ↓
Rank Jobs
        ↓
Optional Rating Lookup
        ↓
Excel Export
```

---

# Project Structure

```text
linkedin-job-bot/
│
├── src/
│   ├── config.ts
│   ├── linkedin.ts
│   ├── matching.ts
│   ├── ratings.ts
│   ├── excel.ts
│   ├── resume.ts
│   ├── saveSession.ts
│   ├── types.ts
│   └── index.ts
│
├── linkedin-auth.json
├── jobs.xlsx
├── resume.pdf
├── package.json
└── .env
```

---

# Component Breakdown

## 1. Authentication Module

### File

```text
saveSession.ts
```

### Purpose

* Login manually once
* Save LinkedIn cookies
* Reuse session across executions

### Output

```text
linkedin-auth.json
```

### Benefits

* Avoids storing credentials in code
* Supports MFA
* More reliable than automated login

---

## 2. LinkedIn Search Module

### File

```text
linkedin.ts
```

### Responsibilities

* Open LinkedIn Jobs
* Search predefined job roles
* Apply location filter
* Apply last 24 hours filter
* Apply experience-level filters
* Scroll through results
* Collect job cards

### Example Search URL

```text
https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer&location=India&f_TPR=r86400&f_E=1,2
```

### Experience Levels

```text
1 = Internship
2 = Entry Level
3 = Associate
4 = Mid-Senior
5 = Director
6 = Executive
```

---

## 3. Job Extraction Module

### Extracted Fields

```ts
{
  jobId,
  title,
  role,
  company,
  location,
  link,
}
```

### Recommended Selector

```ts
[data-job-id]
```

---

## 4. Job Detail Extraction

After clicking a job card:

```text
Job Card
    ↓
Job Details Panel
```

### Additional Information

```ts
{
  description
}
```

The job description becomes a key input for AI matching.

---

## 5. Resume Processing Module

### Purpose

Analyze the candidate's resume and rank jobs based on relevance.

### Workflow

```text
Resume PDF
      ↓
pdf-parse
      ↓
Extract Resume Text
      ↓
Store In Memory
```

### Benefits

* No repeated PDF uploads
* Lower Gemini token usage
* Faster matching
* Easier debugging

### Example

```ts
import pdfParse from "pdf-parse";

const data = await pdfParse(buffer);
const resumeText = data.text;
```

---

# Changes to Architecture

## Updated Job Interface

```ts
export interface Job {
  jobId: string;
  title: string;
  role: string;
  company: string;
  location: string;
  link: string;
  description?: string;
  score?: number;
  match?: "high" | "medium" | "low";
}
```

---

## Updated Gemini Input

```ts
const jobs = companies.map(job => ({
  jobId: job.jobId,
  company: job.company,
  title: job.title,
  role: job.role,
  description: job.description ?? ""
}));
```

---

## Updated Gemini Output

```json
[
  {
    "jobId": "4252026496",
    "company": "Amazon",
    "role": "Software Development Engineer",
    "match": "high",
    "score": 91
  }
]
```

---

## Updated Matching Workflow

```text
Resume Text
       +
Job Description
       ↓
Gemini 2.5 Flash
       ↓
Returns:
- jobId
- score
- match
       ↓
Merge Results Back Into Jobs
       ↓
Sort By Score Descending
```

---

## Job Result Merging

Results are merged using jobId instead of company name.

```ts
const ratingMap = new Map(
  matches.map(m => [m.jobId, m])
);

const final = jobs.map(job => ({
  ...job,
  ...(ratingMap.get(job.jobId) ?? {})
}));
```

---

## Existing Job Cache

Previously processed jobs are loaded from Excel.

```ts
Map<
  string, // jobId
  {
    score: number;
    match: string;
  }
>
```

Jobs already present in the workbook are skipped from Gemini processing.

```ts
const missing = jobs.filter(
  j => !known.has(j.jobId)
);
```

---

## Updated Excel Structure

### Jobs Sheet

| JobID | Company | Role | Location | Link | Score | Match |
| ----- | ------- | ---- | -------- | ---- | ----- | ----- |

Example:

| JobID      | Company | Role | Location  | Link | Score | Match |
| ---------- | ------- | ---- | --------- | ---- | ----- | ----- |
| 4252026496 | Amazon  | SDE  | Bangalore | ...  | 91    | High  |

---

## Excel Export Logic

Before writing:

```ts
jobs.sort(
  (a, b) => (b.score ?? 0) - (a.score ?? 0)
);
```

Then export:

```ts
j.addRow([
  x.jobId,
  x.company,
  x.role,
  x.location,
  x.link,
  x.score,
  x.match
]);
```

---

## Updated Ranking Logic

Primary ranking:

```text
Score (0-100)
```

Secondary ranking:

```text
Match Level
High > Medium > Low
```

Jobs are exported in descending score order.

---

## Updated Execution Flow

```text
LinkedIn Session
       ↓
Playwright Search
       ↓
Collect Job Cards
       ↓
Extract JobID
       ↓
Open Job Details
       ↓
Extract Description
       ↓
Resume PDF
       ↓
Extract Resume Text
       ↓
Create Job Batches (10)
       ↓
Gemini Analysis
       ↓
Return:
    jobId
    score
    match
       ↓
Merge Into Jobs
       ↓
Sort By Score
       ↓
Export To Excel
```
