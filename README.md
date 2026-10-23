# LinkedIn Job Bot Pro

A TypeScript automation that searches LinkedIn for entry-level software-engineering jobs in India and saves the results to an Excel workbook.

It uses Playwright to access LinkedIn through a locally saved, authenticated browser session. The search roles and location are configured in [`src/config.ts`](src/config.ts); companies in `banned_companies.txt` are skipped.

## Prerequisites

- Node.js 18 or later
- A LinkedIn account
- A Chromium browser installed for Playwright

## Setup

1. Install dependencies and the Playwright Chromium browser:

   ```bash
   npm install
   npx playwright install chromium
   ```

2. Create `banned_companies.txt` in the project root. Add one company name per line; it may be empty if you do not want to exclude any companies.

3. Build the TypeScript source:

   ```bash
   npm run build
   ```

4. Create your local LinkedIn session. A browser opens; log in manually, return to the terminal, and press Enter to save the session:

   ```bash
   npm run login
   ```

   This creates `linkedin-auth.json`, which contains login cookies and is deliberately ignored by Git.

## Run

Build after source changes, then run the bot:

```bash
npm run build
npm start
```

The results are written to `jobs.xlsx` in a `Jobs` worksheet with job ID, company, title, location, and LinkedIn link.

## Optional Gemini-based job ratings

The repository includes rating utilities that use the Gemini API and a local resume. To use those utilities, create a `.env` file:

```env
GEMINI_API_KEY=your_key_here
```

Keep your resume local as `sarthak_resume.pdf` (or update the path in `src/ratings.ts`). The `.env` file, session file, personal resume, generated spreadsheets, and logs are excluded by `.gitignore`.

## Configuration

- Update roles, location, and rating threshold in [`src/config.ts`](src/config.ts).
- Add excluded employers to `banned_companies.txt`, one per line.

## Notes

- LinkedIn may expire the stored session. Run `npm run login` again if the job search redirects to a login page.
- Automated use of LinkedIn should comply with LinkedIn's terms and applicable policies.
