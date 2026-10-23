
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractResumeText } from "./extractResumeText";
import * as dotenv from "dotenv";
import { Job } from "./types";
import * as fs from "fs";
import { setTimeout } from "node:timers/promises";
dotenv.config();

function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
  
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
  
    return chunks;
  }

export async function getRatings(companies:Job[]){
 const model=new GoogleGenerativeAI(process.env.GEMINI_API_KEY!).getGenerativeModel({model:"gemini-2.5-flash"});
 const jobs = companies.map(job => ({
    id: job.jobId,
    company: job.company,
    title: job.title,
    description: job.description ?? ""
  }));
  
  
  const jobBatches = chunk(jobs, 10);
  const PDF_PATH = './sarthak_resume.pdf'
  const resumeText = extractResumeText(PDF_PATH);
  const allMatches = [];
  for (const batch of jobBatches) {
    try{
 const prompt = `
You are an experienced technical recruiter.

Canadidate's Resume:
${resumeText}

Analyze the resume against each job below.

Jobs:
${JSON.stringify(batch, null, 2)}
Sort the output by score descending.
Return ONLY valid JSON.

[
  {
    "jobId" : "1";
    "company": "ABC",
    "role" : "Associate Software Engineer",
    "match": "high",
    "score": 85,
  },
  {
    "jobId" : "2";
    "company": "XYZ",
    "role": "Software Engineer",
    "match": "medium",
    "score": 60,
  }
  ,...
]

Rules:
- Decide the match and score based on match of skills, technologies, experience level againt the job description.
- role can be extracted from the title.
- match must be one of: "high", "medium", "low". This is qualitative measure to describe the match.
- score must be an integer from 0 to 100. This is quantitative measure to describe the match.
- In score, weightage for a match will be as follows: 40% experience level, 30 % skills and technogies, 30% company ratings and reviews.
- Do not include markdown
- Do not include any text outside the JSON
`;
 const batch_nums = batch.length; 
 console.log(`Started getting reviews for ${batch_nums} companies`);
 const res = await model.generateContent({
  contents: [
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ],
  generationConfig: {
    responseMimeType: "application/json",
  },
});

const data = JSON.parse(res.response.text());
 console.log(`Parsing reviews for ${batch_nums} companies`);
 try{allMatches.push(...data);}catch{return [];}}
catch(err){
  console.error(err);
  await setTimeout(2*60*1000);
}
await setTimeout(2*60*1000);
}
fs.writeFileSync(
  "jobRatings.json",
  JSON.stringify(allMatches, null, 2), // pretty-printed JSON
  "utf-8"
);

 return allMatches;
}
