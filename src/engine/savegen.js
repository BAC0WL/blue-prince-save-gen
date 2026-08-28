// =============================================================================
// SAVEGEN.JS  —  Builds the decrypted ES3 save file text
//
// The output of generateSaveFile() is a plain-text string in the ES3 format
// that Blue Prince expects. It is NOT yet encrypted — pass it to es3Encrypt()
// in encrypt.js before writing to disk or downloading.
//
// Key facts about the ES3 format used by Blue Prince:
//   - Non-standard JSON: values sit directly after the "__type" string with
//     no separating colon, e.g.  "__type" : "System.Int32"42
//   - The file wraps four slot sections (BluePrint, BluePrint2, BluePrint3,
//     BluePrint4), each followed by SaveFileInfo and CurrentSave sections.
//   - SaveSlot and SaveIcon are always forced to equal the slot number (1-4).
//   - The arrays block (History Data etc.) is preserved verbatim from a real
//     save and lives in src/data/save_template.js.
// =============================================================================

// getSlotValue and isModified are defined in app.js and used here.
// ALL_FIELDS, BOOL_FIELDS, ARRAYS_TEMPLATE, SLOT_FOOTER are in data files.

function buildObjsStr(slot) {
  const parts = [];

  // Write all non-boolean, non-Vector3 fields.
  // SaveSlot and SaveIcon are always forced to the slot number.
  ALL_FIELDS.forEach(f => {
    if (f.type === 'System.Boolean' || f.type === 'UnityEngine.Vector3,UnityEngine.CoreModule') return;

    let val;
    if (f.key === 'SaveSlot' || f.key === 'SaveIcon') {
      val = slot;
    } else {
      val = getSlotValue(slot, f.key);
    }

    let valStr;
    if (f.type === 'System.String') {
      valStr = '"' + String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    } else {
      valStr = String(val);
    }

    parts.push('"' + f.key + '":{\n\t\t\t\t"__type" : "' + f.type + '"' + valStr + '\n\t\t\t}');
  });

  // Write user-editable boolean fields (shown in Flags panel)
  BOOL_FIELDS.forEach(f => {
    const val = getSlotValue(slot, f.key);
    parts.push('"' + f.key + '":{\n\t\t\t\t"__type" : "System.Boolean"' + (val ? 'true' : 'false') + '\n\t\t\t}');
  });

  // Write hidden boolean fields (internal game state, always at default)
  HIDDEN_BOOL_FIELDS.forEach(f => {
    let val = getSlotValue(slot, f.key);
    // "?Checked Item" is set whenever an item is stored in the Coat Check
    // (CoatCheckIndexNumber is anything other than 1000 = None).
    if (f.key === '?Checked Item' && getSlotValue(slot, 'CoatCheckIndexNumber') != 1000) {
      val = true;
    }
    parts.push('"' + f.key + '":{\n\t\t\t\t"__type" : "System.Boolean"' + (val ? 'true' : 'false') + '\n\t\t\t}');
  });

  // Vector3 field — foundation spawn point derived from the tile picker
  (function () {
    var tile = getSlotValue(slot, 'foundaiton tile');
    var x = 35, z = 75; // default: tile 33, rotation 90 (original save)
    if (tile >= 1 && tile <= 45) {
      var col = ((tile - 1) % 5) + 1;
      var row = Math.ceil(tile / 5);
      x = 5 + col * 10;
      z = 5 + row * 10;
    }
    parts.push('"FoundationLocationV3":{\n\t\t\t\t"__type" : "UnityEngine.Vector3,UnityEngine.CoreModule",\n\t\t\t\t"x" : ' + x + ',\n\t\t\t\t"y" : 0,\n\t\t\t\t"z" : ' + z + '\n\t\t\t}');
  })();

  // Foundation adjacency strings — rotation-dependent per FSM documentation
  // north=N+5(+Z), east=N+1(+X), south=N-5(-Z), west=N-1(-X)
  // The North face is always the blocked entrance; E/S/W rotate with FoundationRotation.
  (function () {
    var tile = getSlotValue(slot, 'foundaiton tile');
    var e, s, w;
    if (tile >= 1 && tile <= 45) {
      var north = 'Tile ' + (tile + 5);
      var east  = 'Tile ' + (tile + 1);
      var south = 'Tile ' + (tile - 5);
      var west  = 'Tile ' + (tile - 1);
      var rawRot = parseFloat(getSlotValue(slot, 'FoundationRotation'));
      var rot = isNaN(rawRot) ? 270 : Math.round(rawRot);
      if      (rot === 0)   { e = east;  s = south; w = west;  }
      else if (rot === 90)  { e = north; s = east;  w = south; }
      else if (rot === 180) { e = west;  s = north; w = east;  }
      else                  { e = south; s = west;  w = north; } // 270
    } else {
      e = 'Tile 38'; s = 'Tile 34'; w = 'Tile 28'; // original defaults (tile 33, rot 90)
    }
    parts.push('"Foundation Tile String E":{\n\t\t\t\t"__type" : "System.String""' + e + '"\n\t\t\t}');
    parts.push('"Foundation Tile String S":{\n\t\t\t\t"__type" : "System.String""' + s + '"\n\t\t\t}');
    parts.push('"Foundation Tile String W":{\n\t\t\t\t"__type" : "System.String""' + w + '"\n\t\t\t}');
  })();

  // Return the inner content only — buildSlotSection opens the { and \t\t}, closes it.
  return parts.join(',');
}

