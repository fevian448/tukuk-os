const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;

function createWindow() {
  // Catatan: chrome-sandbox memerlukan root ownership + mode 4755.
  // Jika tidak boleh dikonfigurasi, Electron akan crash dengan
  // "setuid_sandbox_host.cc(163)". Buka tanpa sandbox sebagai fallback.
  try {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Tukuk-OS — Enjin Carian Web',
      icon: path.join(__dirname, 'public', 'favicon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
  } catch (error) {
    if (error.message && error.message.includes('sandbox')) {
      console.warn('[desktop] sandbox gagal, membuka tanpa sandbox...');
      mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Tukuk-OS — Enjin Carian Web',
        icon: path.join(__dirname, 'public', 'favicon.ico'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false
        }
      });
    } else {
      throw error;
    }
  }

  // Cuba mulakan pelayan tempatan jika belum berjalan.
  startLocalServer();

  // Buka UI utama.
  mainWindow.loadURL('http://127.0.0.1:8000');

  // Buka DevTools dalam mod pembangunan.
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startLocalServer() {
  // Cuba sambungan ke pelayan tempatan dahulu.
  const http = require('http');
  const req = http.get('http://127.0.0.1:8000/health', (res) => {
    if (res.statusCode === 200) {
      console.log('[desktop] pelayan tempatan sudah berjalan.');
      return;
    }
    spawnServer();
  });
  req.on('error', () => {
    spawnServer();
  });
}

function spawnServer() {
  console.log('[desktop] memulakan pelayan tempatan...');
  const serverPath = path.join(__dirname, 'index.js');
  serverProcess = spawn('node', [serverPath], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  serverProcess.on('error', (err) => {
    console.error('[desktop] gagal memulakan pelayan:', err.message);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[desktop] pelayan tamat dengan kod ${code}`);
    serverProcess = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Tukuk-OS',
      submenu: [
        { label: 'Tentang Tukuk-OS', selector: 'orderFrontStandardAboutPanel:' },
        { type: 'separator' },
        { label: 'Semak Semula', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'Force Semak Semula', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { label: 'Keluar', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Carian',
      submenu: [
        { label: 'Fokus Kotak Carian', accelerator: 'CmdOrCtrl+K', click: () => mainWindow?.webContents.send('focus-search') }
      ]
    },
    {
      label: 'Pembangunan',
      submenu: [
        { label: 'Alat Pembangunan', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.openDevTools() },
        { label: 'Muat Semula Pelayan', click: () => {
          if (serverProcess) { serverProcess.kill(); serverProcess = null; }
          spawnServer();
        }}
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // Cuba lainkan sandbox; jika tidakConfigured, Electron akan nggak crash di window nanti.
  try {
    app.commandLine.appendSwitch('no-sandbox');
  } catch {
    // abaikan jika tidak disokong
  }
  createWindow();
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
