const requirementsInput =
  document.getElementById("requirementsInput");

const documentsInput =
  document.getElementById("documentsInput");

const tenderSection =
  document.getElementById("tenderSection");

const documentsSection =
  document.getElementById("documentsSection");

let uploadedDocuments = [];
let currentRequirements = [];
let matches = {};
let expiryDates = {};
let currentTender = {};

const MAX_FILES = 30;
const MAX_SIZE = 50 * 1024 * 1024;


// ===============================
// INITIAL SETUP
// ===============================

tenderSection.style.display = "none";
documentsSection.style.display = "none";


// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


// ===============================
// LOAD REQUIREMENTS.JSON
// ===============================

requirementsInput.addEventListener(
  "change",
  async (event) => {

    const file = event.target.files[0];

    if (!file) return;

    try {

      const text = await file.text();

      const data = JSON.parse(text);

      showTender(data);

    } catch (error) {

      console.error(error);

      alert("Invalid requirements.json file.");

    }

  }
);


// ===============================
// PDF UPLOAD
// ===============================

documentsInput.addEventListener(
  "change",
  async (event) => {

    const files = [...event.target.files];

    if (!files.length) return;


    // Maximum file count
    if (
      uploadedDocuments.length + files.length >
      MAX_FILES
    ) {

      alert(
        "You can upload maximum 30 PDF files."
      );

      documentsInput.value = "";

      return;

    }


    // PDF validation
    const invalid = files.filter(
      file =>
        file.type !== "application/pdf" &&
        !file.name
          .toLowerCase()
          .endsWith(".pdf")
    );


    if (invalid.length > 0) {

      alert("Only PDF files are allowed.");

      documentsInput.value = "";

      return;

    }


    // Total size validation
    const newSize =
      files.reduce(
        (total, file) =>
          total + file.size,
        0
      );


    const currentSize =
      uploadedDocuments.reduce(
        (total, item) =>
          total + item.file.size,
        0
      );


    if (
      currentSize + newSize >
      MAX_SIZE
    ) {

      alert(
        "Total PDF size cannot exceed 50 MB."
      );

      documentsInput.value = "";

      return;

    }


    // Process every PDF
    for (const file of files) {

      try {

        const buffer =
          await file.arrayBuffer();


        const pdf =
          await pdfjsLib
            .getDocument({
              data: buffer
            })
            .promise;


        // Exact content hash
        const hash =
          await getFileHash(file);


        // Check if same content already exists
        const existing =
          uploadedDocuments.find(
            item => item.hash === hash
          );


        uploadedDocuments.push({

          file: file,

          pages: pdf.numPages,

          hash: hash,

          // First copy is usable.
          // Later copies are duplicates.
          duplicate: !!existing

        });


      } catch (error) {

        console.error(error);

        alert(
          `Could not read ${file.name}.`
        );

      }

    }


    renderDocuments();

    documentsInput.value = "";

  }
);


// ===============================
// SHA-256 FILE HASH
// ===============================

async function getFileHash(file) {

  const buffer =
    await file.arrayBuffer();


  const hashBuffer =
    await crypto.subtle.digest(
      "SHA-256",
      buffer
    );


  return Array.from(
    new Uint8Array(hashBuffer)
  )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");

}


// ===============================
// SHOW TENDER
// ===============================

function showTender(data) {

  tenderSection.style.display =
    "block";


  currentTender =
    data.tender || {};


  currentRequirements =
    Array.isArray(data.requirements)
      ? data.requirements
      : [];


  matches = {};

  expiryDates = {};


  window.currentTenderDeadline =
    currentTender.submission_deadline || "";


  document.getElementById(
    "tenderTitle"
  ).textContent =
    currentTender.title ||
    "Tender Details";


  document.getElementById(
    "tenderInfo"
  ).textContent =
    currentTender.tender_id || "";


  document.getElementById(
    "tenderDetails"
  ).innerHTML = `

    <div class="detail-box">
      <span>Tender ID</span>
      <strong>
        ${currentTender.tender_id || "-"}
      </strong>
    </div>

    <div class="detail-box">
      <span>Procuring Entity</span>
      <strong>
        ${currentTender.procuring_entity || "-"}
      </strong>
    </div>

    <div class="detail-box">
      <span>Bidder</span>
      <strong>
        ${currentTender.bidder || "-"}
      </strong>
    </div>

    <div class="detail-box">
      <span>Submission Deadline</span>
      <strong>
        ${
          currentTender.submission_deadline ||
          "-"
        }
      </strong>
    </div>

  `;


  renderRequirements();

  ensurePackageAction();

}


