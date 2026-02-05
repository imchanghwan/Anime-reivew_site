/**
 * 오덕후 - 메인 페이지
 */

const API = '/api';

// ============================================
// 유저 상태 관리 (localStorage)
// ============================================
function getUser() {
  const user = localStorage.getItem('anilog_user');
  return user ? JSON.parse(user) : null;
}

function setUser(user) {
  localStorage.setItem('anilog_user', JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem('anilog_user');
}

// ============================================
// API
// ============================================
async function fetchFeatured() {
  try {
    const res = await fetch(`${API}/featured`);
    return await res.json();
  } catch (e) {
    console.error('Featured API 실패:', e);
    return [];
  }
}

async function fetchRecentActivity() {
  try {
    const res = await fetch(`${API}/recent-activity`);
    return await res.json();
  } catch (e) {
    console.error('Recent Activity API 실패:', e);
    return [];
  }
}

async function fetchAllAnime() {
  try {
    const res = await fetch(`${API}/all-anime`);
    return await res.json();
  } catch (e) {
    console.error('All Anime API 실패:', e);
    return [];
  }
}

async function fetchCategories() {
  try {
    const res = await fetch(`${API}/categories`);
    return await res.json();
  } catch (e) {
    console.error('Categories API 실패:', e);
    return [];
  }
}

async function login(username, password) {
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

async function register(username, password, nickname) {
  try {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, nickname })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

// ============================================
// 헤더 인증 UI
// ============================================
function renderAuthHeader() {
  const container = document.getElementById('header-auth');
  if (!container) return;
  
  const user = getUser();
  const floatingBtn = document.getElementById('floating-write-btn');
  
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
    // 플로팅 버튼 표시
    if (floatingBtn) floatingBtn.style.display = 'flex';
  } else {
    container.innerHTML = `
      <button class="auth-btn" onclick="showLoginModal()">로그인</button>
      <button class="auth-btn primary" onclick="showRegisterModal()">회원가입</button>
    `;
    // 플로팅 버튼 숨김
    if (floatingBtn) floatingBtn.style.display = 'none';
  }
}

function handleLogout() {
  clearUser();
  renderAuthHeader();
}

// 리뷰 작성 페이지 이동 (로그인 체크)
function goToWrite(e) {
  e.preventDefault();
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    showLoginModal();
    return;
  }
  location.href = '/write.html';
}

// ============================================
// 모달
// ============================================
function closeModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.remove();
}

