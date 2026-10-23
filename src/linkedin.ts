
import { chromium } from "@playwright/test";
import { ROLES } from "./config";
import { Job } from "./types";
import { parseJobDescription, isEntryLevelJob} from "./description_based_filter"
import { promises as fs } from "fs";

const bannedCompanies = new Set<string>();

export async function loadBannedCompanies() {
  const content = await fs.readFile("banned_companies.txt", "utf8");

  bannedCompanies.clear();

  content
    .split("\n")
    .map(line => line.trim().toLowerCase())
    .filter(Boolean)
    .forEach(company => bannedCompanies.add(company));
}


async function collectJobCards(
  page: any,
  jobs: Map<string, Job>,
  seen: Set<string>
) {
  while (true) {
    try {
      // Wait for any element holding a job card component key or standard container
      const cardSelector = [
        'li[data-occludable-job-id]',              // New structure (outer <li>)
        'div[data-job-id]',                        // New structure (inner <div>)
        '.job-card-container',                     // New structure (class-based)
        '[componentkey*="job-card"]',              // Legacy fallback
        'div[componentkey*="job-card-component-ref"]' // Legacy fallback
      ].join(', ');
      await page.waitForSelector(cardSelector, { state: 'attached',timeout: 10000 });
      await page.waitForTimeout(2000);

      const cards = page.locator(cardSelector);
      const count = await cards.count();
      let relevantJobCount = 0;

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();

        try {
          // 1. Extract Job ID (from attribute or fallback link)
          let jobId = await card.getAttribute("data-occludable-job-id") || await card.getAttribute("data-job-id");

          if (!jobId) {
            const componentKey = await card.getAttribute("componentkey");
            if (componentKey) {
              const match = componentKey.match(/job-card-component-ref-(\d+)/);
              if (match) jobId = match[1];
            }
          }

          if (!jobId) {
            const innerLink = await card.locator('a[href*="/jobs/view/"], a[href*="jobPostingId"]').first().getAttribute("href").catch(() => null);
            if (innerLink) {
              const match = innerLink.match(/(?:jobPostingId=|\/jobs\/view\/)(\d+)/);
              if (match) jobId = match[1];
            }
          }

          if (!jobId || jobs.has(jobId) || seen.has(jobId)) {
            continue;
          }
          seen.add(jobId);

          // 2. Click card element to hydrate details view
          await card.click({ force: true });
          await page.waitForTimeout(1500);

          // 3. Extract Job Title (Support both new anchor tag & legacy paragraphs)
          let title = "";
          const titleElement = card.locator('.job-card-list__title--link, p:has-text("Verified job")').first();
          if (await titleElement.count() > 0) {
            const rawText = await titleElement.textContent();
            title = rawText ? rawText.replace(/Selected,|,|\(Verified job\)/g, "").trim() : "";
          }

          // 4. Extract Company & Location (Support both new classes & fallback paragraphs)
          let company = "";
          let location = "";

          // Try new structure first
          const companyElem = card.locator('.artdeco-entity-lockup__subtitle, .job-card-container__company-name').first();
          const locationElem = card.locator('.artdeco-entity-lockup__caption, .job-card-container__metadata-wrapper').first();

          if (await companyElem.count() > 0) {
            company = (await companyElem.textContent())?.trim() || "";
          }
          if (await locationElem.count() > 0) {
            location = (await locationElem.textContent())?.trim() || "";
          }

          // Fallback to legacy paragraph strategy if company is still empty
          if (!company) {
            const paragraphs = card.locator("p");
            if (await paragraphs.count() >= 2) {
              company = (await paragraphs.nth(1).textContent())?.trim() || "";
              location = (await paragraphs.nth(2).textContent())?.trim() || "";
            }
          }

          if (bannedCompanies.has(company.toLowerCase())) {
            console.log(`Skipping banned company: ${company}`);
            continue;
          }

          const link = `https://www.linkedin.com/jobs/view/${jobId}/`;

          // 5. Extract Job Description from detail pane
          const descriptionElement = page.locator('.jobs-description-content__text--stretch, #job-details, [data-component-type="LazyColumn"]').first();
          const description = (await descriptionElement.textContent())?.trim() || "";

          // Parse and store valid jobs
          const parsed = await parseJobDescription(description);
          if (isEntryLevelJob(parsed)) {
            jobs.set(jobId, {
              jobId,
              title,
              company,
              location,
              link,
            });
            relevantJobCount++;
          } else {
            console.log(`Non-entry level: ${title} @ ${company}`);
          }

        } catch (err) {
          console.error("Error processing dynamic job card:", err);
        }
      }

      console.log(`${relevantJobCount} relevant cards found in this iteration`);

      // 6. Scroll job list container to trigger lazy loading of new component-key cards
      const scrollContainer = page.locator('div[data-testid="lazy-column"], .scaffold-layout__list').first();
      if (await scrollContainer.count() > 0) {
        await scrollContainer.evaluate((el: HTMLElement) => el.scrollBy(0, 1000));
      } else {
        await page.evaluate(() => window.scrollBy(0, 1000));
      }
      await page.waitForTimeout(2500);

      // Check if new cards are visible
      const postCards = page.locator(cardSelector);
      const postCount = await postCards.count();
      let hasNewUnprocessed = false;

      for (let i = 0; i < postCount; i++) {
        const cKey = await postCards.nth(i).getAttribute("componentkey");
        const match = cKey ? cKey.match(/job-card-component-ref-(\d+)/) : null;
        if (match && !seen.has(match[1])) {
          hasNewUnprocessed = true;
          break;
        }
      }

      if (!hasNewUnprocessed) {
        console.log("No new component keys detected. Ending scroll iteration.");
        break;
      }

    } catch (err) {
      console.error("Collection loop encountered an error:", err);
      break;
    }
  }
}
async function applyEntryLevelFilter(page: any) {
  try {
    // 1. Target the Experience Level dropdown pill using its aria-label or componentkey
    const expFilterPill = page.locator('div[aria-label="Filter by Experience level"], div[componentkey*="JobSearchResultsPage_SemanticDynamicSuggestionDropdownRollupGroupBindingKey_227001"]').first();
    await expFilterPill.click();
    await page.waitForTimeout(1000);
    console.log("Clicked Experience Level filter pill");
    // 2. Locate the Entry Level option container
  const entryLevelOption = page.locator('div[aria-label="Entry-level"]').first();
  await entryLevelOption.waitFor({ state: "visible", timeout: 5000 });

  // 3. Target the underlying checkbox input specifically
  const checkbox = entryLevelOption.locator('input[type="checkbox"]').first();

  // Try checking with force, fallback to DOM event if needed
  try {
    await checkbox.click({ force: true });
  } catch (e) {
    await entryLevelOption.evaluate((el: HTMLElement) => el.click());
  }
    console.log("Clicked Entry level option");
    await page.waitForTimeout(1000);
    // 3. Click the "Show results" link/button
    // Notice that in your DOM snippet, this is actually an <a> tag containing "Show results"
    const showResultsBtn = page.locator('a:has-text("Show results"), a[componentkey]:has-text("Show results")').first();
    
    // Wait for it to become active/clickable and trigger navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {}),
      showResultsBtn.click()
    ]);

    await page.waitForTimeout(2000);
    console.log("Entry level filter applied successfully.");
  } catch (err) {
    console.error("Failed to interact with Experience Level UI filter:", err);
  }
}
export async function fetchJobs():Promise<Map<string, Job>>{
 
  await loadBannedCompanies();
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({storageState:"linkedin-auth.json"});
  const page=await context.newPage();
  const jobs = new Map<string, Job>();
  const seen = new Set<string>();
  try {
  for(const role of ROLES){
 
   try {
    const roleWithFilter = role + " posted in past 24 hours for freshers in india";
     const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(roleWithFilter)}&location=India&f_TPR=r86400&f_E=2&f_JT=F&f_F=eng`;
   
     console.log(url);
      await page.goto(url,{waitUntil:"domcontentloaded"});
      console.log("Reached job page");
   
      // Apply Entry Level filter
      //await applyEntryLevelFilter(page);
   
      
     
   
   while (true) {
   
     const nextButton = page.locator(
       '.jobs-search-pagination__button--next'
     );
     await collectJobCards(page, jobs, seen);

   
     if (
       !(await nextButton.count()) ||
       (await nextButton.isDisabled())
     ) {
       break;
     }
   
     await nextButton.click();
   }

   } catch (error) {
     console.error(error);
   }
 
  }
 } catch (error) {
  console.error(error);
 }
 finally {
  await browser.close();
 }
 //console.log(jobs);
 return jobs;
}