// ===============================
// DOCUMENT LIST
// ===============================

function renderDocuments() {

  documentsSection.style.display =
    "block";


  document.getElementById(
    "documentCount"
  ).textContent =
    `${uploadedDocuments.length} document(s)`;


  const list =
    document.getElementById(
      "documentsList"
    );


  list.innerHTML = "";


  uploadedDocuments.forEach(
    (item, index) => {

      const row =
        document.createElement("div");


      row.className =
        "document-row";


      row.innerHTML = `

        <div class="document-icon">
          📄
        </div>

        <div class="document-info">

          <strong>
            ${escapeHtml(
              item.file.name
            )}
          </strong>

          <small>
            ${item.pages} page(s)
            •
            ${formatSize(
              item.file.size
            )}
          </small>

          ${
            item.duplicate
              ? `
                <small
                  class="duplicate-file"
                >
                  ⚠ Duplicate file content
                </small>
              `
              : ""
          }

        </div>

        <button
          class="remove-btn"
          onclick="removeDocument(${index})"
        >
          Remove
        </button>

      `;


      list.appendChild(row);

    }
  );


  renderRequirements();

}


// ===============================
// REMOVE DOCUMENT
// ===============================

function removeDocument(index) {

  const removed =
    uploadedDocuments[index];


  if (!removed) return;


  // Remove matching requirements
  Object.keys(matches)
    .forEach(requirementId => {

      if (
        matches[requirementId] === index
      ) {

        delete matches[requirementId];

        delete expiryDates[
          requirementId
        ];

      }

    });


  uploadedDocuments.splice(
    index,
    1
  );


  // Fix indexes after removal
  Object.keys(matches)
    .forEach(requirementId => {

      if (
        matches[requirementId] >
        index
      ) {

        matches[requirementId]--;

      }

    });


  // If a duplicate was removed,
  // the next identical file becomes usable.
  promoteFirstDuplicate(
    removed.hash
  );


  renderDocuments();

}


// ===============================
// PROMOTE DUPLICATE
// ===============================

function promoteFirstDuplicate(hash) {

  const sameFiles =
    uploadedDocuments.filter(
      item => item.hash === hash
    );


  sameFiles.forEach(
    (item, index) => {

      item.duplicate =
        index > 0;

    }
  );

}


// ===============================
// FILE SIZE
// ===============================

function formatSize(bytes) {

  return (
    bytes /
    (1024 * 1024)
  ).toFixed(2) + " MB";

}


// ===============================
// REQUIREMENTS
// ===============================

