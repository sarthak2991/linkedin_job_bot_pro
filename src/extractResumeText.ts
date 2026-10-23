import pdfParse from "pdf-parse";
import fs from "fs";

export async function extractResumeText(
  pdfPath: string
): Promise<string> {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);

  return data.text.replace(/\s+/g, " ").trim();
}