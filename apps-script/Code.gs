// Seceda Homebrew POS -> Google Sheets receiver.
// Paste into Extensions > Apps Script of your sheet, then Deploy > New deployment >
// Web app (Execute as: Me, Who has access: Anyone). Copy the /exec URL into the POS settings.

var SHEET_NAME = 'Sales';
var HEADER = ['order_no', 'date', 'time', 'item', 'qty', 'unit_price', 'addons', 'addons_price',
              'line_total', 'order_total', 'payment', 'status', 'order_id'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getSheet_();
    var ids = {};
    data.orders.forEach(function (o) { ids[o.order_id] = true; });

    // Upsert: drop any existing rows for these orders (e.g. a retry or a void), then append.
    var last = sheet.getLastRow();
    if (last > 1 && data.orders.length) {
      var col = sheet.getRange(2, HEADER.length, last - 1, 1).getValues();
      for (var r = col.length - 1; r >= 0; r--) {
        if (ids[col[r][0]]) sheet.deleteRow(r + 2);
      }
    }
    var rows = [];
    data.orders.forEach(function (o) { rows = rows.concat(o.rows); });
    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
    }
    return json_({ ok: true, count: data.orders.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, message: 'Seceda POS receiver is running' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
