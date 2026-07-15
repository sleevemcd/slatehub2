/**
 * SlateHub Backend
 *
 * Deploy as a Google Apps Script Web App to enable:
 * 1. Write-back shot/take data to your sheet
 * 2. Teleprompter remote scroll relay
 *
 * SETUP:
 * 1. Open your shot list Google Sheet
 * 2. Extensions -> Apps Script
 * 3. Paste this code
 * 4. Deploy -> New Deployment -> Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL
 */

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  if (action === 'getTeleprompterState') {
    return handleGetTeleprompterState(e);
  }

  return HtmlService.createHtmlOutput(
    '<h1>SlateHub Backend</h1><p>This is a web app for SlateHub. Use POST requests for data operations, or GET with ?action=getTeleprompterState&sessionId=... for teleprompter relay.</p>'
  );
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    var result;

    switch (action) {
      case 'toggleDone':
        result = handleToggleDone(data);
        break;
      case 'addTake':
        result = handleAddTake(data);
        break;
      case 'updateNotes':
        result = handleUpdateNotes(data);
        break;
      case 'addShot':
        result = handleAddShot(data);
        break;
      case 'updateTeleprompterState':
        result = handleUpdateTeleprompterState(data);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// TELEPROMPTER RELAY
// ============================================================

function handleGetTeleprompterState(e) {
  var sessionId = e.parameter.sessionId;
  if (!sessionId) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'No sessionId provided' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var props = PropertiesService.getScriptProperties();
  var key = 'tp_' + sessionId;
  var stored = props.getProperty(key);

  var result = stored ? JSON.parse(stored) : {
    scrollPosition: 0,
    speed: 5,
    playing: false
  };

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, result: result }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateTeleprompterState(data) {
  var sessionId = data.sessionId;
  if (!sessionId) throw new Error('No sessionId provided');

  var props = PropertiesService.getScriptProperties();
  var key = 'tp_' + sessionId;
  var stored = props.getProperty(key);
  var current = stored ? JSON.parse(stored) : {
    scrollPosition: 0,
    speed: 5,
    playing: false
  };

  if (data.scrollPosition !== undefined) current.scrollPosition = data.scrollPosition;
  if (data.speed !== undefined) current.speed = data.speed;
  if (data.playing !== undefined) current.playing = data.playing;

  props.setProperty(key, JSON.stringify(current));
  return { updated: true };
}

// ============================================================
// SHEET WRITE-BACK
// ============================================================

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet found. Make sure this script is linked to a sheet.');
  return ss.getActiveSheet();
}

function findColumn_(headers, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = headers.indexOf(names[i].toLowerCase().trim());
    if (idx !== -1) return idx;
  }
  for (var i = 0; i < names.length; i++) {
    for (var j = 0; j < headers.length; j++) {
      if (String(headers[j]).toLowerCase().trim() === names[i].toLowerCase().trim()) {
        return j;
      }
    }
  }
  return -1;
}

function handleToggleDone(data) {
  var sheet = getSheet_();
  var row = data.row;
  var done = data.done;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var doneCol = findColumn_(headers, ['done y/n', 'done', 'complete', 'status']);
  if (doneCol === -1) throw new Error('Could not find a "done" column');
  sheet.getRange(row, doneCol + 1).setValue(done ? 'y' : '');
  return { updated: true };
}

function handleAddTake(data) {
  var sheet = getSheet_();
  var shotRow = data.shotRow;
  var takeNumber = data.takeNumber;
  var good = data.good;
  var notes = data.notes || '';
  var timestamp = data.timestamp || '';

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var lastCol = sheet.getLastColumn();

  var takesCol = findColumn_(headers, ['takes', 'take log', 'take data']);
  var targetCol = takesCol !== -1 ? takesCol : lastCol - 1;

  var existing = sheet.getRange(shotRow, targetCol + 1).getValue();
  var entry = '[Take ' + takeNumber + '] ' + (good ? 'GOOD' : 'NG') + (notes ? ': ' + notes : '') + ' @ ' + timestamp;
  var newVal = existing ? existing + '\n' + entry : entry;
  sheet.getRange(shotRow, targetCol + 1).setValue(newVal);
  return { updated: true, column: targetCol + 1 };
}

function handleUpdateNotes(data) {
  var sheet = getSheet_();
  var row = data.row;
  var notes = data.notes;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var notesCol = findColumn_(headers, ['notes', 'note']);
  if (notesCol === -1) throw new Error('Could not find a "notes" column');
  sheet.getRange(row, notesCol + 1).setValue(notes);
  return { updated: true };
}

function handleAddShot(data) {
  var sheet = getSheet_();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var newRow = sheet.getLastRow() + 1;

  var colMap = {
    'type': findColumn_(headers, ['type']),
    'description': findColumn_(headers, ['description']),
    'sub shot': findColumn_(headers, ['sub shot', 'subshot', 'shot']),
    'location': findColumn_(headers, ['location']),
    'setup': findColumn_(headers, ['setup', 'camera setup']),
    'notes': findColumn_(headers, ['notes']),
    'shoot day': findColumn_(headers, ['shoot day', 'day']),
    'shoot order': findColumn_(headers, ['shoot order', 'order']),
  };

  var keys = Object.keys(colMap);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var colIdx = colMap[key];
    if (colIdx !== -1 && data[key]) {
      sheet.getRange(newRow, colIdx + 1).setValue(data[key]);
    }
  }

  return { row: newRow };
}
