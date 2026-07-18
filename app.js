let allFiles = [];

async function loadFiles() {
  const listEl = document.getElementById('fileList');
  try {
    const response = await fetch(`files.json?_=${Date.now()}`);
    if (!response.ok) throw new Error('Не удалось загрузить список');
    const data = await response.json();
    allFiles = Array.isArray(data.files) ? data.files : [];
    updateStats(data.generatedAt);
    render(allFiles);
  } catch {
    listEl.innerHTML = '<div class="loading">Не удалось загрузить список файлов. Обновите страницу.</div>';
    document.getElementById('resultSummary').textContent = 'Ошибка загрузки';
  }
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

function formatDate(iso, long = false) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', long
    ? { day: 'numeric', month: 'short' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pluralizeFiles(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'файл';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'файла';
  return 'файлов';
}

function updateStats(generatedAt) {
  const totalBytes = allFiles.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
  document.getElementById('fileCount').textContent = allFiles.length;
  document.getElementById('totalSize').textContent = formatSize(totalBytes);
  document.getElementById('updatedDate').textContent = generatedAt ? formatDate(generatedAt, true) : '—';
  document.getElementById('lastUpdated').textContent = generatedAt ? `обновлено ${formatDate(generatedAt)}` : 'дата неизвестна';
}

function render(files) {
  const listEl = document.getElementById('fileList');
  const emptyEl = document.getElementById('emptyState');
  document.getElementById('resultSummary').textContent = `${files.length} ${pluralizeFiles(files.length)} в коллекции`;
  if (!files.length) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  listEl.innerHTML = files.map(file => {
    const folder = getFolder(file.path);
    return `<article class="file-row">
      <div class="file-primary">
        <span class="file-icon" aria-hidden="true">${escapeHtml(getExtension(file.name))}</span>
        <span class="file-copy">
          <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="file-folder">${folder ? `Хранилище / ${escapeHtml(folder)}` : 'Корневая папка'}</span>
        </span>
      </div>
      <span class="file-size">${formatSize(Number(file.size))}</span>
      <time class="file-date" datetime="${escapeHtml(file.modified || '')}">${formatDate(file.modified)}</time>
      <span class="file-actions">
        <a class="download-btn" href="${encodeURI(file.path)}" download aria-label="Скачать ${escapeHtml(file.name)}"><span>↓</span>Скачать</a>
      </span>
    </article>`;
  }).join('');
}

function getFolder(path = '') { return path.split('/').slice(1, -1).join('/'); }
function getExtension(name = '') { const parts = name.split('.'); return parts.length > 1 ? parts.pop().slice(0, 4) : 'FILE'; }
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', event => {
  const query = event.target.value.trim().toLocaleLowerCase('ru-RU');
  render(query ? allFiles.filter(file => file.name.toLocaleLowerCase('ru-RU').includes(query) || getFolder(file.path).toLocaleLowerCase('ru-RU').includes(query)) : allFiles);
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.focus(); }
  if (event.key === 'Escape' && document.activeElement === searchInput) { searchInput.value = ''; searchInput.blur(); render(allFiles); }
});

loadFiles();
