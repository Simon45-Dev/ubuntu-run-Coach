import { parse } from 'csv-parse/sync';
import { MembershipCategory } from '@prisma/client';

const MEMBERSHIP_CATEGORIES = new Set(Object.values(MembershipCategory));

export interface ParsedClubMemberRow {
  firstName: string;
  lastName: string;
  idNumber?: string;
  email: string;
  phone?: string;
  dateOfBirth?: Date;
  address?: string;
  membershipCategory?: MembershipCategory;
  joinDate?: Date;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
}

export type ParseClubMembersCsvResult = { rows: ParsedClubMemberRow[] } | { errors: string[] };

interface RawCsvRow {
  firstName?: string;
  lastName?: string;
  idNumber?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  membershipCategory?: string;
  joinDate?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseOptionalDate(
  raw: string | undefined,
  field: string,
  rowNum: number,
  errors: string[],
): Date | undefined {
  if (!raw) return undefined;
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    errors.push(`Row ${rowNum}: "${field}" is not a valid date: "${raw}"`);
    return undefined;
  }
  return value;
}

/**
 * Every row is validated (not just the first bad one) so a coach can fix
 * everything in one pass instead of a slow fix-one-reupload-repeat loop.
 * Row numbers count from 2 (row 1 is the header), matching what a coach
 * sees when they open the file in a spreadsheet editor. Mirrors
 * src/modules/workouts/csv-import.util.ts's conventions exactly.
 */
export function parseClubMembersCsv(buffer: Buffer): ParseClubMembersCsvResult {
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
  const rows: ParsedClubMemberRow[] = [];

  records.forEach((record, index) => {
    const rowNum = index + 2;

    if (!record.firstName) {
      errors.push(`Row ${rowNum}: "firstName" is required`);
    }
    if (!record.lastName) {
      errors.push(`Row ${rowNum}: "lastName" is required`);
    }
    if (!record.email) {
      errors.push(`Row ${rowNum}: "email" is required`);
    } else if (!EMAIL_PATTERN.test(record.email)) {
      errors.push(`Row ${rowNum}: "email" is not a valid email: "${record.email}"`);
    }

    const dateOfBirth = parseOptionalDate(record.dateOfBirth, 'dateOfBirth', rowNum, errors);
    const joinDate = parseOptionalDate(record.joinDate, 'joinDate', rowNum, errors);

    if (
      record.membershipCategory &&
      !MEMBERSHIP_CATEGORIES.has(record.membershipCategory as MembershipCategory)
    ) {
      errors.push(
        `Row ${rowNum}: "membershipCategory" must be one of ${[...MEMBERSHIP_CATEGORIES].join(', ')}, got "${record.membershipCategory}"`,
      );
    }

    if (record.firstName && record.lastName && record.email && EMAIL_PATTERN.test(record.email)) {
      rows.push({
        firstName: record.firstName,
        lastName: record.lastName,
        idNumber: record.idNumber || undefined,
        email: record.email,
        phone: record.phone || undefined,
        dateOfBirth,
        address: record.address || undefined,
        membershipCategory: record.membershipCategory
          ? (record.membershipCategory as MembershipCategory)
          : undefined,
        joinDate,
        nextOfKinName: record.nextOfKinName || undefined,
        nextOfKinPhone: record.nextOfKinPhone || undefined,
        nextOfKinRelationship: record.nextOfKinRelationship || undefined,
      });
    }
  });

  if (errors.length > 0) {
    return { errors };
  }
  return { rows };
}
