let allFiles = [];
let activeReviewPath = '';
let activeRating = 0;
const reviewDialog = document.getElementById('reviewDialog');

async function loadFiles() {
  const listEl = document.getElementById('fileList');
  try {
    const res = await fetch(`files.json?_=${Date.now()}`);
    if (!res.ok) throw new Error('Не удалось загрузить список');
    const data = await res.json();
    allFiles = Array.isArray(data.files) ? data.files : [];
    updateStats(data.generatedAt);
    render(allFiles);
  } catch (error) {
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
  const updated = generatedAt ? formatDate(generatedAt, true) : '—';
  document.getElementById('fileCount').textContent = allFiles.length;
  document.getElementById('totalSize').textContent = formatSize(totalBytes);
  document.getElementById('updatedDate').textContent = updated;
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
    const extension = getExtension(file.name);
    return `
      <article class="file-row">
        <div class="file-primary">
          <span class="file-icon" aria-hidden="true">${escapeHtml(extension)}</span>
          <span class="file-copy">
            <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="file-folder">${folder ? `Хранилище / ${escapeHtml(folder)}` : 'Корневая папка'}</span>
          </span>
        </div>
        <span class="file-size">${formatSize(Number(file.size))}</span>
        <time class="file-date" datetime="${escapeHtml(file.modified || '')}">${formatDate(file.modified)}</time>
        <span class="file-actions">
          ${reviewButton(file)}
          <a class="download-btn" href="${encodeURI(file.path)}" download aria-label="Скачать ${escapeHtml(file.name)}"><span>↓</span>Скачать</a>
        </span>
      </article>`;
  }).join('');
}

function reviewButton(file) {
  const review = getReview(file.path);
  const label = review ? `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}` : 'Отзыв';
  return `<button class="review-btn${review ? ' has-review' : ''}" type="button" data-review-path="${escapeHtml(file.path)}"><span class="stars">${label}</span></button>`;
}

function getReviews() {
  try { return JSON.parse(localStorage.getItem('filevault-reviews') || '{}'); }
  catch { return {}; }
}

function getReview(path) { return getReviews()[path] || null; }

function setRating(value) {
  activeRating = value;
  document.querySelectorAll('.rating button').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.rating) <= value);
    button.setAttribute('aria-checked', Number(button.dataset.rating) === value ? 'true' : 'false');
  });
}

function openReview(path) {
  const file = allFiles.find(item => item.path === path);
  if (!file) return;
  const review = getReview(path);
  activeReviewPath = path;
  document.getElementById('reviewFileName').textContent = file.name;
  document.getElementById('reviewText').value = review?.text || '';
  document.getElementById('deleteReview').hidden = !review;
  setRating(review?.rating || 0);
  reviewDialog.showModal();
}

function getFolder(filePath = '') {
  return filePath.split('/').slice(1, -1).join('/');
}

function getExtension(fileName = '') {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop().slice(0, 4) : 'FILE';
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', event => {
  const query = event.target.value.trim().toLocaleLowerCase('ru-RU');
  const filtered = query
    ? allFiles.filter(file =>
        file.name.toLocaleLowerCase('ru-RU').includes(query) ||
        getFolder(file.path).toLocaleLowerCase('ru-RU').includes(query))
    : allFiles;
  render(filtered);
});

document.getElementById('fileList').addEventListener('click', event => {
  const button = event.target.closest('[data-review-path]');
  if (button) openReview(button.dataset.reviewPath);
});

document.querySelectorAll('.rating button').forEach(button => {
  button.addEventListener('click', () => setRating(Number(button.dataset.rating)));
});

document.getElementById('reviewForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  if (!activeRating) {
    event.preventDefault();
    setRating(1);
    return;
  }
  const reviews = getReviews();
  reviews[activeReviewPath] = {
    rating: activeRating,
    text: document.getElementById('reviewText').value.trim(),
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem('filevault-reviews', JSON.stringify(reviews));
  renderFiltered();
});

document.getElementById('deleteReview').addEventListener('click', () => {
  const reviews = getReviews();
  delete reviews[activeReviewPath];
  localStorage.setItem('filevault-reviews', JSON.stringify(reviews));
  reviewDialog.close();
  renderFiltered();
});

function renderFiltered() {
  const query = searchInput.value.trim().toLocaleLowerCase('ru-RU');
  render(query ? allFiles.filter(file => file.name.toLocaleLowerCase('ru-RU').includes(query) || getFolder(file.path).toLocaleLowerCase('ru-RU').includes(query)) : allFiles);
}

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    searchInput.blur();
    render(allFiles);
  }
});

loadFiles();
