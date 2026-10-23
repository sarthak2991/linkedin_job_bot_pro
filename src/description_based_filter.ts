// jobParser.ts

import stringSimilarity from "string-similarity"
export interface ParsedJob {
  role: string;
  experienceYears: number | null;
  requiredQualifications: string[];
  preferredQualifications: string[];
}

type SectionType =
  | "role"
  | "required_qualifications"
  | "preferred_qualifications";

interface HeaderMatch {
  category: SectionType;
  score: number;
}

const HEADERS: Record<SectionType, string[]> = {
  role: [
    "about the role",
    "job summary",
    "position overview",
    "what you will do",
    "responsibilities",
    "about this job",
  ],

  required_qualifications: [
    "requirements",
    "minimum qualifications",
    "required qualifications",
    "must have",
    "basic qualifications",
    "what you'll need",
    "skills required",
  ],

  preferred_qualifications: [
    "preferred qualifications",
    "nice to have",
    "desired qualifications",
    "bonus points",
    "good to have",
    "preferred skills",
  ],
};


export function detectHeaders(
  description: string
): Array<{ lineNumber: number; header: string }> {
  const lines = description.split("\n");

  const headers: Array<{
    lineNumber: number;
    header: string;
  }> = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) return;

    const looksLikeHeader =
      trimmed.length < 80 &&
      (
        /^[A-Z\s/&:-]+$/.test(trimmed) ||
        trimmed.endsWith(":") ||
        /^[A-Z][A-Za-z\s/&-]{2,60}$/.test(trimmed)
      );

    if (looksLikeHeader) {
      headers.push({
        lineNumber: index,
        header: trimmed,
      });
    }
  });

  return headers;
}

export function classifyHeader(header: string) {
    header = header.toLowerCase();
  
    let bestCategory = "";
    let bestScore = 0;
  
    for (const [category, labels] of Object.entries(HEADERS)) {
      for (const label of labels) {
        const score =
          stringSimilarity.compareTwoStrings(
            header,
            label
          );
  
        if (score > bestScore) {
          bestScore = score;
          bestCategory = category;
        }
      }
    }
  
    return {
      category: bestCategory,
      score: bestScore
    };
  }

export async function extractSections(
  description: string
): Promise<Record<SectionType, string>> {
  const lines = description.split("\n");

  const headers = detectHeaders(description);

  const sections: Record<SectionType, string> = {
    role: "",
    required_qualifications: "",
    preferred_qualifications: "",
  };

  for (let i = 0; i < headers.length; i++) {
    const current = headers[i];

    const match = await classifyHeader(
      current.header
    );

    if (match.score < 0.45) {
      continue;
    }

    const start = current.lineNumber + 1;

    const end =
      i < headers.length - 1
        ? headers[i + 1].lineNumber
        : lines.length;

    const content = lines
      .slice(start, end)
      .join("\n")
      .trim();

    sections[match.category] += "\n" + content;
  }

  return sections;
}

export function extractBullets(
  text: string
): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      /^[-•*]/.test(line)
    )
    .map((line) =>
      line.replace(/^[-•*]\s*/, "")
    );
}

const EXPERIENCE_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/gi,
  /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/gi,
  /at least\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/gi,
  /minimum(?:\s+of)?\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/gi,
];

export function extractExperienceYears(
  description: string
): number | null {
  const text = description.toLowerCase();

  const years: number[] = [];

  for (const pattern of EXPERIENCE_PATTERNS) {
    const matches = [...text.matchAll(pattern)];

    for (const match of matches) {
      for (const group of match.slice(1)) {
        if (group) {
          years.push(Number(group));
        }
      }
    }
  }

  if (years.length === 0) {
    const entryLevelSignals = [
      "entry level",
      "new grad",
      "fresh graduate",
      "graduate program",
      "no experience required",
      "0-1 years",
    ];

    const found = entryLevelSignals.some((s) =>
      text.includes(s)
    );

    return found ? 0 : null;
  }

  return Math.min(...years);
}

export async function parseJobDescription(
  description: string
): Promise<ParsedJob> {
  const sections =
    await extractSections(description);

  return {
    role: sections.role.trim(),

    experienceYears:
      extractExperienceYears(description),

    requiredQualifications:
      extractBullets(
        sections.required_qualifications
      ),

    preferredQualifications:
      extractBullets(
        sections.preferred_qualifications
      ),
  };
}

export function isEntryLevelJob(
  parsedJob: ParsedJob
): boolean {
  if (
    parsedJob.experienceYears === null
  ) {
    return true;
  }

  return parsedJob.experienceYears < 1;
}

/*
USAGE

await initializeEmbeddingModel();
await buildCanonicalEmbeddings();

const parsed =
  await parseJobDescription(jobDescription);

if (isEntryLevelJob(parsed)) {
  console.log("KEEP");
}

console.log(parsed);
*/