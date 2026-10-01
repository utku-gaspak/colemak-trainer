/**
 * Desktop shell: serves the Vite build from a custom `app://` origin and opens
 * it in a single window. The page is the same one the browser runs; nothing
 * here touches the trainer's logic.
 *
 * Why `app://` and not file://: a fixed, standard origin keeps localStorage
 * (all progress lives there) stable no matter where the exe is unpacked, and
 * lets the build keep absolute asset paths.
 */
const { app, BrowserWindow, Menu, nativeTheme, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://kegex';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Two windows would write the same localStorage and overwrite each other's progress.
if (!app.requestSingleInstanceLock()) app.quit();

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121211' : '#f6f5f2',
    title: 'Kegex',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());

  // Links (e.g. in About) open in the default browser, never inside the trainer.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) e.preventDefault();
  });

  win.loadURL(`${ORIGIN}/index.html`);
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  if (process.platform === 'darwin') {
    // macOS menus live in the system bar, so Option never reaches them; the
    // app menu is what makes Cmd+Q / Cmd+W / Cmd+H / Cmd+M work at all.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]),
    );
  } else {
    // No menu bar: on Windows a lone Alt press would otherwise focus the menu
    // and swallow the next keystroke, which breaks AltGr umlaut chords.
    Menu.setApplicationMenu(null);
  }
  createWindow();
});

// Dock click after the window was closed via the red button (if the app is still alive).
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => app.quit());
