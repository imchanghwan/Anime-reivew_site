// ============================================
// 상수 및 상태
// ============================================
const API = '/api';
let currentTab = 'anime';

// 각 탭별 데이터, 검색어, 정렬 상태
let adminData = {
  anime: { items: [], search: '', sort: 'id', order: 'desc' },
  series: { items: [], search: '', sort: 'id', order: 'desc' },
  categories: { items: [], search: '', sort: 'sortOrder', order: 'asc' },
  users: { items: [], search: '', sort: 'id', order: 'desc' },
  reviews: { items: [], search: '', sort: 'id', order: 'desc' }
};

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
// 검색/정렬 유틸리티
// ============================================
function filterItems(items, search, fields) {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter(item => 
    fields.some(field => {
      const val = item[field];
      return val && String(val).toLowerCase().includes(q);
    })
  );
}

function sortItems(items, sort, order) {
  return [...items].sort((a, b) => {
    let aVal = a[sort];
    let bVal = b[sort];
    
    // 숫자 비교
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // 문자열 비교
    aVal = String(aVal || '').toLowerCase();
    bVal = String(bVal || '').toLowerCase();
    if (order === 'asc') {
      return aVal.localeCompare(bVal);
    } else {
      return bVal.localeCompare(aVal);
    }
  });
}

function handleSearch(tab, value) {
  adminData[tab].search = value;
  updateTableBody(tab);
}

function handleSort(tab, field) {
  const data = adminData[tab];
  if (data.sort === field) {
    data.order = data.order === 'asc' ? 'desc' : 'asc';
  } else {
    data.sort = field;
    data.order = 'asc';
  }
  updateTableBody(tab);
  updateTableHeader(tab);
}

function updateTableHeader(tab) {
  const headers = document.querySelectorAll('.admin-table th.sortable');
  headers.forEach(th => {
    const onclick = th.getAttribute('onclick');
    if (onclick && onclick.includes(`'${tab}'`)) {
      const match = onclick.match(/handleSort\('(\w+)',\s*'(\w+)'\)/);
      if (match) {
        const field = match[2];
        const text = th.textContent.replace(/ [▲▼]$/, '');
        th.textContent = text + getSortIcon(tab, field);
      }
    }
  });
}

