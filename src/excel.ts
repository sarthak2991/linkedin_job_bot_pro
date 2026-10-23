
import ExcelJS from "exceljs";
import { Job } from "./types";

const FILE="jobs.xlsx";

export async function loadKnownJobs() {
  const wb = new ExcelJS.Workbook();

  try {
    await wb.xlsx.readFile(FILE);
  } catch {
    return new Map();
  }

  const ws = wb.getWorksheet("Jobs");
  const map = new Map();

  if (!ws) return map;

  ws.eachRow((r, row) => {
    if (row === 1) return; // skip header

    const jobId = String(r.getCell(1).value ?? "");

    map.set(jobId, {
      company: String(r.getCell(2).value ?? ""),
      title: String(r.getCell(3).value ?? ""),
      location: String(r.getCell(4).value ?? ""),
      link: String(r.getCell(5).value ?? "")
    });
  });

  return map;
}

export async function saveWorkbook(jobs:Job[]){
 const wb=new ExcelJS.Workbook();

 const j=wb.addWorksheet("Jobs");
 j.addRow(["JobID","Company","Title","Location","Link"]);
jobs
.forEach(x =>
  j.addRow([
    x.jobId,
    x.company,
    x.title,
    x.location,
    x.link
  ])
);
 j.getRow(1).font = { bold: true };
 j.columns.forEach(column => {
  column.width = Math.max(
    15,
    ...column.values
      .slice(1)
      .map(v => String(v ?? "").length)
  );
});
 await wb.xlsx.writeFile(FILE);
}
