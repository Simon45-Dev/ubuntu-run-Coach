import { parse } from 'csv-parse/sync';
import { ClubEventResultStatus } from '@prisma/client';

const RESULT_STATUSES = new Set(Object.values(ClubEventResultStatus));

export interface ParsedClubEventResultRow {
  membershipNumber: string;
  finishTimeSeconds?: number;
  status: ClubEventResultStatus;
}

export type ParseClubEventResultsCsvResult =
  { rows: ParsedClubEventResultRow[] } | { errors: string[] };

interface RawCsvRow {
  membershipNumber?: string;
  finishTime?: string;
  status?: string;
}

/** Accepts "MM:SS" or "HH:MM:SS" - whatever format a race timer/spreadsheet exports. */
function parseFinishTime(raw: string, rowNum: number, errors: string[]): number | undefined {
  const parts = raw.split(':').map((p) => p.trim());
  if (parts.length !== 2 && parts.length !== 3) {
    errors.push(`Row ${rowNum}: "finishTime" must be MM:SS or HH:MM:SS, got "${raw}"`);
    return undefined;
  }
  const numbers = parts.map(Number);
  if (numbers.some((n) => Number.isNaN(n) || n < 0)) {
    errors.push(`Row ${rowNum}: "finishTime" must be MM:SS or HH:MM:SS, got "${raw}"`);
    return undefined;
  }
  const [h, m, s] = numbers.length === 3 ? numbers : [0, ...numbers];
  return h * 3600 + m * 60 + s;
}

/**
 * Every row is validated (not just the first bad one), matching
 * club-members-csv-import.util.ts's convention exactly. Row numbers count
 * from 2 (row 1 is the header). membershipNumber -> ClubMember.id is
 * resolved by the caller (ClubEventsService.importResultsCsv), which has
 * the DB access this pure parser deliberately doesn't.
 */
export function parseClubEventResultsCsv(buffer: Buffer): ParseClubEventResultsCsvResult {
  let records: RawCsvRow[];
  try {
    records = parse(buffer, { columns: true, trim: true, skip_empty_lines: true }) as RawCsvRow[];
  } catch (err) {
    return { errors: [`Could not parse CSV: ${err instanceof Error ? err.message : String(err)}`] };
  }

  if (records.length === 0) {
    return { errors: ['The CSV file has no data rows'] };
  }

  const errors: string[] = [];
  const rows: ParsedClubEventResultRow[] = [];

  records.forEach((record, index) => {
    const rowNum = index + 2;

    if (!record.membershipNumber) {
      errors.push(`Row ${rowNum}: "membershipNumber" is required`);
    }

    let status: ClubEventResultStatus = ClubEventResultStatus.FINISHED;
    if (record.status) {
      if (!RESULT_STATUSES.has(record.status as ClubEventResultStatus)) {
        errors.push(
          `Row ${rowNum}: "status" must be one of ${[...RESULT_STATUSES].join(', ')}, got "${record.status}"`,
        );
      } else {
        status = record.status as ClubEventResultStatus;
      }
    }

    let finishTimeSeconds: number | undefined;
    if (status === ClubEventResultStatus.FINISHED) {
      if (!record.finishTime) {
        errors.push(`Row ${rowNum}: "finishTime" is required unless status is DNF or DNS`);
      } else {
        finishTimeSeconds = parseFinishTime(record.finishTime, rowNum, errors);
      }
    }

    if (record.membershipNumber && RESULT_STATUSES.has(status)) {
      rows.push({ membershipNumber: record.membershipNumber, finishTimeSeconds, status });
    }
  });

  if (errors.length > 0) {
    return { errors };
  }
  return { rows };
}
