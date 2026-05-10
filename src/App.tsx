import {
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "../styles.css";
import "./app-shell.css";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import {
  downloadExampleCsv,
  downloadExampleExcel,
  exportAddressesCsv,
  formatRegionExample,
} from "./lib/addressIO";
import { parseAddressFile } from "./lib/csv";
import { generateLabelsPdf } from "./lib/pdf";
import { TEMPLATES_BY_REGION } from "./templates";
import type { Address, InputTab, LabelFont, Region } from "./types";

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

const ICON_SYMBOLS = {
  none: "",
  gift: "✦",
  heart: "♥",
  star: "★",
  snowflake: "❄",
  home: "⌂",
  mail: "✉",
  flower: "✿",
} as const;

const FONT_FAMILY_MAP: Record<LabelFont, string> = {
  helvetica: "Helvetica, Arial, sans-serif",
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
};

function copyAddress(address: Address): Address {
  return { ...address };
}

function hasMinimumAddressFields(address: Address): boolean {
  return Boolean(address.lastName.trim() && address.address1.trim() && address.city.trim());
}

function labelsPerPage(cols: number, rows: number): number {
  return cols * rows;
}

function buildDisplayName(address: Address): string {
  return [address.title, address.firstName, address.lastName, address.suffix]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatCityStatePostal(address: Address): string {
  return [address.city, address.state, address.postalCode].filter(Boolean).join(" ").trim();
}

function repeatAddress(address: Address, count: number): Address[] {
  return Array.from({ length: Math.max(0, count) }, () => copyAddress(address));
}

export default function App() {
  const [region, setRegion] = useLocalStorageState<Region>("labelMakerRegion", "US");
  const [tab, setTab] = useState<InputTab>("upload");
  const [templateId, setTemplateId] = useState<string>(TEMPLATES_BY_REGION.US[0].id);
  const [skipLabels, setSkipLabels] = useState<number>(0);

  const [manualAddresses, setManualAddresses] = useLocalStorageState<Address[]>(
    "labelMakerManualAddresses",
    [],
  );
  const [uploadedAddresses, setUploadedAddresses] = useLocalStorageState<Address[]>(
    "labelMakerUploadedAddresses",
    [],
  );
  const [returnAddress, setReturnAddress] = useLocalStorageState<Address>(
    "labelMakerReturnAddress",
    copyAddress(EMPTY_ADDRESS),
  );

  const [manualForm, setManualForm] = useState<Address>(copyAddress(EMPTY_ADDRESS));
  const [editingManualIndex, setEditingManualIndex] = useState<number | null>(null);
  const [editingManualDraft, setEditingManualDraft] = useState<Address>(copyAddress(EMPTY_ADDRESS));
  const [editingUploadIndex, setEditingUploadIndex] = useState<number | null>(null);
  const [editingUploadDraft, setEditingUploadDraft] = useState<Address>(copyAddress(EMPTY_ADDRESS));
  const [manualFullSheet, setManualFullSheet] = useState<boolean>(false);
  const [uploadFullSheet, setUploadFullSheet] = useState<boolean>(false);
  const [isUploadDragOver, setIsUploadDragOver] = useState<boolean>(false);

  const [returnFont, setReturnFont] = useState<LabelFont>("helvetica");
  const [returnIcon, setReturnIcon] = useState<keyof typeof ICON_SYMBOLS>("none");
  const [returnEmoji, setReturnEmoji] = useState<string>("");
  const [showIconOptions, setShowIconOptions] = useState<boolean>(false);

  const [status, setStatus] = useState<string>("");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const templates = TEMPLATES_BY_REGION[region];
  const template = useMemo(
    () => templates.find((item) => item.id === templateId) ?? templates[0],
    [templateId, templates],
  );
  const templateLabelCount = labelsPerPage(template.cols, template.rows);

  useEffect(() => {
    if (!templates.some((item) => item.id === templateId)) {
      setTemplateId(templates[0].id);
    }
  }, [templateId, templates]);

  const regionConfig = region === "US"
    ? {
        stateLabel: "State",
        postalLabel: "Postal Code",
        statePlaceholder: "NY",
        postalPlaceholder: "10001",
        cityPlaceholder: "New York",
        countryPlaceholder: "USA",
      }
    : {
        stateLabel: "County/Region",
        postalLabel: "Postcode",
        statePlaceholder: "Greater London",
        postalPlaceholder: "SW1A 2AA",
        cityPlaceholder: "London",
        countryPlaceholder: "United Kingdom",
      };

  function updateAddressField(
    setter: Dispatch<SetStateAction<Address>>,
    field: keyof Address,
    value: string,
  ) {
    setter((current) => ({ ...current, [field]: value }));
  }

  function onRegionChange(nextRegion: Region) {
    setRegion(nextRegion);
    setTemplateId(TEMPLATES_BY_REGION[nextRegion][0].id);
  }

  async function loadUploadedFile(file: File) {
    try {
      const content = await file.text();
      const parsed = parseAddressFile(content).filter(hasMinimumAddressFields);
      setUploadedAddresses(parsed);
      setStatus(`Loaded ${parsed.length} address${parsed.length === 1 ? "" : "es"} from file.`);
    } catch (error) {
      console.error(error);
      setStatus("Could not parse the selected file.");
    }
  }

  function onUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void loadUploadedFile(file);
  }

  function onUploadDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsUploadDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    void loadUploadedFile(file);
  }

  function beginManualEdit(index: number) {
    setEditingManualIndex(index);
    setEditingManualDraft(copyAddress(manualAddresses[index]));
  }

  function saveManualEdit(index: number) {
    if (!hasMinimumAddressFields(editingManualDraft)) {
      setStatus("Edited manual address is missing required fields.");
      return;
    }
    setManualAddresses((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? copyAddress(editingManualDraft) : item,
      ),
    );
    setEditingManualIndex(null);
    setStatus("Manual address updated.");
  }

  function beginUploadEdit(index: number) {
    setEditingUploadIndex(index);
    setEditingUploadDraft(copyAddress(uploadedAddresses[index]));
  }

  function saveUploadEdit(index: number) {
    if (!hasMinimumAddressFields(editingUploadDraft)) {
      setStatus("Edited uploaded address is missing required fields.");
      return;
    }
    setUploadedAddresses((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? copyAddress(editingUploadDraft) : item,
      ),
    );
    setEditingUploadIndex(null);
    setStatus("Uploaded address updated.");
  }

  function addManualAddress() {
    if (!hasMinimumAddressFields(manualForm)) {
      setStatus("Manual entries require last name, address line 1, and city.");
      return;
    }
    setManualAddresses((current) => [...current, copyAddress(manualForm)]);
    setManualForm(copyAddress(EMPTY_ADDRESS));
    setStatus("Address added.");
  }

  function getUploadPrintAddresses(): Address[] {
    if (uploadFullSheet && uploadedAddresses.length === 1) {
      return repeatAddress(uploadedAddresses[0], templateLabelCount - skipLabels);
    }
    return uploadedAddresses;
  }

  function getManualPrintAddresses(): Address[] {
    if (manualFullSheet && manualAddresses.length === 1) {
      return repeatAddress(manualAddresses[0], templateLabelCount - skipLabels);
    }
    return manualAddresses;
  }

  function generateUploadPdf() {
    const addresses = getUploadPrintAddresses();
    if (addresses.length === 0) {
      setStatus("Upload at least one address first.");
      return;
    }
    generateLabelsPdf({
      addresses,
      template,
      region,
      skipLabels,
      filename: `${template.id}-uploaded-labels.pdf`,
    });
    setStatus("Uploaded-address labels PDF generated.");
  }

  function generateManualPdf() {
    const addresses = getManualPrintAddresses();
    if (addresses.length === 0) {
      setStatus("Add at least one manual address first.");
      return;
    }
    generateLabelsPdf({
      addresses,
      template,
      region,
      skipLabels,
      filename: `${template.id}-manual-labels.pdf`,
    });
    setStatus("Manual labels PDF generated.");
  }

  function generateReturnPdf() {
    if (!hasMinimumAddressFields(returnAddress)) {
      setStatus("Return labels require last name, address line 1, and city.");
      return;
    }
    const fullSheet = repeatAddress(returnAddress, templateLabelCount - skipLabels);
    generateLabelsPdf({
      addresses: fullSheet,
      template,
      region,
      skipLabels,
      filename: `${template.id}-return-labels.pdf`,
      style: {
        font: returnFont,
        leadingSymbol: returnEmoji.trim() || ICON_SYMBOLS[returnIcon],
      },
    });
    setStatus("Return labels PDF generated.");
  }

  const uploadPages = Math.ceil((getUploadPrintAddresses().length + skipLabels) / templateLabelCount);
  const manualPages = Math.ceil((getManualPrintAddresses().length + skipLabels) / templateLabelCount);

  const previewSymbol = returnEmoji.trim() || ICON_SYMBOLS[returnIcon];
  const previewName = buildDisplayName(returnAddress);
  const previewCityLine = [returnAddress.city, returnAddress.state].filter(Boolean).join(", ");
  const previewPostalLine = [previewCityLine, returnAddress.postalCode].filter(Boolean).join(" ");

  return (
    <main className="app-shell">
      <div className="container">
        <h1>Free Label Maker for Addresses</h1>
        <p className="subtitle">
          Generate professional PDF address labels - Works with Avery and compatible brands
        </p>

        <div className="region-selector">
          <label>Paper Size:</label>
          <div className="region-toggle">
            <button className={region === "US" ? "active" : ""} onClick={() => onRegionChange("US")} type="button">
              US (Letter)
            </button>
            <button className={region === "UK" ? "active" : ""} onClick={() => onRegionChange("UK")} type="button">
              UK/EU (A4)
            </button>
          </div>
          <span className="region-info">
            {region === "US" ? 'Paper: 8.5" x 11" (Letter)' : "Paper: 210mm x 297mm (A4)"}
          </span>
        </div>

        <div className="template-selector">
          <label htmlFor="templateSelect">Select Label Template:</label>
          <select id="templateSelect" value={template.id} onChange={(event) => setTemplateId(event.target.value)}>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {item.description}
              </option>
            ))}
          </select>
        </div>

        <div className="skip-labels-section">
          <label htmlFor="skipLabels">Skip Labels:</label>
          <div className="skip-labels-control">
            <input
              id="skipLabels"
              min={0}
              max={templateLabelCount - 1}
              type="number"
              value={skipLabels}
              onChange={(event) => setSkipLabels(Math.max(0, Number(event.target.value || 0)))}
            />
            <button type="button" className="btn-reset-skip" onClick={() => setSkipLabels(0)}>
              Reset
            </button>
          </div>
        </div>

        <div className="input-tabs">
          <button className={`tab-button ${tab === "upload" ? "active" : ""}`} type="button" onClick={() => setTab("upload")}>
            Upload File
          </button>
          <button className={`tab-button ${tab === "manual" ? "active" : ""}`} type="button" onClick={() => setTab("manual")}>
            Manual Entry
          </button>
          <button className={`tab-button ${tab === "return" ? "active" : ""}`} type="button" onClick={() => setTab("return")}>
            Return Address
          </button>
        </div>

        {tab === "upload" && (
          <section className="input-section active">
            <div className="manual-entry">
              <div
                className={`drop-zone ${isUploadDragOver ? "dragover" : ""}`}
                onClick={() => uploadInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsUploadDragOver(true);
                }}
                onDragLeave={() => setIsUploadDragOver(false)}
                onDrop={onUploadDrop}
                role="button"
                tabIndex={0}
              >
                <div className="drop-zone-icon">📄</div>
                <div className="drop-zone-text">Drag and drop your CSV/TSV file here</div>
                <div className="drop-zone-hint">or click to browse</div>
                <input ref={uploadInputRef} className="file-input" type="file" accept=".csv,.tsv,.txt" onChange={onUploadFile} />
              </div>

              <div className="format-info">
                <h3>Expected File Format</h3>
                <div style={{ display: "flex", gap: 15, flexWrap: "wrap" }}>
                  <a href="#" className="download-example" onClick={(e) => { e.preventDefault(); downloadExampleCsv(region); }}>
                    Download example.csv
                  </a>
                  <a href="#" className="download-example" onClick={(e) => { e.preventDefault(); downloadExampleExcel(region); }}>
                    Download example.xlsx
                  </a>
                </div>
                <pre className="format-example">{formatRegionExample(region)}</pre>
              </div>

              <div className="preview-header">
                <h3>Preview Addresses</h3>
                <div className="preview-stats">
                  <span>{uploadedAddresses.length} addresses</span>
                  <span>{uploadPages || 0} pages</span>
                </div>
              </div>

              <div className="preview-list">
                {uploadedAddresses.map((address, index) => {
                  const isEditing = editingUploadIndex === index;
                  return (
                    <div key={`upload-${index}`} className={`preview-item ${isEditing ? "editing" : ""}`}>
                      <div className="preview-item-actions">
                        <button type="button" className="btn-edit" onClick={() => beginUploadEdit(index)}>Edit</button>
                        <button type="button" className="btn-delete" onClick={() => setUploadedAddresses((current) => current.filter((_, i) => i !== index))}>Delete</button>
                      </div>
                      <div className="preview-item-content">
                        <div className="preview-item-number">#{index + 1}</div>
                        <div className="preview-item-name">{buildDisplayName(address)}</div>
                        <div className="preview-item-details">{address.address1}</div>
                        {address.address2 && <div className="preview-item-details">{address.address2}</div>}
                        <div className="preview-item-details">{formatCityStatePostal(address)}</div>
                      </div>
                      <div className="edit-form">
                        <input value={editingUploadDraft.firstName} onChange={(e) => updateAddressField(setEditingUploadDraft, "firstName", e.target.value)} placeholder="First name" />
                        <input value={editingUploadDraft.lastName} onChange={(e) => updateAddressField(setEditingUploadDraft, "lastName", e.target.value)} placeholder="Last name" />
                        <input value={editingUploadDraft.address1} onChange={(e) => updateAddressField(setEditingUploadDraft, "address1", e.target.value)} placeholder="Address line 1" />
                        <input value={editingUploadDraft.address2} onChange={(e) => updateAddressField(setEditingUploadDraft, "address2", e.target.value)} placeholder="Address line 2" />
                        <input value={editingUploadDraft.city} onChange={(e) => updateAddressField(setEditingUploadDraft, "city", e.target.value)} placeholder="City" />
                        <div className="edit-form-buttons">
                          <button type="button" className="btn-save" onClick={() => saveUploadEdit(index)}>Save</button>
                          <button type="button" className="btn-cancel-edit" onClick={() => setEditingUploadIndex(null)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="full-sheet-option">
                <label>
                  <input type="checkbox" checked={uploadFullSheet} onChange={(e) => setUploadFullSheet(e.target.checked)} />
                  Fill entire sheet with the same address
                </label>
                <div className="full-sheet-hint">Creates {templateLabelCount} labels of the same address (when one address is present)</div>
              </div>

              <div className="preview-buttons">
                <button className="btn btn-cancel" type="button" onClick={() => setUploadedAddresses([])}>Clear</button>
                <button className="btn btn-generate" type="button" onClick={generateUploadPdf}>Generate PDF</button>
              </div>

              <div className="export-csv-section">
                <div className="export-csv-info">
                  <strong>Export Updated List</strong>
                  <p>Made edits? Export updated addresses to CSV.</p>
                </div>
                <button className="export-btn" type="button" onClick={() => exportAddressesCsv(uploadedAddresses, "updated-addresses.csv")}>
                  Export CSV
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "manual" && (
          <section className="input-section active">
            <div className="manual-entry">
              <h3>Add Address</h3>
              <div className="address-form">
                <div className="form-row name-row">
                  <div className="form-group">
                    <label htmlFor="manualTitle">Title</label>
                    <input id="manualTitle" value={manualForm.title} onChange={(e) => updateAddressField(setManualForm, "title", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="manualFirst">First Name</label>
                    <input id="manualFirst" value={manualForm.firstName} onChange={(e) => updateAddressField(setManualForm, "firstName", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="manualLast">Last Name *</label>
                    <input id="manualLast" value={manualForm.lastName} onChange={(e) => updateAddressField(setManualForm, "lastName", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="manualSuffix">Suffix</label>
                    <input id="manualSuffix" value={manualForm.suffix} onChange={(e) => updateAddressField(setManualForm, "suffix", e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="manualAddress1">Address Line 1 *</label>
                  <input id="manualAddress1" value={manualForm.address1} onChange={(e) => updateAddressField(setManualForm, "address1", e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="manualAddress2">Address Line 2</label>
                  <input id="manualAddress2" value={manualForm.address2} onChange={(e) => updateAddressField(setManualForm, "address2", e.target.value)} />
                </div>
                <div className="form-row four-col">
                  <div className="form-group">
                    <label htmlFor="manualCity">City *</label>
                    <input id="manualCity" placeholder={regionConfig.cityPlaceholder} value={manualForm.city} onChange={(e) => updateAddressField(setManualForm, "city", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="manualState">{regionConfig.stateLabel}</label>
                    <input id="manualState" placeholder={regionConfig.statePlaceholder} value={manualForm.state} onChange={(e) => updateAddressField(setManualForm, "state", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="manualPostalCode">{regionConfig.postalLabel}</label>
                    <input id="manualPostalCode" placeholder={regionConfig.postalPlaceholder} value={manualForm.postalCode} onChange={(e) => updateAddressField(setManualForm, "postalCode", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="manualCountry">Country</label>
                    <input id="manualCountry" placeholder={regionConfig.countryPlaceholder} value={manualForm.country} onChange={(e) => updateAddressField(setManualForm, "country", e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-buttons">
                <button className="btn btn-primary" onClick={addManualAddress} type="button">Add Address</button>
                <button className="btn btn-secondary" onClick={() => setManualForm(copyAddress(EMPTY_ADDRESS))} type="button">Clear Form</button>
              </div>

              <div className="preview-header">
                <h3>Your Addresses</h3>
                <div className="preview-stats">
                  <span>{manualAddresses.length} addresses</span>
                  <span>{manualPages || 0} pages</span>
                </div>
              </div>
              <div className="preview-list">
                {manualAddresses.map((address, index) => {
                  const isEditing = editingManualIndex === index;
                  return (
                    <div key={`manual-${index}`} className={`preview-item ${isEditing ? "editing" : ""}`}>
                      <div className="preview-item-actions">
                        <button type="button" className="btn-edit" onClick={() => beginManualEdit(index)}>Edit</button>
                        <button type="button" className="btn-delete" onClick={() => setManualAddresses((current) => current.filter((_, i) => i !== index))}>Delete</button>
                      </div>
                      <div className="preview-item-content">
                        <div className="preview-item-number">#{index + 1}</div>
                        <div className="preview-item-name">{buildDisplayName(address)}</div>
                        <div className="preview-item-details">{address.address1}</div>
                        {address.address2 && <div className="preview-item-details">{address.address2}</div>}
                        <div className="preview-item-details">{formatCityStatePostal(address)}</div>
                      </div>
                      <div className="edit-form">
                        <input value={editingManualDraft.firstName} onChange={(e) => updateAddressField(setEditingManualDraft, "firstName", e.target.value)} placeholder="First name" />
                        <input value={editingManualDraft.lastName} onChange={(e) => updateAddressField(setEditingManualDraft, "lastName", e.target.value)} placeholder="Last name" />
                        <input value={editingManualDraft.address1} onChange={(e) => updateAddressField(setEditingManualDraft, "address1", e.target.value)} placeholder="Address line 1" />
                        <input value={editingManualDraft.address2} onChange={(e) => updateAddressField(setEditingManualDraft, "address2", e.target.value)} placeholder="Address line 2" />
                        <input value={editingManualDraft.city} onChange={(e) => updateAddressField(setEditingManualDraft, "city", e.target.value)} placeholder="City" />
                        <div className="edit-form-buttons">
                          <button type="button" className="btn-save" onClick={() => saveManualEdit(index)}>Save</button>
                          <button type="button" className="btn-cancel-edit" onClick={() => setEditingManualIndex(null)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="full-sheet-option">
                <label>
                  <input type="checkbox" checked={manualFullSheet} onChange={(e) => setManualFullSheet(e.target.checked)} />
                  Fill entire sheet with the same address
                </label>
                <div className="full-sheet-hint">Creates {templateLabelCount} labels of the same address (when one address is present)</div>
              </div>

              <div className="preview-buttons">
                <button className="btn btn-cancel" type="button" onClick={() => setManualAddresses([])}>Clear All</button>
                <button className="btn btn-generate" type="button" onClick={generateManualPdf}>Generate PDF</button>
              </div>

              <div className="export-csv-section">
                <div className="export-csv-info">
                  <strong>Save for Next Time</strong>
                  <p>Export your addresses to reuse next time.</p>
                </div>
                <button className="export-btn" type="button" onClick={() => exportAddressesCsv(manualAddresses, "my-addresses.csv")}>
                  Export CSV
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "return" && (
          <section className="input-section active">
            <div className="manual-entry">
              <h3>Create Return Address Labels</h3>
              <div className="address-form">
                <div className="form-row name-row">
                  <div className="form-group">
                    <label htmlFor="returnTitle">Title</label>
                    <input id="returnTitle" value={returnAddress.title} onChange={(e) => updateAddressField(setReturnAddress, "title", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="returnFirst">First Name</label>
                    <input id="returnFirst" value={returnAddress.firstName} onChange={(e) => updateAddressField(setReturnAddress, "firstName", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="returnLast">Last Name *</label>
                    <input id="returnLast" value={returnAddress.lastName} onChange={(e) => updateAddressField(setReturnAddress, "lastName", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="returnSuffix">Suffix</label>
                    <input id="returnSuffix" value={returnAddress.suffix} onChange={(e) => updateAddressField(setReturnAddress, "suffix", e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="returnAddress1">Address Line 1 *</label>
                  <input id="returnAddress1" value={returnAddress.address1} onChange={(e) => updateAddressField(setReturnAddress, "address1", e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="returnAddress2">Address Line 2</label>
                  <input id="returnAddress2" value={returnAddress.address2} onChange={(e) => updateAddressField(setReturnAddress, "address2", e.target.value)} />
                </div>
                <div className="form-row four-col">
                  <div className="form-group">
                    <label htmlFor="returnCity">City *</label>
                    <input id="returnCity" placeholder={regionConfig.cityPlaceholder} value={returnAddress.city} onChange={(e) => updateAddressField(setReturnAddress, "city", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="returnState">{regionConfig.stateLabel}</label>
                    <input id="returnState" placeholder={regionConfig.statePlaceholder} value={returnAddress.state} onChange={(e) => updateAddressField(setReturnAddress, "state", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="returnPostalCode">{regionConfig.postalLabel}</label>
                    <input id="returnPostalCode" placeholder={regionConfig.postalPlaceholder} value={returnAddress.postalCode} onChange={(e) => updateAddressField(setReturnAddress, "postalCode", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="returnCountry">Country</label>
                    <input id="returnCountry" placeholder={regionConfig.countryPlaceholder} value={returnAddress.country} onChange={(e) => updateAddressField(setReturnAddress, "country", e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="font-selector-row">
                <label htmlFor="returnFont">Font:</label>
                <select id="returnFont" value={returnFont} onChange={(event) => setReturnFont(event.target.value as LabelFont)}>
                  <option value="helvetica">Helvetica (Default)</option>
                  <option value="times">Times New Roman</option>
                  <option value="courier">Courier (Monospace)</option>
                </select>
                <span className="font-preview-text" style={{ fontFamily: FONT_FAMILY_MAP[returnFont] }}>
                  This is the font you are selecting.
                </span>
              </div>

              <div className="icon-options-section">
                <div
                  className="icon-options-header"
                  onClick={() => setShowIconOptions((current) => !current)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="icon-options-title">Icon and emoji</span>
                  <span className="icon-options-toggle">{showIconOptions ? "−" : "+"}</span>
                </div>
                {showIconOptions && (
                  <div className="icon-options-content">
                    <p className="icon-options-info">Choose a decorative symbol for return labels.</p>
                    <div className="icon-option-group">
                      <label htmlFor="returnIcon">Icon:</label>
                      <select id="returnIcon" value={returnIcon} onChange={(event) => setReturnIcon(event.target.value as keyof typeof ICON_SYMBOLS)}>
                        <option value="none">None</option>
                        <option value="gift">Gift</option>
                        <option value="heart">Heart</option>
                        <option value="star">Star</option>
                        <option value="snowflake">Snowflake</option>
                        <option value="home">Home</option>
                        <option value="mail">Mail</option>
                        <option value="flower">Flower</option>
                      </select>
                    </div>
                    <div className="icon-option-group">
                      <label htmlFor="returnEmoji">Emoji:</label>
                      <input id="returnEmoji" type="text" placeholder="Optional emoji (overrides icon)" value={returnEmoji} onChange={(event) => setReturnEmoji(event.target.value.slice(0, 2))} />
                    </div>
                  </div>
                )}
              </div>

              <div className="label-preview-section">
                <div className="label-preview-header">
                  <h4>Label Preview</h4>
                  <span className="preview-hint">Live preview of return label content</span>
                </div>
                <div className="label-preview-container">
                  <div className="label-preview">
                    {previewSymbol && (
                      <div className="preview-icon" style={{ left: 8, top: 12 }}>
                        <span>{previewSymbol}</span>
                      </div>
                    )}
                    <div
                      className="preview-text"
                      style={{
                        left: previewSymbol ? 36 : 8,
                        top: 10,
                        right: 8,
                        fontFamily: FONT_FAMILY_MAP[returnFont],
                      }}
                    >
                      <div className="preview-name">{previewName || "Your Name"}</div>
                      <div className="preview-address">{returnAddress.address1 || "123 Main Street"}</div>
                      {returnAddress.address2 && <div className="preview-address">{returnAddress.address2}</div>}
                      <div className="preview-city">{previewPostalLine || "City, State 12345"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="preview-buttons">
                <button className="btn btn-generate" type="button" onClick={generateReturnPdf}>Generate Full Sheet</button>
                <button className="btn btn-secondary" type="button" onClick={() => setReturnAddress(copyAddress(EMPTY_ADDRESS))}>Clear</button>
              </div>
            </div>
          </section>
        )}

        {status && <div className="status success">{status}</div>}
      </div>
    </main>
  );
}