function showLoginModal() {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'auth-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">로그인</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form class="modal-form" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label>아이디</label>
          <input type="text" id="login-username" required>
        </div>
        <div class="form-group">
          <label>비밀번호</label>
          <input type="password" id="login-password" required>
        </div>
        <div class="modal-actions">
          <button type="submit" class="auth-btn primary" style="width:100%">로그인</button>
        </div>
        <p class="modal-switch">
          계정이 없으신가요? <a onclick="showRegisterModal()">회원가입</a>
        </p>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function showRegisterModal() {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'auth-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">회원가입</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form class="modal-form" onsubmit="handleRegister(event)">
        <div class="form-group">
          <label>아이디 (4자 이상)</label>
          <input type="text" id="reg-username" minlength="4" required>
        </div>
        <div class="form-group">
          <label>비밀번호 (4자 이상)</label>
          <input type="password" id="reg-password" minlength="4" required>
        </div>
        <div class="form-group">
          <label>비밀번호 확인</label>
          <input type="password" id="reg-password-confirm" minlength="4" required>
        </div>
        <div class="form-group">
          <label>닉네임</label>
          <input type="text" id="reg-nickname" required>
        </div>
        <div class="modal-actions">
          <button type="submit" class="auth-btn primary" style="width:100%">가입하기</button>
        </div>
        <p class="modal-switch">
          이미 계정이 있으신가요? <a onclick="showLoginModal()">로그인</a>
        </p>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  
  const result = await login(username, password);
  
  if (result.user) {
    setUser(result.user);
    closeModal();
    renderAuthHeader();
    alert(`${result.user.nickname}님 환영합니다!`);
  } else {
    alert(result.error || '로그인 실패');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;
  const passwordConfirm = document.getElementById('reg-password-confirm').value;
  const nickname = document.getElementById('reg-nickname').value;
  
  if (password !== passwordConfirm) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }
  
  const result = await register(username, password, nickname);
  
  if (result.id) {
    const loginResult = await login(username, password);
    if (loginResult.user) {
      setUser(loginResult.user);
      closeModal();
      renderAuthHeader();
      alert(`${loginResult.user.nickname}님 환영합니다!`);
    } else {
      alert('가입 완료! 로그인해주세요.');
      showLoginModal();
    }
  } else {
    alert(result.error || '가입 실패');
  }
}

// ============================================
// DOM - Featured Card
// ============================================
function createFeaturedCard(anime) {
  const tierClass = anime.tier ? `tier-${anime.tier.toLowerCase()}` : '';
  const reviewerText = anime.reviewer ? ` - ${anime.reviewer}` : '';
  
  const card = document.createElement('article');
  card.className = 'featured-card';
  
  card.innerHTML = `
    <div class="featured-poster">
      <img src="${anime.coverImage || ''}" alt="${anime.title}">
    </div>
    <div class="featured-content">
      <div class="featured-header">
        ${anime.tier ? `<span class="tier ${tierClass}">${anime.tier}</span>` : ''}
        <h3 class="featured-title">${anime.title}</h3>
        <div class="featured-rating">
          <span class="star">★</span>
          <span class="rating-value">${anime.rating}</span>
        </div>
      </div>
      <p class="featured-quote">"${anime.oneLiner || ''}"${reviewerText}</p>
    </div>
  `;
  
  card.addEventListener('click', () => {
    window.location.href = `/anime.html?id=${anime.id}`;
  });
  
  return card;
}

// ============================================
// DOM - List Card
// ============================================
function createListCard(anime) {
  const tierClass = anime.tier ? `tier-${anime.tier.toLowerCase()}` : '';
  
  const card = document.createElement('article');
  card.className = 'list-card';
  
  card.innerHTML = `
    <div class="list-poster">
      <img src="${anime.coverImage || ''}" alt="${anime.title}">
      ${anime.tier ? `<span class="list-tier ${tierClass}">${anime.tier}</span>` : ''}
    </div>
    <div class="list-info">
      <div class="list-header">
        <h4 class="list-title">${anime.title}</h4>
        <div class="list-rating">
          <span class="star">★</span>
          <span>${anime.rating}</span>
        </div>
      </div>
      <p class="list-quote">"${anime.oneLiner || ''}"</p>
    </div>
  `;
  
  card.addEventListener('click', () => {
    window.location.href = `/anime.html?id=${anime.id}`;
  });
  
  return card;
}

// ============================================
// DOM - Category Block
// ============================================
function createCategoryBlock(category) {
  const block = document.createElement('div');
  block.className = 'category-block';
  
  block.innerHTML = `
    <h3 class="category-title">${category.icon} ${category.name}</h3>
    <div class="category-scroll-wrapper">
      <div class="category-list"></div>
    </div>
  `;
  
  const list = block.querySelector('.category-list');
  category.animeList.forEach(anime => {
    list.appendChild(createListCard(anime));
  });
  
  return block;
}

// ============================================
// 렌더링
// ============================================
function renderFeatured(data) {
  const container = document.getElementById('featured-anime');
  if (!container) return;
  
  container.innerHTML = '';
  data.slice(0, 3).forEach(anime => {
    container.appendChild(createFeaturedCard(anime));
  });
}

function renderCategories(data) {
  const container = document.getElementById('category-anime');
  if (!container) return;
  
  container.innerHTML = '';
  data.forEach(cat => {
    if (cat.animeList && cat.animeList.length > 0) {
      // "모든 애니" 카테고리는 제외 (별도 섹션으로)
      if (cat.name !== '모든 애니') {
        container.appendChild(createCategoryBlock(cat));
      }
    }
  });
}

// ============================================
// DOM - 최근 활동 섹션
// ============================================
function renderRecentActivity(data) {
  const container = document.getElementById('recent-activity');
  if (!container || data.length === 0) {
    if (container) container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  const list = container.querySelector('.recent-activity-list');
  if (!list) return;
  
  list.innerHTML = '';
  data.forEach(anime => {
    const tierClass = anime.tier ? `tier-${anime.tier.toLowerCase()}` : '';
    const card = document.createElement('div');
    card.className = 'recent-activity-card';
    card.innerHTML = `
      <img src="${anime.coverImage || ''}" alt="${anime.title}" class="recent-activity-img">
      <div class="recent-activity-info">
        <span class="recent-activity-title">${anime.title}</span>
        ${anime.tier ? `<span class="tier ${tierClass} tier-small">${anime.tier}</span>` : ''}
      </div>
    `;
    card.addEventListener('click', () => {
      window.location.href = `/anime.html?id=${anime.id}`;
    });
    list.appendChild(card);
  });
}

// ============================================
// DOM - 모든 애니 섹션
// ============================================
function renderAllAnime(data) {
  const container = document.getElementById('all-anime');
  if (!container) return;
  
  const list = container.querySelector('.all-anime-list');
  if (!list) return;
  
  list.innerHTML = '';
  data.forEach(anime => {
    const tierClass = anime.tier ? `tier-${anime.tier.toLowerCase()}` : '';
    const card = document.createElement('div');
    card.className = 'all-anime-card';
    card.innerHTML = `
      <img src="${anime.coverImage || ''}" alt="${anime.title}" class="all-anime-img">
      <div class="all-anime-info">
        <span class="all-anime-title">${anime.title}</span>
        ${anime.tier ? `<span class="tier ${tierClass} tier-small">${anime.tier}</span>` : ''}
      </div>
    `;
    card.addEventListener('click', () => {
      window.location.href = `/anime.html?id=${anime.id}`;
    });
    list.appendChild(card);
  });
}

// ============================================
// 초기화
// ============================================
async function init() {
  renderAuthHeader();
  
  const [featured, recentActivity, allAnime, categories] = await Promise.all([
    fetchFeatured(),
    fetchRecentActivity(),
    fetchAllAnime(),
    fetchCategories()
  ]);
  
  // 검색용 애니 목록 저장
  window.allAnimeList = allAnime;
  
  renderFeatured(featured);
  renderRecentActivity(recentActivity);
  renderAllAnime(allAnime);
  renderCategories(categories);
}

// ============================================
// 애니 검색
// ============================================
let searchTimeout = null;

function handleAnimeSearch(query) {
  clearTimeout(searchTimeout);
  
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;
  
  if (!query || query.length < 1) {
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'none';
    return;
  }
  
  searchTimeout = setTimeout(() => {
    const animes = window.allAnimeList || [];
    const q = query.toLowerCase();
    const filtered = animes.filter(a => a.title.toLowerCase().includes(q)).slice(0, 8);
    
    if (filtered.length === 0) {
      resultsContainer.innerHTML = '<div class="search-no-result">검색 결과가 없습니다</div>';
    } else {
      resultsContainer.innerHTML = filtered.map(a => `
        <a href="/anime.html?id=${a.id}" class="search-result-item">
          <img src="${a.coverImage || ''}" alt="" class="search-result-img">
          <div class="search-result-info">
            ${a.tier ? `<span class="tier tier-${a.tier.toLowerCase()} tier-small">${a.tier}</span>` : ''}
            <span class="search-result-title">${a.title}</span>
          </div>
        </a>
      `).join('');
    }
    resultsContainer.style.display = 'block';
  }, 150);
}

function showSearchResults() {
  const input = document.getElementById('anime-search');
  const resultsContainer = document.getElementById('search-results');
  if (input && input.value && resultsContainer && resultsContainer.innerHTML) {
    resultsContainer.style.display = 'block';
  }
}

function hideSearchResultsDelayed() {
  setTimeout(() => {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) resultsContainer.style.display = 'none';
  }, 200);
}

document.addEventListener('DOMContentLoaded', init);