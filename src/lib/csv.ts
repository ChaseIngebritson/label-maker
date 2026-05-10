import type { Address } from "../types";

const EMPTY_ADDRESS: Address = {
  title: "",
  firstName: "",
  lastName: "",
  suffix: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

function parseRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function parseAddressFile(content: string): Address[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = parseRow(lines[0], delimiter).map(normalizeHeader);
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));

  return lines.slice(1).map((line) => {
    const values = parseRow(line, delimiter);
    const get = (...keys: string[]): string => {
      for (const key of keys) {
        const idx = indexByHeader.get(normalizeHeader(key));
        if (idx !== undefined && values[idx]) return values[idx];
      }
      return "";
    };

    const fullName = get("fullname", "name");
    const simpleAddress = get("address");
    const simpleCityStateZip = get("citystatezip", "citypostcode");
    const fullNameParts = splitFullName(fullName);

    const address: Address = {
      ...EMPTY_ADDRESS,
      title: get("title"),
      firstName: get("firstname", "first") || fullNameParts.firstName,
      lastName: get("lastname", "last") || fullNameParts.lastName,
      suffix: get("suffix"),
      address1: get("address1", "addressline1") || simpleAddress,
      address2: get("address2", "addressline2"),
      city: get("city"),
      state: get("state", "county", "region"),
      postalCode: get("postalcode", "postcode", "zip"),
      country: get("country"),
    };

    if (!address.city && simpleCityStateZip) {
      address.city = simpleCityStateZip;
    }

    return address;
  });
}
