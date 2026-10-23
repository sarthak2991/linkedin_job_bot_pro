
import { fetchJobs } from "./linkedin";
import { saveWorkbook } from "./excel";


(async()=>{
  console.log("fetching jobs");
  const jobs=await fetchJobs();


  await saveWorkbook([...jobs.values()]);
  console.log(`Saved ${jobs.size} jobs`);
})();
