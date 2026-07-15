// Сканирует папку files/ и пересобирает files.json со списком файлов.
// Запускается автоматически GitHub Action'ом при каждом push.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FILES_DIR = path.join(__dirname, '..', 'files');
const OUTPUT = path.join(__dirname, '..', 'files.json');

function getLastCommitDate(filePath) {
  try {
    const out = execSync(`git log -1 --format=%aI -- "${filePath}"`, { encoding: 'utf-8' }).trim();
    return out || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function walk(dir, base = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(base, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath, relPath));
    } else {
      const stat = fs.statSync(fullPath);
      results.push({
        name: entry.name,
        path: 'files/' + relPath.split(path.sep).join('/'),
        size: stat.size,
        modified: getLastCommitDate(fullPath),
      });
    }
  }
  return results;
}

const files = walk(FILES_DIR).sort((a, b) =>
  new Date(b.modified) - new Date(a.modified)
);

const manifest = {
  generatedAt: new Date().toISOString(),
  files,
};

fs.writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Готово: найдено файлов — ${files.length}`);
