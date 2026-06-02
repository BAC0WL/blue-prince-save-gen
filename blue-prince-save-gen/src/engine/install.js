// =============================================================================
// INSTALL.JS  —  Direct install (File System Access API) + batch installer
// =============================================================================

// ── Direct install (Chrome / Edge — File System Access API) ──────────────────

async function directInstall() {
  if (!window.showDirectoryPicker) {
    toast('Direct install needs Chrome or Edge. Use the .bat below instead.');
    return;
  }

  const btn = document.getElementById('direct-install-btn');
  btn.textContent = '⏳ Working…';
  btn.disabled = true;

  try {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (e.name === 'AbortError') return;
      throw e;
    }

    const SAVE_FILE = 'MtHollyBlueprint.es3';
    const ts = new Date().toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);

    // Backup existing save into Save Folders/{timestamp}/
    let backedUp = false;
    try {
      const oldHandle  = await dirHandle.getFileHandle(SAVE_FILE);
      const oldFile    = await oldHandle.getFile();
      const oldBytes   = await oldFile.arrayBuffer();
      const sfDir      = await dirHandle.getDirectoryHandle('Save Folders', { create: true });
      const backupDir  = await sfDir.getDirectoryHandle(ts, { create: true });
      const backupFile = await backupDir.getFileHandle(SAVE_FILE, { create: true });
      const bw         = await backupFile.createWritable();
      await bw.write(oldBytes);
      await bw.close();
      backedUp = true;
    } catch (e) {
      if (e.name !== 'NotFoundError') console.warn('Backup skipped:', e);
    }

    // Encrypt and write the new save
    const b64    = await es3Encrypt(generateSaveFile());
    const binStr = atob(b64);
    const bytes  = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);

    const newHandle = await dirHandle.getFileHandle(SAVE_FILE, { create: true });
    const nw        = await newHandle.createWritable();
    await nw.write(bytes);
    await nw.close();

    toast('Save installed!' + (backedUp ? ' Old save backed up to Save Folders/' + ts : ''));
  } catch (e) {
    toast('Install failed: ' + e.message);
    console.error(e);
  } finally {
    btn.textContent = '📁 Pick Save Folder & Install';
    btn.disabled = false;
  }
}

// ── Batch installer (.bat) ────────────────────────────────────────────────────

async function downloadInstaller() {
  const btn      = document.getElementById('inst-panel-btn');
  const savePath = (document.getElementById('installer-save-path') || {}).value || '';
  const gameExe  = (document.getElementById('installer-game-exe')  || {}).value || '';

  if (!savePath.trim()) {
    toast('Enter the save file path before downloading');
    return;
  }

  btn.textContent = '⏳ Building…';
  btn.disabled = true;

  try {
    const plaintext = generateSaveFile();
    const b64       = await es3Encrypt(plaintext);
    const batch     = buildBatchInstaller(b64, savePath.trim(), gameExe.trim());

    const blob = new Blob([batch], { type: 'text/plain' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'Blue_Prince_Install.bat';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Blue_Prince_Install.bat downloaded!');
  } catch (e) {
    toast('Failed to build installer: ' + e.message);
    console.error(e);
  } finally {
    btn.textContent = '⬇ Download installer.bat';
    btn.disabled = false;
  }
}

function buildBatchInstaller(encryptedB64, savePath, gameExe) {
  // Split base64 into 76-char echo lines — base64 chars are all batch-safe.
  const echoLines = [];
  for (let i = 0; i < encryptedB64.length; i += 76) {
    echoLines.push('echo ' + encryptedB64.slice(i, i + 76));
  }
  const b64Block = echoLines.join('\r\n');

  // PowerShell reads the temp b64 file, strips CRLF with -replace, writes binary.
  const psWrite =
    'powershell -ExecutionPolicy Bypass -NoProfile -Command ' +
    '"[IO.File]::WriteAllBytes(' +
      "'%SAVE_PATH%'" +
      ', [Convert]::FromBase64String(' +
        "([IO.File]::ReadAllText('%TMPB64%') -replace '[\\r\\n]')" +
      '))"';

  const lines = [
    '@echo off',
    'setlocal EnableDelayedExpansion',
    'title Blue Prince Save Installer',
    '',
    'set "SAVE_PATH=' + savePath + '"',
    'set "GAME_EXE='  + gameExe  + '"',
    '',
    'echo.',
    'echo  ==========================================',
    'echo   Blue Prince Save Installer',
    'echo  ==========================================',
    'echo.',
    '',
    ':: Get timestamp for backup folder name',
    "for /f %%T in ('powershell -NoProfile -Command \"Get-Date -Format yyyy-MM-dd_HH-mm-ss\"') do set \"TS=%%T\"",
    '',
    ':: Derive save directory from the full save file path',
    'for %%F in ("%SAVE_PATH%") do set "SAVE_DIR=%%~dpF"',
    'if "!SAVE_DIR:~-1!"=="\\" set "SAVE_DIR=!SAVE_DIR:~0,-1!"',
    '',
    'set "BACKUP_ROOT=!SAVE_DIR!\\Save Folders"',
    'set "BACKUP_DIR=!BACKUP_ROOT!\\!TS!"',
    '',
    ':: ── Backup ───────────────────────────────────────────────────────────────',
    'if exist "%SAVE_PATH%" (',
    '    echo  Backing up current save...',
    '    if not exist "!BACKUP_ROOT!" mkdir "!BACKUP_ROOT!"',
    '    mkdir "!BACKUP_DIR!" 2>nul',
    '    move "%SAVE_PATH%" "!BACKUP_DIR!\\" >nul',
    '    echo   OK ^- !BACKUP_DIR!',
    '    echo.',
    ') else (',
    '    echo  No existing save found ^- skipping backup.',
    '    echo.',
    ')',
    '',
    'echo  Writing new save file...',
    '',
    ':: ── Write save data ─────────────────────────────────────────────────────',
    'set "TMPB64=%TEMP%\\bpsave_%RANDOM%.b64"',
    '(',
    b64Block,
    ') > "%TMPB64%"',
    '',
    psWrite,
    '',
    'del "%TMPB64%" >nul 2>&1',
    '',
    'if exist "%SAVE_PATH%" (',
    '    echo   OK ^- save file installed!',
    ') else (',
    '    echo   ERROR: Save file was not created.',
    '    echo   Make sure this directory exists: !SAVE_DIR!',
    '    pause',
    '    exit /b 1',
    ')',
    '',
    'echo.',
    '',
    ':: ── Launch game ──────────────────────────────────────────────────────────',
    'if "%GAME_EXE%"=="" goto :no_game',
    'if not exist "%GAME_EXE%" goto :no_exe',
    'echo  Launching Blue Prince...',
    'start "" "%GAME_EXE%"',
    'goto :done',
    '',
    ':no_exe',
    'echo  NOTE: Game not found at: %GAME_EXE%',
    'echo        Launch Blue Prince manually.',
    'goto :done',
    '',
    ':no_game',
    'echo  No game path set. Launch Blue Prince manually.',
    '',
    ':done',
    'echo.',
    'echo  ==========================================',
    'echo   All done!',
    'echo  ==========================================',
    'echo.',
    'timeout /t 4 >nul',
    '',
    ':: Self-delete — (goto) releases the file handle so del can remove it',
    '(goto) 2>nul & del "%~f0"',
  ];

  return lines.join('\r\n');
}
