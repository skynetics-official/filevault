let allFiles = [];

async function loadFiles() {
  const listEl = document.getElementById('fileList');
  try {
    const res = await fetch('files.json?_=' + Date.now());
    const data = await res.json();
    allFiles = data.files || [];
    document.getElementById('lastUpdated').textContent =
      data.generatedAt ? 'обновлено ' + formatDate(data.generatedAt) : '';
    render(allFiles);
  } catch (e) {
    listEl.innerHTML = '<div class="loading">Не удалось загрузить список файлов.</div>';
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function render(files) {
  const listEl = document.getElementById('fileList');
  const emptyEl = document.getElementById('emptyState');
  document.getElementById('fileCount').textContent = files.length + ' записей';

  if (files.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  listEl.innerHTML = files.map((f, i) => {
    const folder = getFolder(f.path);
    return `
    <div class="file-row">
      <span class="col-index">${String(i + 1).padStart(2, '0')}</span>
      <span class="file-name-wrap">
        <span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        ${folder ? `<span class="file-folder">📁 ${escapeHtml(folder)}</span>` : ''}
      </span>
      <span class="file-size">${formatSize(f.size)}</span>
      <span class="file-date">${formatDate(f.modified)}</span>
      <span class="col-action">
        <a class="download-btn" href="${encodeURI(f.path)}" download>↓ скачать</a>
      </span>
    </div>
  `;
  }).join('');
}

function getFolder(filePath) {
  // f.path выглядит как "files/подпапка/имя.ext" — вернём "подпапка" (или пусто для корня)
  const parts = filePath.split('/').slice(1, -1); // убираем "files" и имя файла
  return parts.join('/');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q
    ? allFiles.filter(f =>
        f.name.toLowerCase().includes(q) ||
        getFolder(f.path).toLowerCase().includes(q)
      )
    : allFiles;
  render(filtered);
});

loadFiles();