function buildRarityValuesStr(slot) {
  return RARITY_ROOMS.map(room => {
    const val = getSlotValue(slot, '_rarity_' + room);
    return '\t\t\t\t{\n\t\t\t\t\t"__type" : "System.Int32"' + val + '\n\t\t\t\t}';
  }).join(',\n');
}

function buildSlotSection(slot) {
  const bpKey = slot === 1 ? 'BluePrint' : 'BluePrint' + slot;
  const now   = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const day   = getSlotValue(slot, 'DAY') || 0;
  const icon  = slot; // SaveIcon always equals slot number

  const objsStr = buildObjsStr(slot);

  // SaveFileInfo — lightweight metadata block attached to each slot
  const saveInfo = [
    '\t"SaveFileInfo" : {',
    '\t\t"__type" : "ES3PlayMaker.PMDataWrapper,Assembly-CSharp-firstpass",',
    '\t\t"value" : {',
    '\t\t"objs" : {"save_created":{',
    '\t\t\t\t"__type" : "System.String""' + now + '"',
    '\t\t\t},"data_last_modified":{',
    '\t\t\t\t"__type" : "System.String""' + now + '"',
    '\t\t\t},"game_version":{',
    '\t\t\t\t"__type" : "System.String""1.1.10.22"',
    '\t\t\t},"save_system_version":{',
    '\t\t\t\t"__type" : "System.String""2.0"',
    '\t\t\t}',
    '\t\t},',
    '\t\t"arrays" : null,',
    '\t\t"obj" : null,',
    '\t\t"array" : null',
    '\t}',
    '\t},',    // trailing comma separates SaveFileInfo from CurrentSave
  ].join('\n');

  // CurrentSave — the lightweight runtime slot that the game reads first
  const currentSave = [
    '\t"CurrentSave" : {',
    '\t\t"__type" : "ES3PlayMaker.PMDataWrapper,Assembly-CSharp-firstpass",',
    '\t\t"value" : {',
    '\t\t"objs" : {"GAME CLOCK":{',
    '\t\t\t\t"__type" : "System.Single"0',
    '\t\t\t},"Hours":{',
    '\t\t\t\t"__type" : "System.Single"0',
    '\t\t\t},"Hoursx360":{',
    '\t\t\t\t"__type" : "System.Single"0',
    '\t\t\t},"Minutes":{',
    '\t\t\t\t"__type" : "System.Single"0',
    '\t\t\t},"current save":{',
    '\t\t\t\t"__type" : "System.Int32"' + slot,
    '\t\t\t},"DAY":{',
    '\t\t\t\t"__type" : "System.Int32"' + day,
    '\t\t\t},"Int Hours":{',
    '\t\t\t\t"__type" : "System.Int32"0',
    '\t\t\t},"Int Minutes":{',
    '\t\t\t\t"__type" : "System.Int32"0',
    '\t\t\t},"SaveIcon":{',
    '\t\t\t\t"__type" : "System.Int32"' + icon,
    '\t\t\t},"dare mode":{',
    '\t\t\t\t"__type" : "System.Boolean"false',
    '\t\t\t},"curse mode":{',
    '\t\t\t\t"__type" : "System.Boolean"false',
    '\t\t\t},"EMPTY":{',
    '\t\t\t\t"__type" : "System.Boolean"false',
    '\t\t\t},"CURSE UNLOCK":{',
    '\t\t\t\t"__type" : "System.Boolean"false',
    '\t\t\t},"DARE UNLOCK":{',
    '\t\t\t\t"__type" : "System.Boolean"false',
    '\t\t\t},"CURSE MODE":{',
    '\t\t\t\t"__type" : "System.Boolean"false',
    '\t\t\t},"DARE MODE":{',
    '\t\t\t\t"__type" : "System.Boolean"false',
    '\t\t\t},"Day String":{',
    '\t\t\t\t"__type" : "System.String"""',
    '\t\t\t},"Game Time String":{',
    '\t\t\t\t"__type" : "System.String"""',
    '\t\t\t}',
    '\t\t},',
    '\t\t"arrays" : {',
    '\t\t},',
    '\t\t"obj" : null,',
    '\t\t"array" : null',
    '\t}',
    '\t}',    // no trailing comma — generateSaveFile's join(',\n') adds it between slots
  ].join('\n');

  // SLOT_FOOTER already ends with \t}, closing BluePrint with a trailing comma,
  // so saveInfo and currentSave must NOT have a leading comma.
  return [
    '\t"' + bpKey + '" : {',
    '\t\t"__type" : "ES3PlayMaker.PMDataWrapper,Assembly-CSharp-firstpass",',
    '\t\t"value" : {',
    '\t\t"objs" : {' + objsStr,
    '\t\t},',
    ARRAYS_TEMPLATE.replace(
      /"Rarity Shifts Values":\[[\s\S]*?\]/,
      '"Rarity Shifts Values":[\n' + buildRarityValuesStr(slot) + '\n\t\t\t]'
    ) + SLOT_FOOTER,
    saveInfo,
    currentSave,
  ].join('\n');
}

function generateSaveFile() {
  return '{\n' + [1, 2, 3, 4].map(s => buildSlotSection(s)).join(',\n') + '\n}';
}
