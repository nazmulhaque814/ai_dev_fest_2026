const requirementsInput =
  document.getElementById("requirementsInput");

const documentsInput =
  document.getElementById("documentsInput");

const tenderSection =
  document.getElementById("tenderSection");

const documentsSection =
  document.getElementById("documentsSection");


// Hide sections when app starts
tenderSection.style.display = "none";
documentsSection.style.display = "none";


// Load requirements.json
requirementsInput.addEventListener("change", async (event) => {

  const file = event.target.files[0];

  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    showTender(data);

  } catch (error) {
    alert("Invalid requirements.json file.");
  }
});


// Upload PDF documents
documentsInput.addEventListener("change", (event) => {

  const files = [...event.target.files];

  const invalid = files.filter(
    file => file.type !== "application/pdf"
  );

  if (invalid.length > 0) {
    alert("Only PDF files are allowed.");
    documentsInput.value = "";
    return;
  }

  showDocuments(files);
});


// Show tender information
function showTender(data) {

  tenderSection.style.display = "block";

  const tender = data.tender || {};
  const requirements = data.requirements || [];

  document.getElementById("tenderTitle").textContent =
    tender.title || "Tender Details";

  document.getElementById("tenderInfo").textContent =
    tender.tender_id || "";

  document.getElementById("tenderDetails").innerHTML = `
    <div class="detail-box">
      <span>Tender ID</span>
      <strong>${tender.tender_id || "-"}</strong>
    </div>

    <div class="detail-box">
      <span>Procuring Entity</span>
      <strong>${tender.procuring_entity || "-"}</strong>
    </div>

    <div class="detail-box">
      <span>Bidder</span>
      <strong>${tender.bidder || "-"}</strong>
    </div>

    <div class="detail-box">
      <span>Submission Deadline</span>
      <strong>${tender.submission_deadline || "-"}</strong>
    </div>
  `;

  const list =
    document.getElementById("requirementsList");

  list.innerHTML = "";

  requirements
    .sort((a, b) => a.order - b.order)
    .forEach(item => {

      const row = document.createElement("div");

      row.className = "requirement-row";

      row.innerHTML = `
        <div class="order-number">
          ${item.order}
        </div>

        <div class="requirement-info">
          <strong>${item.title_en}</strong>

          <br>

          <small>
            ${
              item.has_expiry
                ? "Expiry date required"
                : "No expiry check"
            }
          </small>
        </div>

        <span class="${
          item.mandatory ? "required" : "optional"
        }">
          ${
            item.mandatory
              ? "REQUIRED"
              : "OPTIONAL"
          }
        </span>
      `;

      list.appendChild(row);
    });
}


// Show uploaded documents
function showDocuments(files) {

  documentsSection.style.display = "block";

  document.getElementById("documentCount").textContent =
    `${files.length} document(s)`;

  const list =
    document.getElementById("documentsList");

  list.innerHTML = "";

  files.forEach(file => {

    const item = document.createElement("div");

    item.style.padding = "12px 0";
    item.style.borderBottom = "1px solid #eee";

    item.innerHTML = `
      📄 <strong>${file.name}</strong>

      <span style="color:#667085">
        ${(file.size / 1024 / 1024).toFixed(2)} MB
      </span>
    `;

    list.appendChild(item);
  });
}