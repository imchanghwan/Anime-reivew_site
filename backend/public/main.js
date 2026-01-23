/**
 * AniLog - 애니메이션 리뷰 사이트
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

async function fetchCategories() {
  try {
    const res = await fetch(`${API}/categories`);
    return await res.json();
  } catch (e) {
    console.error('Categories API 실패:', e);
    return [];
  }
}

async function fetchAnimeList() {
  try {
    const res = await fetch(`${API}/anime-list`);
    return await res.json();
  } catch (e) {
    console.error('AnimeList API 실패:', e);
    return [];
  }
}

async function submitReview(data) {
  try {
    const res = await fetch(`${API}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    console.error('리뷰 작성 실패:', e);
    return null;
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
    console.error('로그인 실패:', e);
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
    console.error('회원가입 실패:', e);
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
  } else {
    container.innerHTML = `
      <button class="auth-btn" onclick="showLoginModal()">로그인</button>
      <button class="auth-btn primary" onclick="showRegisterModal()">회원가입</button>
    `;
  }
}

function handleLogout() {
  clearUser();
  renderAuthHeader();
  // 폼 업데이트
  updateWriteFormForUser();
}

// ============================================
// 모달
// ============================================
function showLoginModal() {
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

function closeModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.remove();
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
    updateWriteFormForUser();
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
  
  // 비밀번호 2중 체크
  if (password !== passwordConfirm) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }
  
  const result = await register(username, password, nickname);
  
  if (result.id) {
    // 가입 성공 후 자동 로그인
    const loginResult = await login(username, password);
    if (loginResult.user) {
      setUser(loginResult.user);
      closeModal();
      renderAuthHeader();
      updateWriteFormForUser();
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
// DOM - Featured Card (상단, 리뷰어 이름 표시)
// ============================================
function createFeaturedCard(anime) {
  const tierClass = `tier-${anime.tier.toLowerCase()}`;
  
  const card = document.createElement('article');
  card.className = 'featured-card';
  
  const reviewerText = anime.reviewer ? ` - ${anime.reviewer}` : '';
  
  card.innerHTML = `
    <div class="featured-poster">
      <img src="${anime.coverImage || ''}" alt="${anime.title}">
    </div>
    <div class="featured-content">
      <div class="featured-header">
        <span class="tier ${tierClass}">${anime.tier}</span>
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
// DOM - List Card (하단, 한줄평 말줄임)
// ============================================
function createListCard(anime) {
  const tierClass = `tier-${anime.tier.toLowerCase()}`;
  
  const card = document.createElement('article');
  card.className = 'list-card';
  
  card.innerHTML = `
    <div class="list-poster">
      <img src="${anime.coverImage || ''}" alt="${anime.title}">
      <span class="list-tier ${tierClass}">${anime.tier}</span>
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
      container.appendChild(createCategoryBlock(cat));
    }
  });
}

// ============================================
// 리뷰 작성 폼
// ============================================
let cachedCategories = [];
let cachedAnimeList = [];

async function renderWriteForm(categories, animeList) {
  cachedCategories = categories;
  cachedAnimeList = animeList;
  
  const container = document.getElementById('write-section');
  if (!container) return;
  
  const user = getUser();
  
  const categoryOptions = categories.map(c => 
    `<label class="checkbox-label">
      <input type="checkbox" name="categories" value="${c.name}"> ${c.icon} ${c.name}
    </label>`
  ).join('');
  
  const animeOptions = animeList.map(a => 
    `<option value="${a.id}" data-has-review="${a.hasReview}">${a.title}${a.hasReview ? ' (리뷰 있음)' : ''}</option>`
  ).join('');
  
  // 로그인 시 작성자/비번 필드 숨김
  const authorFields = user ? `
    <div class="form-group">
      <label>작성자</label>
      <input type="text" value="${user.nickname}" disabled style="background:#f0f0f0">
    </div>
  ` : `
    <div class="form-row" id="guest-fields">
      <div class="form-group">
        <label for="author">작성자</label>
        <input type="text" id="author" name="author" placeholder="익명">
      </div>
      <div class="form-group">
        <label for="password">비밀번호</label>
        <input type="password" id="password" name="password" placeholder="삭제 시 필요">
      </div>
    </div>
  `;
  
  container.innerHTML = `
    <h2 class="section-title">리뷰 작성</h2>
    <form id="review-form" class="review-form">
      <div class="form-group">
        <label>애니 선택</label>
        <select id="anime-select" name="animeId">
          <option value="">-- 새 애니 등록 --</option>
          ${animeOptions}
        </select>
      </div>
      
      <div id="new-anime-fields" class="new-anime-fields">
        <div class="form-group">
          <label for="animeTitle">애니 제목 *</label>
          <input type="text" id="animeTitle" name="animeTitle">
        </div>
        <div class="form-group">
          <label for="animeCoverImage">포스터 URL</label>
          <input type="url" id="animeCoverImage" name="animeCoverImage" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>카테고리</label>
          <div class="checkbox-group">${categoryOptions}</div>
        </div>
      </div>
      
      <div class="form-divider"></div>
      
      ${authorFields}
      
      <div class="form-row">
        <div class="form-group">
          <label for="tier">티어 *</label>
          <select id="tier" name="tier" required>
            <option value="SSS">SSS</option>
            <option value="SS">SS</option>
            <option value="A" selected>A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
          </select>
        </div>
        <div class="form-group">
          <label for="rating">평점 (0-10) *</label>
          <input type="number" id="rating" name="rating" min="0" max="10" step="0.1" required>
        </div>
      </div>
      
      <div class="form-group">
        <label for="oneLiner">한줄평 *</label>
        <input type="text" id="oneLiner" name="oneLiner" placeholder="이 애니를 한 문장으로!" required>
      </div>
      
      <div class="form-group">
        <label for="content">본문 (Markdown)</label>
        <textarea id="content" name="content" rows="8" placeholder="상세 리뷰를 작성하세요..."></textarea>
      </div>
      
      <button type="submit" class="submit-btn">리뷰 등록</button>
    </form>
  `;
  
  const animeSelect = document.getElementById('anime-select');
  const newAnimeFields = document.getElementById('new-anime-fields');
  
  animeSelect.addEventListener('change', () => {
    if (animeSelect.value) {
      newAnimeFields.style.display = 'none';
      // 리뷰 존재 여부 경고
      const selectedOption = animeSelect.options[animeSelect.selectedIndex];
      if (selectedOption.dataset.hasReview === 'true') {
        alert('⚠️ 이 애니에는 이미 리뷰가 있습니다. 리뷰는 애니당 1개만 등록 가능합니다.');
      }
    } else {
      newAnimeFields.style.display = 'block';
    }
  });
  
  document.getElementById('review-form').addEventListener('submit', handleReviewSubmit);
}

function updateWriteFormForUser() {
  renderWriteForm(cachedCategories, cachedAnimeList);
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const user = getUser();
  
  const animeId = formData.get('animeId');
  const selectedCategories = [];
  form.querySelectorAll('input[name="categories"]:checked').forEach(cb => {
    selectedCategories.push(cb.value);
  });
  
  const data = {
    tier: formData.get('tier'),
    rating: parseFloat(formData.get('rating')),
    oneLiner: formData.get('oneLiner'),
    content: formData.get('content')
  };
  
  if (user) {
    data.userId = user.id;
  } else {
    data.author = formData.get('author') || '익명';
    data.password = formData.get('password');
  }
  
  if (animeId) {
    data.animeId = parseInt(animeId);
  } else {
    data.animeTitle = formData.get('animeTitle');
    data.animeCoverImage = formData.get('animeCoverImage');
    data.categories = selectedCategories;
    
    if (!data.animeTitle) {
      alert('새 애니 제목을 입력하세요.');
      return;
    }
  }
  
  const result = await submitReview(data);
  
  if (result && result.id) {
    alert('리뷰가 등록되었습니다!');
    form.reset();
    document.getElementById('new-anime-fields').style.display = 'block';
    init();
  } else {
    alert('등록 실패: ' + (result?.error || '알 수 없는 오류'));
  }
}

// ============================================
// 초기화
// ============================================
async function init() {
  renderAuthHeader();
  
  const [featured, categories, animeList] = await Promise.all([
    fetchFeatured(),
    fetchCategories(),
    fetchAnimeList()
  ]);
  
  renderFeatured(featured);
  renderCategories(categories);
  renderWriteForm(categories, animeList);
}

document.addEventListener('DOMContentLoaded', init);