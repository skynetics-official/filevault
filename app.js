import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app-check.js';
import { collection, deleteDoc, doc, getDocs, getFirestore, query, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCFdlUUoah2fFctWfAhWz5IuAsa1sFtQ-Q',
  authDomain: 'filevault-25821.firebaseapp.com',
  projectId: 'filevault-25821',
  storageBucket: 'filevault-25821.firebasestorage.app',
  messagingSenderId: '674904685820',
  appId: '1:674904685820:web:3d773a3e6264f9443e2b79',
  measurementId: 'G-3N0N842TYF'
};

const firebaseApp = initializeApp(firebaseConfig);
initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider('6Ld_-VktAAAAALvxGOPV7HZW-5TLjUinFE70IGFZ'),
  isTokenAutoRefreshEnabled: true
});
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

let allFiles = [];
let allReviews = [];
let currentUser = null;
let activeReviewPath = '';
let activeRating = 0;
const reviewDialog = document.getElementById('reviewDialog');
const reviewStatus = document.getElementById('reviewStatus');

onAuthStateChanged(auth, user => { currentUser = user; });
signInAnonymously(auth).catch(() => {
  reviewStatus.textContent = 'Не удалось подключить отзывы. Проверьте, включён ли Anonymous в Firebase Authentication.';
});

async function loadFiles() {
  const listEl = document.getElementById('fileList');
  try {
    const response = await fetch(`files.json?_=${Date.now()}`);
    if (!response.ok) throw new Error('Не удалось загрузить список');
    const data = await response.json();
    allFiles = Array.isArray(data.files) ? data.files : [];
    updateStats(data.generatedAt);
    await loadReviewSummary();
    render(allFiles);
  } catch {
    listEl.innerHTML = '<div class="loading">Не удалось загрузить список файлов. Обновите страницу.</div>';
    document.getElementById('resultSummary').textContent = 'Ошибка загрузки';
  }
}