function renderRequirements() {

  const list =
    document.getElementById(
      "requirementsList"
    );


  if (!list) return;


  list.innerHTML = "";


  currentRequirements
    .sort(
      (a, b) =>
        Number(a.order) -
        Number(b.order)
    )
    .forEach(item => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "requirement-row";


      const selected =
        matches[item.id] ??
        "";


      const status =
        getRequirementStatus(
          item
        );


      // Build PDF options
      const options =
        uploadedDocuments
          .map(
            (doc, index) => {

              // Duplicate cannot be matched
              if (doc.duplicate) {

                return `

                  <option
                    value="${index}"
                    disabled
                  >
                    ${escapeHtml(
                      doc.file.name
                    )}
                    — Duplicate
                  </option>

                `;

              }


              const used =
                Object.values(
                  matches
                ).includes(index) &&
                matches[item.id] !==
                  index;


              return `

                <option
                  value="${index}"
                  ${
                    used
                      ? "disabled"
                      : ""
                  }
                  ${
                    selected === index
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(
                    doc.file.name
                  )}
                </option>

              `;

            }
          )
          .join("");


      // Expiry input
      let expiryHTML = "";


      if (
        item.has_expiry &&
        selected !== ""
      ) {

        expiryHTML = `

          <div class="expiry-box">

            <label>
              Expiry Date
            </label>

            <input
              type="date"
              value="${
                expiryDates[item.id] ||
                ""
              }"
              onchange="
                setExpiryDate(
                  '${item.id}',
                  this.value
                )
              "
            >

          </div>

        `;

      }


      row.innerHTML = `

        <div class="order-number">
          ${item.order}
        </div>


        <div class="requirement-info">

          <strong>
            ${escapeHtml(
              item.title_en ||
              item.title ||
              "Document"
            )}
          </strong>

          <small>

            ${
              item.mandatory
                ? "Required"
                : "Optional"
            }

          </small>

          ${expiryHTML}

        </div>


        <select
          class="match-select"
          onchange="
            matchDocument(
              '${item.id}',
              this.value
            )
          "
        >

          <option value="">
            Select PDF
          </option>

          ${options}

        </select>


        <span
          class="
            status-badge
            status-${status.className}
          "
        >
          ${status.label}
        </span>

      `;


      list.appendChild(row);

    });


  updateGenerateButton();

}


// ===============================
// MATCH DOCUMENT
// ===============================

function matchDocument(
  requirementId,
  value
) {

  if (value === "") {

    delete matches[
      requirementId
    ];

    delete expiryDates[
      requirementId
    ];

  } else {

    const index =
      Number(value);


    const document =
      uploadedDocuments[index];


    // Safety check:
    // duplicate files cannot be matched
    if (
      !document ||
      document.duplicate
    ) {

      alert(
        "Duplicate files cannot be matched."
      );

      return;

    }


    // Prevent same PDF from being used
    // for another requirement
    const alreadyUsed =
      Object.keys(matches)
        .some(
          id =>
            id !== requirementId &&
            matches[id] === index
        );


    if (alreadyUsed) {

      alert(
        "This PDF is already matched to another requirement."
      );

      return;

    }


    matches[
      requirementId
    ] = index;

  }


  renderRequirements();

}


// ===============================
// EXPIRY DATE
// ===============================

function setExpiryDate(
  requirementId,
  value
) {

  if (!value) {

    delete expiryDates[
      requirementId
    ];

  } else {

    expiryDates[
      requirementId
    ] = value;

  }


  renderRequirements();

}


// ===============================
// STATUS SYSTEM
// ===============================

function getRequirementStatus(
  item
) {

  const matched =
    matches[item.id] !==
    undefined;


  // Optional + no file
  if (
    !matched &&
    !item.mandatory
  ) {

    return {

      label: "Not provided",

      className:
        "not-provided"

    };

  }


  // Required + no file
  if (
    !matched &&
    item.mandatory
  ) {

    return {

      label: "Missing",

      className:
        "missing"

    };

  }


  // Expiry required
  // but no expiry date
  if (
    matched &&
    item.has_expiry &&
    !expiryDates[item.id]
  ) {

    return {

      label:
        "Expiry date needed",

      className:
        "expiry-needed"

    };

  }


  // Check expiry
  if (
    matched &&
    item.has_expiry &&
    expiryDates[item.id]
  ) {

    const deadline =
      getSubmissionDeadline();


    const expiry =
      parseDateOnly(
        expiryDates[item.id]
      );


    if (
      deadline &&
      expiry &&
      expiry < deadline
    ) {

      return {

        label: "Expired",

        className:
          "expired"

      };

    }

  }


  return {

    label: "OK",

    className: "ok"

  };

}


// ===============================
// DATE HELPERS
// ===============================

function parseDateOnly(
  value
) {

  if (!value) return null;


  const parts =
    value.split("-");


  if (parts.length !== 3) {
    return null;
  }


  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]) - 1;

  const day =
    Number(parts[2]);


  const date =
    new Date(
      year,
      month,
      day
    );


  date.setHours(
    23,
    59,
    59,
    999
  );


  return date;

}


