// ============================================
// 상수 및 상태
// ============================================
const API = '/api';
let currentTab = 'anime';

// ============================================
// 인증
// ============================================
function getUser() {
  const data = localStorage.getItem('anilog_user');
  return data ? JSON.parse(data) : null;
}

function clearUser() {
  localStorage.removeItem('anilog_user');
}

function checkAdminAccess() {
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    location.href = '/';
    return false;
  }
  // isAdmin이 1 또는 true인지 확인
  if (!user.isAdmin && user.isAdmin !== 1) {
    alert('관리자 권한이 필요합니다. 다시 로그인 해주세요.');
    location.href = '/';
    return false;
  }
  return true;
}

// ============================================
// 헤더 렌더링
// ============================================
function renderAuthHeader() {
  const container = document.getElementById('header-auth');
  if (!container) return;
  
  const user = getUser();
  
  if (user) {
    const initial = user.nickname.charAt(0).toUpperCase();
    container.innerHTML = `
      <div class="user-info">
        <a href="/profile.html" class="user-profile-link">
          <div class="user-avatar">
            ${user.profileImage ? `<img src="${user.profileImage}" alt="">` : initial}
          </div>
          <span class="user-nickname">${user.nickname}</span>
        </a>
        <button class="auth-btn" onclick="handleLogout()">로그아웃</button>
      </div>
    `;
  }
}

function handleLogout() {
  clearUser();
  location.href = '/';
}

// ============================================
// API
// ============================================
async function fetchStats() {
  try {
    const res = await fetch(`${API}/admin/stats`);
    return await res.json();
  } catch (e) {
    console.error('fetchStats error:', e);
    return {};
  }
}

