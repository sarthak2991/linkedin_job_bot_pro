
import { chromium } from "@playwright/test";
(async()=>{
 const browser=await chromium.launch({headless:false});
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto("https://www.linkedin.com/login");
 console.log("Login manually then press Enter in terminal");
 process.stdin.once("data", async ()=>{
   await context.storageState({path:"linkedin-auth.json"});
   await browser.close();
 });
})();