// ===============================
// SUBMISSION DEADLINE
// ===============================

function getSubmissionDeadline() {

  const value =
    currentTender.submission_deadline;


  if (!value) {
    return null;
  }


  // YYYY-MM-DD
  const match =
    String(value).match(
      /(\d{4})-(\d{2})-(\d{2})/
    );


  if (match) {

    return parseDateOnly(
      `${match[1]}-${match[2]}-${match[3]}`
    );

  }


  // Fallback for other date formats
  const date =
    new Date(value);


  if (
    isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  date.setHours(
    23,
    59,
    59,
    999
  );


  return date;

}


// ===============================
// GENERATE BUTTON
// ===============================

function ensurePackageAction() {

  let action =
    document.getElementById(
      "packageAction"
    );


  if (action) return;


  action =
    document.createElement(
      "div"
    );


  action.id =
    "packageAction";


  action.className =
    "package-action";


  action.innerHTML = `

    <div id="packageStatus">
      Complete all required
      documents to generate
      the package.
    </div>

    <button
      id="generateBtn"
      disabled
    >
      📦 Generate Package
    </button>

  `;


  const list =
    document.getElementById(
      "requirementsList"
    );


  list.parentElement.appendChild(
    action
  );


  document
    .getElementById(
      "generateBtn"
    )
    .addEventListener(
      "click",
      generatePackage
    );


  updateGenerateButton();

}


// ===============================
// UPDATE GENERATE BUTTON
// ===============================

function updateGenerateButton() {

  const button =
    document.getElementById(
      "generateBtn"
    );


  const status =
    document.getElementById(
      "packageStatus"
    );


  if (!button || !status) {
    return;
  }


  const blocking =
    currentRequirements.some(
      item => {

        const result =
          getRequirementStatus(
            item
          );


        return (
          result.className ===
            "missing" ||

          result.className ===
            "expiry-needed" ||

          result.className ===
            "expired"
        );

      }
    );


  if (blocking) {

    button.disabled = true;

    status.textContent =
      "⚠ Complete all blocking requirements first.";

  } else {

    button.disabled = false;

    status.textContent =
      "✓ All required documents are ready.";

  }

}


// ===============================
// LOAD PDF-LIB
// ===============================

function loadPdfLib() {

  if (window.PDFLib) {

    return Promise.resolve();

  }


  return new Promise(
    (resolve, reject) => {

      const script =
        document.createElement(
          "script"
        );


      script.src =
        "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";


      script.onload =
        () => resolve();


      script.onerror =
        () =>
          reject(
            new Error(
              "Could not load PDF library."
            )
          );


      document.head.appendChild(
        script
      );

    }
  );

}


// ===============================
// GENERATE COMPLETE PDF PACKAGE
// ===============================

async function generatePackage() {

  try {

    // Final status validation
    const blocking =
      currentRequirements.some(
        item => {

          const result =
            getRequirementStatus(
              item
            );


          return (
            result.className ===
              "missing" ||

            result.className ===
              "expiry-needed" ||

            result.className ===
              "expired"
          );

        }
      );


    if (blocking) {

      alert(
        "Please complete all required documents first."
      );

      return;

    }


    await loadPdfLib();


    const {
      PDFDocument,
      StandardFonts,
      rgb
    } = PDFLib;


    const pdfDoc =
      await PDFDocument.create();


    const font =
      await pdfDoc.embedFont(
        StandardFonts.Helvetica
      );


    // =========================
    // COVER PAGE
    // =========================

    const cover =
      pdfDoc.addPage();


    const {
      width,
      height
    } = cover.getSize();


    const tenderId =
      currentTender.tender_id ||
      "Tender";


    const title =
      currentTender.title ||
      "Tender Package";


    const entity =
      currentTender.procuring_entity ||
      "-";


    const bidder =
      currentTender.bidder ||
      "-";


    const deadline =
      currentTender.submission_deadline ||
      "-";


    const packageDate =
      new Date()
        .toLocaleDateString();


    cover.drawText(
      "Tender Document Package",
      {
        x: 50,
        y: height - 80,
        size: 24,
        font: font
      }
    );


    cover.drawText(
      `Tender ID: ${tenderId}`,
      {
        x: 50,
        y: height - 130,
        size: 14,
        font: font
      }
    );


    cover.drawText(
      `Title: ${title}`,
      {
        x: 50,
        y: height - 160,
        size: 14,
        font: font
      }
    );


    cover.drawText(
      `Procuring Entity: ${entity}`,
      {
        x: 50,
        y: height - 190,
        size: 14,
        font: font
      }
    );


    cover.drawText(
      `Bidder: ${bidder}`,
      {
        x: 50,
        y: height - 220,
        size: 14,
        font: font
      }
    );


    cover.drawText(
      `Submission Deadline: ${deadline}`,
      {
        x: 50,
        y: height - 250,
        size: 14,
        font: font
      }
    );


    cover.drawText(
      `Package Date: ${packageDate}`,
      {
        x: 50,
        y: height - 280,
        size: 14,
        font: font
      }
    );


    cover.drawText(
      "Included Documents",
      {
        x: 50,
        y: height - 340,
        size: 17,
        font: font
      }
    );


    let coverY =
      height - 370;


    const sortedRequirements =
      [...currentRequirements]
        .sort(
          (a, b) =>
            Number(a.order) -
            Number(b.order)
        );


    for (
      const item
      of sortedRequirements
    ) {

      const index =
        matches[item.id];


      if (
        index === undefined
      ) {

        continue;

      }


      const document =
        uploadedDocuments[index];


      if (
        !document ||
        document.duplicate
      ) {

        continue;

      }


      cover.drawText(
        `${item.order}. ${
          item.title_en ||
          item.title ||
          "Document"
        }`,
        {
          x: 65,
          y: coverY,
          size: 11,
          font: font
        }
      );


      coverY -= 20;


      // Avoid overflowing cover page
      if (coverY < 70) {

        break;

      }

    }


    // =========================
    // ADD DOCUMENT PAGES
    // =========================

    for (
      const item
      of sortedRequirements
    ) {

      const index =
        matches[item.id];


      // Optional unmatched:
      // skip it.
      if (
        index === undefined
      ) {

        continue;

      }


      const document =
        uploadedDocuments[index];


      if (
        !document ||
        document.duplicate
      ) {

        continue;

      }


      const bytes =
        await document.file.arrayBuffer();


      const sourcePdf =
        await PDFDocument.load(
          bytes
        );


      const pageIndices =
        sourcePdf.getPageIndices();


      const pages =
        await pdfDoc.copyPages(
          sourcePdf,
          pageIndices
        );


      pages.forEach(
        page => {

          pdfDoc.addPage(page);

        }
      );

    }


    // =========================
    // PAGE FOOTERS
    // =========================

    const pages =
      pdfDoc.getPages();


    const totalPages =
      pages.length;


    pages.forEach(
      (page, index) => {

        page.drawText(
          `${tenderId} | Page ${
            index + 1
          } of ${totalPages}`,
          {
            x: 40,
            y: 20,
            size: 9,
            font: font,
            color: rgb(
              0.3,
              0.3,
              0.3
            )
          }
        );

      }
    );


    // =========================
    // DOWNLOAD
    // =========================

    const finalPdf =
      await pdfDoc.save();


    const blob =
      new Blob(
        [finalPdf],
        {
          type:
            "application/pdf"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        "a"
      );


    link.href = url;


    link.download =
      `${tenderId}_Package.pdf`;


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1000
    );


    alert(
      "Tender package generated successfully."
    );


  } catch (error) {

    console.error(
      "Package generation error:",
      error
    );


    alert(
      "Could not generate the PDF package."
    );

  }

}


// ===============================
// HTML SAFETY
// ===============================

function escapeHtml(value) {

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}