async function fetchAdminData(endpoint) {
  const user = getUser();
  if (!user) return [];
  
  try {
    const res = await fetch(`${API}/admin/${endpoint}?adminUserId=${user.id}`);
    if (!res.ok) {
      console.error(`fetchAdminData ${endpoint} error:`, res.status);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.error('fetchAdminData error:', e);
    return [];
  }
}

async function adminPost(endpoint, data) {
  const user = getUser();
  try {
    const res = await fetch(`${API}/admin/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, adminUserId: user.id })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

async function adminPut(endpoint, id, data) {
  const user = getUser();
  try {
    const res = await fetch(`${API}/admin/${endpoint}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, adminUserId: user.id })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

async function adminDelete(endpoint, id) {
  const user = getUser();
  try {
    const res = await fetch(`${API}/admin/${endpoint}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUserId: user.id })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

// ============================================
// 통계 렌더링
// ============================================
async function renderStats() {
  const stats = await fetchStats();
  document.getElementById('stat-users').textContent = stats.userCount || 0;
  document.getElementById('stat-anime').textContent = stats.animeCount || 0;
  document.getElementById('stat-reviews').textContent = stats.reviewCount || 0;
  document.getElementById('stat-comments').textContent = stats.commentCount || 0;
}

// ============================================
// 탭 전환
// ============================================
function showTab(tab) {
  currentTab = tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  renderTabContent(tab);
}

async function renderTabContent(tab) {
  const container = document.getElementById('admin-content');
  
  switch (tab) {
    case 'anime':
      await renderAnimeTab(container);
      break;
    case 'series':
      await renderSeriesTab(container);
      break;
    case 'categories':
      await renderCategoriesTab(container);
      break;
    case 'users':
      await renderUsersTab(container);
      break;
    case 'reviews':
      await renderReviewsTab(container);
      break;
  }
}

// ============================================
// 애니 관리 탭
// ============================================
async function renderAnimeTab(container) {
  const animes = await fetchAdminData('anime');
  const categories = await fetchAdminData('categories');
  const series = await fetchAdminData('series');
  
  window.adminCategories = categories;
  window.adminSeries = series;
  window.adminAnimes = animes;
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>애니 목록 (${animes.length}개)</h2>
        <button class="add-btn" onclick="openAddAnimeModal()">+ 새 애니</button>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>커버</th>
            <th>제목</th>
            <th>시리즈</th>
            <th>리뷰</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${animes.map(a => `
            <tr>
              <td>${a.id}</td>
              <td><img src="${a.coverImage || ''}" class="table-img" alt=""></td>
              <td>${a.title}</td>
              <td>${a.parentTitle || '-'}</td>
              <td>${a.reviewCount}</td>
              <td>
                <button class="action-btn edit" onclick="openEditAnimeModal(${a.id})">수정</button>
                <button class="action-btn delete" onclick="deleteAnime(${a.id})">삭제</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAddAnimeModal() {
  const categories = window.adminCategories || [];
  const series = window.adminSeries || [];
  
  openModal('새 애니 추가', `
    <form onsubmit="handleAddAnime(event)">
      <div class="form-group">
        <label>제목</label>
        <input type="text" id="modal-title" required>
      </div>
      <div class="form-group">
        <label>커버 이미지 URL</label>
        <input type="url" id="modal-cover">
      </div>
      <div class="form-group">
        <label>시리즈</label>
        <select id="modal-series">
          <option value="">없음</option>
          ${series.map(s => `<option value="${s.id}">${s.title}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>카테고리</label>
        <div class="checkbox-group">
          ${categories.map(c => `
            <label class="checkbox-label">
              <input type="checkbox" name="categories" value="${c.id}"> ${c.icon} ${c.name}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="cancel-btn" onclick="closeModal()">취소</button>
        <button type="submit" class="auth-btn primary">추가</button>
      </div>
    </form>
  `);
}

async function handleAddAnime(e) {
  e.preventDefault();
  
  const title = document.getElementById('modal-title').value;
  const coverImage = document.getElementById('modal-cover').value;
  const parentId = document.getElementById('modal-series').value || null;
  const categories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(cb => parseInt(cb.value));
  
  const result = await adminPost('anime', { title, coverImage, parentId, categories });
  
  if (result.id) {
    closeModal();
    renderTabContent('anime');
    renderStats();
  } else {
    alert(result.error || '추가 실패');
  }
}

async function openEditAnimeModal(id) {
  const anime = window.adminAnimes.find(a => a.id === id);
  const categories = window.adminCategories || [];
  const series = window.adminSeries || [];
  const animeCatIds = anime.categoryIds || [];
  
  openModal('애니 수정', `
    <form onsubmit="handleEditAnime(event, ${id})">
      <div class="form-group">
        <label>제목</label>
        <input type="text" id="modal-title" value="${anime.title}" required>
      </div>
      <div class="form-group">
        <label>커버 이미지 URL</label>
        <input type="url" id="modal-cover" value="${anime.coverImage || ''}">
      </div>
      <div class="form-group">
        <label>시리즈</label>
        <select id="modal-series">
          <option value="">없음</option>
          ${series.map(s => `<option value="${s.id}" ${anime.parentId == s.id ? 'selected' : ''}>${s.title}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>카테고리</label>
        <div class="checkbox-group">
          ${categories.map(c => `
            <label class="checkbox-label">
              <input type="checkbox" name="categories" value="${c.id}" ${animeCatIds.includes(c.id) ? 'checked' : ''}> ${c.icon} ${c.name}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="cancel-btn" onclick="closeModal()">취소</button>
        <button type="submit" class="auth-btn primary">수정</button>
      </div>
    </form>
  `);
}

async function handleEditAnime(e, id) {
  e.preventDefault();
  
  const title = document.getElementById('modal-title').value;
  const coverImage = document.getElementById('modal-cover').value;
  const parentId = document.getElementById('modal-series').value || null;
  const categories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(cb => parseInt(cb.value));
  
  const result = await adminPut('anime', id, { title, coverImage, parentId, categories });
  
  if (result.message) {
    closeModal();
    renderTabContent('anime');
  } else {
    alert(result.error || '수정 실패');
  }
}

async function deleteAnime(id) {
  if (!confirm('정말 삭제하시겠습니까? 관련 리뷰도 모두 삭제됩니다.')) return;
  
  const result = await adminDelete('anime', id);
  if (result.message) {
    renderTabContent('anime');
    renderStats();
  } else {
    alert(result.error || '삭제 실패');
  }
}

// ============================================
// 시리즈 관리 탭
// ============================================
let allSeriesData = [];

async function renderSeriesTab(container) {
  const series = await fetchAdminData('series');
  const animes = await fetchAdminData('anime');
  
  allSeriesData = series;
  window.allAnimesForSeries = animes;
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>시리즈 목록 (${series.length}개)</h2>
        <button class="add-btn" onclick="openAddSeriesModal()">+ 새 시리즈</button>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>제목</th>
            <th>연결된 애니</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${series.map(s => `
            <tr>
              <td>${s.id}</td>
              <td>${s.title}</td>
              <td>
                ${s.animes && s.animes.length > 0 
                  ? s.animes.map(a => `<span class="anime-tag">${a.title}</span>`).join(' ')
                  : '<span class="no-anime">없음</span>'}
              </td>
              <td>
                <button class="action-btn edit" onclick="openEditSeriesModal(${s.id})">수정</button>
                <button class="action-btn delete" onclick="deleteSeries(${s.id})">삭제</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAddSeriesModal() {
  const animes = window.allAnimesForSeries || [];
  // 시리즈에 연결되지 않은 애니만
  const availableAnimes = animes.filter(a => !a.parentId);
  
  openModal('새 시리즈 추가', `
    <form onsubmit="handleAddSeries(event)">
      <div class="form-group">
        <label>시리즈 이름</label>
        <input type="text" id="modal-title" required>
      </div>
      <div class="form-group">
        <label>연결할 애니</label>
        <div class="anime-checkbox-list">
          ${availableAnimes.length > 0 
            ? availableAnimes.map(a => `
                <label class="checkbox-label">
                  <input type="checkbox" name="animes" value="${a.id}"> ${a.title}
                </label>
              `).join('')
            : '<p class="no-anime">연결 가능한 애니가 없습니다</p>'}
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="cancel-btn" onclick="closeModal()">취소</button>
        <button type="submit" class="auth-btn primary">추가</button>
      </div>
    </form>
  `);
}

async function handleAddSeries(e) {
  e.preventDefault();
  
  const title = document.getElementById('modal-title').value;
  const animeIds = Array.from(document.querySelectorAll('input[name="animes"]:checked')).map(cb => parseInt(cb.value));
  
  const result = await adminPost('series', { title });
  
  if (result.id) {
    // 애니 연결
    if (animeIds.length > 0) {
      await adminPut('series', result.id, { title, animeIds });
    }
    closeModal();
    renderTabContent('series');
  } else {
    alert(result.error || '추가 실패');
  }
}

function openEditSeriesModal(id) {
  const series = allSeriesData.find(s => s.id === id);
  const animes = window.allAnimesForSeries || [];
  const connectedIds = (series.animes || []).map(a => a.id);
  
  // 현재 시리즈에 연결된 애니 + 연결되지 않은 애니
  const availableAnimes = animes.filter(a => !a.parentId || connectedIds.includes(a.id));
  
  openModal('시리즈 수정', `
    <form onsubmit="handleEditSeries(event, ${id})">
      <div class="form-group">
        <label>시리즈 이름</label>
        <input type="text" id="modal-title" value="${series.title}" required>
      </div>
      <div class="form-group">
        <label>연결할 애니</label>
        <div class="anime-checkbox-list">
          ${availableAnimes.length > 0 
            ? availableAnimes.map(a => `
                <label class="checkbox-label">
                  <input type="checkbox" name="animes" value="${a.id}" ${connectedIds.includes(a.id) ? 'checked' : ''}> ${a.title}
                </label>
              `).join('')
            : '<p class="no-anime">연결 가능한 애니가 없습니다</p>'}
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="cancel-btn" onclick="closeModal()">취소</button>
        <button type="submit" class="auth-btn primary">수정</button>
      </div>
    </form>
  `);
}

async function handleEditSeries(e, id) {
  e.preventDefault();
  
  const title = document.getElementById('modal-title').value;
  const animeIds = Array.from(document.querySelectorAll('input[name="animes"]:checked')).map(cb => parseInt(cb.value));
  
  const result = await adminPut('series', id, { title, animeIds });
  
  if (result.message) {
    closeModal();
    renderTabContent('series');
  } else {
    alert(result.error || '수정 실패');
  }
}

async function deleteSeries(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  
  const result = await adminDelete('series', id);
  if (result.message) {
    renderTabContent('series');
  } else {
    alert(result.error || '삭제 실패');
  }
}

// ============================================
// 카테고리 관리 탭
// ============================================
async function renderCategoriesTab(container) {
  const categories = await fetchAdminData('categories');
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>카테고리 목록 (${categories.length}개)</h2>
        <button class="add-btn" onclick="openAddCategoryModal()">+ 새 카테고리</button>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>아이콘</th>
            <th>이름</th>
            <th>순서</th>
            <th>애니 수</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${categories.map(c => `
            <tr>
              <td>${c.id}</td>
              <td>${c.icon}</td>
              <td>${c.name}</td>
              <td>${c.sortOrder}</td>
              <td>${c.animeCount}</td>
              <td>
                <button class="action-btn edit" onclick='openEditCategoryModal(${c.id}, "${c.name}", "${c.icon}", ${c.sortOrder})'>수정</button>
                <button class="action-btn delete" onclick="deleteCategory(${c.id})">삭제</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAddCategoryModal() {
  openModal('새 카테고리 추가', `
    <form onsubmit="handleAddCategory(event)">
      <div class="form-group">
        <label>이름</label>
        <input type="text" id="modal-name" required>
      </div>
      <div class="form-group">
        <label>아이콘 (이모지)</label>
        <input type="text" id="modal-icon" value="📁">
      </div>
      <div class="form-group">
        <label>정렬 순서</label>
        <input type="number" id="modal-order" value="0">
      </div>
      <div class="modal-actions">
        <button type="button" class="cancel-btn" onclick="closeModal()">취소</button>
        <button type="submit" class="auth-btn primary">추가</button>
      </div>
    </form>
  `);
}

async function handleAddCategory(e) {
  e.preventDefault();
  
  const name = document.getElementById('modal-name').value;
  const icon = document.getElementById('modal-icon').value;
  const sortOrder = parseInt(document.getElementById('modal-order').value) || 0;
  
  const result = await adminPost('categories', { name, icon, sortOrder });
  
  if (result.id) {
    closeModal();
    renderTabContent('categories');
  } else {
    alert(result.error || '추가 실패');
  }
}

function openEditCategoryModal(id, name, icon, sortOrder) {
  openModal('카테고리 수정', `
    <form onsubmit="handleEditCategory(event, ${id})">
      <div class="form-group">
        <label>이름</label>
        <input type="text" id="modal-name" value="${name}" required>
      </div>
      <div class="form-group">
        <label>아이콘 (이모지)</label>
        <input type="text" id="modal-icon" value="${icon}">
      </div>
      <div class="form-group">
        <label>정렬 순서</label>
        <input type="number" id="modal-order" value="${sortOrder}">
      </div>
      <div class="modal-actions">
        <button type="button" class="cancel-btn" onclick="closeModal()">취소</button>
        <button type="submit" class="auth-btn primary">수정</button>
      </div>
    </form>
  `);
}

async function handleEditCategory(e, id) {
  e.preventDefault();
  
  const name = document.getElementById('modal-name').value;
  const icon = document.getElementById('modal-icon').value;
  const sortOrder = parseInt(document.getElementById('modal-order').value) || 0;
  
  const result = await adminPut('categories', id, { name, icon, sortOrder });
  
  if (result.message) {
    closeModal();
    renderTabContent('categories');
  } else {
    alert(result.error || '수정 실패');
  }
}

async function deleteCategory(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  
  const result = await adminDelete('categories', id);
  if (result.message) {
    renderTabContent('categories');
  } else {
    alert(result.error || '삭제 실패');
  }
}

// ============================================
// 유저 관리 탭
// ============================================
async function renderUsersTab(container) {
  const users = await fetchAdminData('users');
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>유저 목록 (${users.length}명)</h2>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>아이디</th>
            <th>닉네임</th>
            <th>관리자</th>
            <th>리뷰</th>
            <th>댓글</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${u.id}</td>
              <td>${u.username}</td>
              <td>${u.nickname}</td>
              <td>${u.isAdmin ? '✅' : ''}</td>
              <td>${u.reviewCount}</td>
              <td>${u.commentCount}</td>
              <td>
                <button class="action-btn edit" onclick="toggleAdmin(${u.id}, ${u.isAdmin})">${u.isAdmin ? '권한 해제' : '관리자 부여'}</button>
                <button class="action-btn delete" onclick="deleteUser(${u.id})">삭제</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function toggleAdmin(id, currentStatus) {
  const action = currentStatus ? '관리자 권한을 해제' : '관리자 권한을 부여';
  if (!confirm(`정말 ${action}하시겠습니까?`)) return;
  
  const result = await adminPut('users', id, { isAdmin: !currentStatus });
  if (result.message) {
    renderTabContent('users');
  } else {
    alert(result.error || '수정 실패');
  }
}

async function deleteUser(id) {
  const user = getUser();
  if (user.id === id) {
    alert('자기 자신은 삭제할 수 없습니다.');
    return;
  }
  
  if (!confirm('정말 삭제하시겠습니까?')) return;
  
  const result = await adminDelete('users', id);
  if (result.message) {
    renderTabContent('users');
    renderStats();
  } else {
    alert(result.error || '삭제 실패');
  }
}

// ============================================
// 리뷰 관리 탭
// ============================================
async function renderReviewsTab(container) {
  const reviews = await fetchAdminData('reviews');
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>리뷰 목록 (${reviews.length}개)</h2>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>애니</th>
            <th>작성자</th>
            <th>티어</th>
            <th>한줄평</th>
            <th>조회</th>
            <th>댓글</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${reviews.map(r => `
            <tr>
              <td>${r.id}</td>
              <td>${r.animeTitle || '-'}</td>
              <td>${r.authorName || '-'}</td>
              <td><span class="tier tier-${r.tier.toLowerCase()}">${r.tier}</span></td>
              <td class="oneliner-cell">${r.oneLiner || ''}</td>
              <td>${r.viewCount}</td>
              <td>${r.commentCount}</td>
              <td>
                <a href="/review.html?id=${r.id}" class="action-btn edit" target="_blank">보기</a>
                <button class="action-btn delete" onclick="deleteReview(${r.id})">삭제</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function deleteReview(id) {
  if (!confirm('정말 삭제하시겠습니까? 댓글도 모두 삭제됩니다.')) return;
  
  const result = await adminDelete('reviews', id);
  if (result.message) {
    renderTabContent('reviews');
    renderStats();
  } else {
    alert(result.error || '삭제 실패');
  }
}

// ============================================
// 모달
// ============================================
function openModal(title, content) {
  closeModal();
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'admin-modal';
  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function closeModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.remove();
}

// ============================================
// 초기화
// ============================================
async function init() {
  try {
    if (!checkAdminAccess()) return;
    
    renderAuthHeader();
    await renderStats();
    await renderTabContent('anime');
  } catch (e) {
    console.error('Admin init error:', e);
    alert('페이지 로딩 중 오류가 발생했습니다.');
  }
}

document.addEventListener('DOMContentLoaded', init);