function updateTableBody(tab) {
  const data = adminData[tab];
  const { search, sort, order, items } = data;
  
  let filtered;
  switch (tab) {
    case 'anime':
      filtered = filterItems(items, search, ['title', 'parentTitle']);
      break;
    case 'series':
      filtered = filterItems(items, search, ['title']);
      break;
    case 'categories':
      filtered = filterItems(items, search, ['name', 'icon']);
      break;
    case 'users':
      filtered = filterItems(items, search, ['username', 'nickname']);
      break;
    case 'reviews':
      filtered = filterItems(items, search, ['animeTitle', 'authorName', 'oneLiner', 'tier']);
      break;
    default:
      filtered = items;
  }
  
  filtered = sortItems(filtered, sort, order);
  
  // 카운트 업데이트
  const countEl = document.querySelector('.admin-section h2');
  if (countEl) {
    const label = tab === 'users' ? '명' : '개';
    const name = { anime: '애니', series: '시리즈', categories: '카테고리', users: '유저', reviews: '리뷰' }[tab];
    countEl.textContent = `${name} 목록 (${filtered.length}${label})`;
  }
  
  // tbody 업데이트
  const tbody = document.querySelector('.admin-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = getTableRows(tab, filtered);
}

function getTableRows(tab, items) {
  switch (tab) {
    case 'anime':
      return items.map(a => `
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
      `).join('');
      
    case 'series':
      return items.map(s => `
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
      `).join('');
      
    case 'categories':
      return items.map(c => `
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
      `).join('');
      
    case 'users':
      return items.map(u => `
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
      `).join('');
      
    case 'reviews':
      return items.map(r => `
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
      `).join('');
      
    default:
      return '';
  }
}

function getSortIcon(tab, field) {
  const data = adminData[tab];
  if (data.sort !== field) return '';
  return data.order === 'asc' ? ' ▲' : ' ▼';
}

async function renderCurrentTab() {
  const container = document.getElementById('tab-content');
  if (!container) return;
  
  switch (currentTab) {
    case 'anime': await renderAnimeTab(container); break;
    case 'series': await renderSeriesTab(container); break;
    case 'categories': await renderCategoriesTab(container); break;
    case 'users': await renderUsersTab(container); break;
    case 'reviews': await renderReviewsTab(container); break;
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
  if (!container) container = document.getElementById('tab-content');
  if (!container) return;
  
  // 데이터 로드 (최초 1회)
  if (adminData.anime.items.length === 0 || !window.adminAnimesLoaded) {
    adminData.anime.items = await fetchAdminData('anime');
    window.adminCategories = await fetchAdminData('categories');
    window.adminSeries = await fetchAdminData('series');
    window.adminAnimesLoaded = true;
  }
  
  window.adminAnimes = adminData.anime.items;
  
  const { search, sort, order } = adminData.anime;
  let items = filterItems(adminData.anime.items, search, ['title', 'parentTitle']);
  items = sortItems(items, sort, order);
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>애니 목록 (${items.length}개)</h2>
        <div class="header-actions">
          <input type="text" class="search-input" placeholder="제목, 시리즈 검색..." 
                 value="${search}" oninput="handleSearch('anime', this.value)">
          <button class="add-btn" onclick="openAddAnimeModal()">+ 새 애니</button>
        </div>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th class="sortable" onclick="handleSort('anime', 'id')">ID${getSortIcon('anime', 'id')}</th>
            <th>커버</th>
            <th class="sortable" onclick="handleSort('anime', 'title')">제목${getSortIcon('anime', 'title')}</th>
            <th class="sortable" onclick="handleSort('anime', 'parentTitle')">시리즈${getSortIcon('anime', 'parentTitle')}</th>
            <th class="sortable" onclick="handleSort('anime', 'reviewCount')">리뷰${getSortIcon('anime', 'reviewCount')}</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(a => `
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
    window.adminAnimesLoaded = false;
    adminData.anime.items = [];
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
  if (!container) container = document.getElementById('tab-content');
  if (!container) return;
  
  if (adminData.series.items.length === 0 || !window.adminSeriesLoaded) {
    adminData.series.items = await fetchAdminData('series');
    window.allAnimesForSeries = await fetchAdminData('anime');
    window.adminSeriesLoaded = true;
  }
  
  allSeriesData = adminData.series.items;
  
  const { search, sort, order } = adminData.series;
  let items = filterItems(adminData.series.items, search, ['title']);
  items = sortItems(items, sort, order);
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>시리즈 목록 (${items.length}개)</h2>
        <div class="header-actions">
          <input type="text" class="search-input" placeholder="시리즈 이름 검색..." 
                 value="${search}" oninput="handleSearch('series', this.value)">
          <button class="add-btn" onclick="openAddSeriesModal()">+ 새 시리즈</button>
        </div>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th class="sortable" onclick="handleSort('series', 'id')">ID${getSortIcon('series', 'id')}</th>
            <th class="sortable" onclick="handleSort('series', 'title')">제목${getSortIcon('series', 'title')}</th>
            <th>연결된 애니</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(s => `
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
  if (!container) container = document.getElementById('tab-content');
  if (!container) return;
  
  if (adminData.categories.items.length === 0 || !window.adminCategoriesLoaded) {
    adminData.categories.items = await fetchAdminData('categories');
    window.adminCategoriesLoaded = true;
  }
  
  const { search, sort, order } = adminData.categories;
  let items = filterItems(adminData.categories.items, search, ['name', 'icon']);
  items = sortItems(items, sort, order);
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>카테고리 목록 (${items.length}개)</h2>
        <div class="header-actions">
          <input type="text" class="search-input" placeholder="이름 검색..." 
                 value="${search}" oninput="handleSearch('categories', this.value)">
          <button class="add-btn" onclick="openAddCategoryModal()">+ 새 카테고리</button>
        </div>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th class="sortable" onclick="handleSort('categories', 'id')">ID${getSortIcon('categories', 'id')}</th>
            <th>아이콘</th>
            <th class="sortable" onclick="handleSort('categories', 'name')">이름${getSortIcon('categories', 'name')}</th>
            <th class="sortable" onclick="handleSort('categories', 'sortOrder')">순서${getSortIcon('categories', 'sortOrder')}</th>
            <th class="sortable" onclick="handleSort('categories', 'animeCount')">애니 수${getSortIcon('categories', 'animeCount')}</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(c => `
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
  if (!container) container = document.getElementById('tab-content');
  if (!container) return;
  
  if (adminData.users.items.length === 0 || !window.adminUsersLoaded) {
    adminData.users.items = await fetchAdminData('users');
    window.adminUsersLoaded = true;
  }
  
  const { search, sort, order } = adminData.users;
  let items = filterItems(adminData.users.items, search, ['username', 'nickname']);
  items = sortItems(items, sort, order);
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>유저 목록 (${items.length}명)</h2>
        <div class="header-actions">
          <input type="text" class="search-input" placeholder="아이디, 닉네임 검색..." 
                 value="${search}" oninput="handleSearch('users', this.value)">
        </div>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th class="sortable" onclick="handleSort('users', 'id')">ID${getSortIcon('users', 'id')}</th>
            <th class="sortable" onclick="handleSort('users', 'username')">아이디${getSortIcon('users', 'username')}</th>
            <th class="sortable" onclick="handleSort('users', 'nickname')">닉네임${getSortIcon('users', 'nickname')}</th>
            <th>관리자</th>
            <th class="sortable" onclick="handleSort('users', 'reviewCount')">리뷰${getSortIcon('users', 'reviewCount')}</th>
            <th class="sortable" onclick="handleSort('users', 'commentCount')">댓글${getSortIcon('users', 'commentCount')}</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(u => `
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
  if (!container) container = document.getElementById('tab-content');
  if (!container) return;
  
  if (adminData.reviews.items.length === 0 || !window.adminReviewsLoaded) {
    adminData.reviews.items = await fetchAdminData('reviews');
    window.adminReviewsLoaded = true;
  }
  
  const { search, sort, order } = adminData.reviews;
  let items = filterItems(adminData.reviews.items, search, ['animeTitle', 'authorName', 'oneLiner', 'tier']);
  items = sortItems(items, sort, order);
  
  container.innerHTML = `
    <div class="admin-section">
      <div class="section-header">
        <h2>리뷰 목록 (${items.length}개)</h2>
        <div class="header-actions">
          <input type="text" class="search-input" placeholder="애니, 작성자, 한줄평 검색..." 
                 value="${search}" oninput="handleSearch('reviews', this.value)">
        </div>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th class="sortable" onclick="handleSort('reviews', 'id')">ID${getSortIcon('reviews', 'id')}</th>
            <th class="sortable" onclick="handleSort('reviews', 'animeTitle')">애니${getSortIcon('reviews', 'animeTitle')}</th>
            <th class="sortable" onclick="handleSort('reviews', 'authorName')">작성자${getSortIcon('reviews', 'authorName')}</th>
            <th class="sortable" onclick="handleSort('reviews', 'tier')">티어${getSortIcon('reviews', 'tier')}</th>
            <th>한줄평</th>
            <th class="sortable" onclick="handleSort('reviews', 'viewCount')">조회${getSortIcon('reviews', 'viewCount')}</th>
            <th class="sortable" onclick="handleSort('reviews', 'commentCount')">댓글${getSortIcon('reviews', 'commentCount')}</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(r => `
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
    window.adminReviewsLoaded = false;
    adminData.reviews.items = [];
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