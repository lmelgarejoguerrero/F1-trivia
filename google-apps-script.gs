const SHEET_NAME = "Registros";
const HEADERS = [
  "id",
  "nombre",
  "apellido",
  "email",
  "telefono",
];

function doGet() {
  const params = arguments[0]?.parameter || {};

  if (hasLeadData_(params)) {
    return saveLead_(params);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sheet: SHEET_NAME, fields: HEADERS }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  return saveLead_(payload);
}

function getOrCreateSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  return sheet;
}

function getNextId_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return 1;
  }

  const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const maxId = idValues.reduce((currentMax, value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > currentMax ? numericValue : currentMax;
  }, 0);

  return maxId + 1;
}

function hasLeadData_(payload) {
  return Boolean(payload.firstName || payload.lastName || payload.email || payload.phone);
}

function saveLead_(payload) {
  const sheet = getOrCreateSheet_();
  const nextId = getNextId_(sheet);

  sheet.appendRow([
    nextId,
    payload.firstName || "",
    payload.lastName || "",
    payload.email || "",
    payload.phone || "",
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, id: nextId }))
    .setMimeType(ContentService.MimeType.JSON);
}
