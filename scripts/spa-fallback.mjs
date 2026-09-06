import { copyFile } from 'node:fs/promises';

// GitHub Pages serves this document for deep links. Asset URLs already include
// Vite's base path, and BrowserRouter renders the requested game or room.
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../dist/404.html', import.meta.url));
