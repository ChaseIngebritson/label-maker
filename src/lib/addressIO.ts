import * as XLSX from "xlsx";
import type { Address, Region } from "../types";

const US_SAMPLE_ADDRESSES = [
  ["Title", "First Name", "Last Name", "Suffix", "Address 1", "Address 2", "City", "State", "Postal Code", "Country"],
  ["", "John", "Smith", "", "123 Main St", "", "New York", "NY", "10001", "USA"],
  ["Dr.", "Jane", "Doe", "PhD", "456 Oak Ave", "Suite 200", "Boston", "MA", "02101", "USA"],
];

const UK_SAMPLE_ADDRESSES = [
  ["Title", "First Name", "Last Name", "Suffix", "Address 1", "Address 2", "City", "County/Region", "Postcode", "Country"],
  ["", "James", "Smith", "", "10 Downing Street", "", "London", "", "SW1A 2AA", "United Kingdom"],
  ["Dr.", "Emma", "Williams", "PhD", "221B Baker Street", "Flat 2", "London", "", "NW1 6XE", "United Kingdom"],
];

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportAddressesCsv(addresses: Address[], filename: string): void {
  const header = [
    "Title",
    "First Name",
    "Last Name",
    "Suffix",
    "Address 1",
    "Address 2",
    "City",
    "State",
    "Postal Code",
    "Country",
  ];

  const rows = addresses.map((address) =>
    [
      address.title,
      address.firstName,
      address.lastName,
      address.suffix,
      address.address1,
      address.address2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ]
      .map((value) => csvEscape(value ?? ""))
      .join(","),
  );

  const csvText = [header.join(","), ...rows].join("\n");
  downloadBlob(new Blob([csvText], { type: "text/csv;charset=utf-8;" }), filename);
}

export function downloadExampleCsv(region: Region): void {
  const rows = region === "US" ? US_SAMPLE_ADDRESSES : UK_SAMPLE_ADDRESSES;
  const csvText = rows.map((row) => row.join(",")).join("\n");
  downloadBlob(new Blob([csvText], { type: "text/csv;charset=utf-8;" }), "example-addresses.csv");
}

export function downloadExampleExcel(region: Region): void {
  const rows = region === "US" ? US_SAMPLE_ADDRESSES : UK_SAMPLE_ADDRESSES;
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 15 },
    { wch: 15 },
    { wch: 8 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Addresses");
  XLSX.writeFile(workbook, "example-addresses.xlsx");
}

export function formatRegionExample(region: Region): string {
  if (region === "US") {
    return [
      "Expanded format (recommended):",
      "Title,First Name,Last Name,Suffix,Address 1,Address 2,City,State,Postal Code,Country",
      "Dr.,Jane,Doe,PhD,456 Oak Ave,Suite 200,Boston,MA,02101,USA",
      "",
      "Simple format (also works):",
      "Fullname,Address,City State Zip",
      "John Smith,123 Main St,New York NY 10001",
    ].join("\n");
  }
  return [
    "Expanded format (recommended):",
    "Title,First Name,Last Name,Suffix,Address 1,Address 2,City,County/Region,Postcode,Country",
    "Dr.,Emma,Williams,PhD,221B Baker Street,Flat 2,London,,NW1 6XE,United Kingdom",
    "",
    "Simple format (also works):",
    "Fullname,Address,City Postcode",
    "James Smith,10 Downing Street,London SW1A 2AA",
  ].join("\n");
}