async function loadReviewSummary() {
  try {
    const snapshot = await getDocs(collection(db, 'reviews'));
    allReviews = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  } catch {
    allReviews = [];
  }
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toLocaleString('ru-RU', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

function formatDate(value, long = false) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', long ? { day: 'numeric', month: 'short' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pluralizeFiles(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'файл';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'файла';
  return 'файлов';
}

function updateStats(generatedAt) {
  document.getElementById('fileCount').textContent = allFiles.length;
  document.getElementById('totalSize').textContent = formatSize(allFiles.reduce((sum, file) => sum + (Number(file.size) || 0), 0));
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
        ${reviewButton(file)}
        <a class="download-btn" href="${encodeURI(file.path)}" download aria-label="Скачать ${escapeHtml(file.name)}"><span>↓</span>Скачать</a>
      </span>
    </article>`;
  }).join('');
}

function reviewButton(file) {
  const reviews = allReviews.filter(review => review.filePath === file.path);
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const label = reviews.length ? `★ ${average.toFixed(1)} · ${reviews.length}` : 'Отзыв';
  return `<button class="review-btn${reviews.length ? ' has-review' : ''}" type="button" data-review-path="${escapeHtml(file.path)}"><span class="stars">${label}</span></button>`;
}

function fileKey(path) {
  const bytes = new TextEncoder().encode(path);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function reviewId(path, uid) { return `${uid}_${fileKey(path)}`; }

function ownReview(path) {
  return currentUser ? allReviews.find(review => review.filePath === path && review.uid === currentUser.uid) : null;
}

function setRating(value) {
  activeRating = value;
  document.querySelectorAll('.rating button').forEach(button => {
    const selected = Number(button.dataset.rating) <= value;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-checked', Number(button.dataset.rating) === value ? 'true' : 'false');
  });
}

async function openReview(path) {
  const file = allFiles.find(item => item.path === path);
  if (!file) return;
  activeReviewPath = path;
  reviewStatus.textContent = '';
  document.getElementById('reviewFileName').textContent = file.name;
  reviewDialog.showModal();
  await loadReviewsForFile(path);
  const review = ownReview(path);
  document.getElementById('reviewText').value = review?.text || '';
  document.getElementById('deleteReview').hidden = !review;
  setRating(review?.rating || 0);
}

async function loadReviewsForFile(path) {
  const list = document.getElementById('communityReviews');
  list.innerHTML = '<p>Загружаем отзывы…</p>';
  try {
    const snapshot = await getDocs(query(collection(db, 'reviews'), where('filePath', '==', path)));
    const reviews = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    allReviews = [...allReviews.filter(review => review.filePath !== path), ...reviews];
    list.innerHTML = reviews.length ? reviews.map(review => `
      <article class="community-review">
        <div><span class="review-stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span><time>${formatDate(review.updatedAt)}</time></div>
        <p>${review.text ? escapeHtml(review.text) : '<span class="muted-review">Без комментария</span>'}</p>
      </article>`).join('') : '<p>Отзывов пока нет. Будьте первым.</p>';
  } catch {
    list.innerHTML = '<p>Не удалось загрузить отзывы.</p>';
  }
}

function getFolder(path = '') { return path.split('/').slice(1, -1).join('/'); }
function getExtension(name = '') { const parts = name.split('.'); return parts.length > 1 ? parts.pop().slice(0, 4) : 'FILE'; }
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }

const searchInput = document.getElementById('searchInput');
function renderFiltered() {
  const search = searchInput.value.trim().toLocaleLowerCase('ru-RU');
  render(search ? allFiles.filter(file => file.name.toLocaleLowerCase('ru-RU').includes(search) || getFolder(file.path).toLocaleLowerCase('ru-RU').includes(search)) : allFiles);
}
searchInput.addEventListener('input', renderFiltered);
document.getElementById('fileList').addEventListener('click', event => {
  const button = event.target.closest('[data-review-path]');
  if (button) openReview(button.dataset.reviewPath);
});
document.querySelectorAll('.rating button').forEach(button => button.addEventListener('click', () => setRating(Number(button.dataset.rating))));

document.getElementById('reviewForm').addEventListener('submit', async event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  if (!currentUser) { reviewStatus.textContent = 'Подключаемся к Firebase. Попробуйте ещё раз через несколько секунд.'; return; }
  if (!activeRating) { reviewStatus.textContent = 'Сначала выберите оценку от 1 до 5.'; return; }
  const file = allFiles.find(item => item.path === activeReviewPath);
  const existing = ownReview(activeReviewPath);
  const saveButton = event.submitter;
  saveButton.disabled = true;
  reviewStatus.textContent = 'Сохраняем…';
  try {
    const payload = {
      uid: currentUser.uid,
      fileKey: fileKey(activeReviewPath),
      filePath: activeReviewPath,
      fileName: file.name,
      rating: activeRating,
      text: document.getElementById('reviewText').value.trim(),
      updatedAt: serverTimestamp()
    };
    if (!existing) payload.createdAt = serverTimestamp();
    await setDoc(doc(db, 'reviews', reviewId(activeReviewPath, currentUser.uid)), payload, { merge: Boolean(existing) });
    await loadReviewsForFile(activeReviewPath);
    reviewStatus.textContent = 'Отзыв сохранён.';
    document.getElementById('deleteReview').hidden = false;
    renderFiltered();
  } catch {
    reviewStatus.textContent = 'Не удалось сохранить. Проверьте правила Firestore и Anonymous Authentication.';
  } finally { saveButton.disabled = false; }
});

document.getElementById('deleteReview').addEventListener('click', async () => {
  if (!currentUser) return;
  try {
    await deleteDoc(doc(db, 'reviews', reviewId(activeReviewPath, currentUser.uid)));
    await loadReviewsForFile(activeReviewPath);
    document.getElementById('reviewText').value = '';
    document.getElementById('deleteReview').hidden = true;
    setRating(0);
    reviewStatus.textContent = 'Отзыв удалён.';
    renderFiltered();
  } catch { reviewStatus.textContent = 'Не удалось удалить отзыв.'; }
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.focus(); }
  if (event.key === 'Escape' && document.activeElement === searchInput) { searchInput.value = ''; searchInput.blur(); render(allFiles); }
});

loadFiles();
