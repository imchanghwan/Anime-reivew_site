// ============================================
// 상수 및 상태
// ============================================
const API = '/api';
let allAnimes = [];
let isFormDirty = false;

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
  } else {
    container.innerHTML = `<button class="auth-btn" onclick="location.href='/'">로그인</button>`;
  }
}

function handleLogout() {
  clearUser();
  location.href = '/';
}

// ============================================
// API
// ============================================
async function fetchAllAnimes() {
  try {
    const res = await fetch(`${API}/animes`);
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function checkUserReview(animeId, userId) {
  try {
    const res = await fetch(`${API}/anime/${animeId}/reviews`);
    const data = await res.json();
    return data.reviews?.some(r => r.userId === userId) || false;
  } catch (e) {
    return false;
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
    return { error: '서버 오류' };
  }
}

// ============================================
// 애니 검색 기능
// ============================================
let searchTimeout = null;

function initAnimeSearch() {
  const searchInput = document.getElementById('anime-search');
  const resultsContainer = document.getElementById('anime-search-results');
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
    clearTimeout(searchTimeout);
    
    if (query.length < 1) {
      resultsContainer.innerHTML = '';
      resultsContainer.style.display = 'none';
      return;
    }
    
    searchTimeout = setTimeout(() => {
      const filtered = allAnimes.filter(a => 
        a.title.toLowerCase().includes(query)
      ).slice(0, 10);
      
      if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div class="search-no-result">검색 결과가 없습니다</div>';
      } else {
        resultsContainer.innerHTML = filtered.map(anime => {
          const safeTitle = anime.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
          const safeCover = (anime.coverImage || '').replace(/'/g, "\\'");
          return `
            <div class="search-result-item" onclick="selectAnime(${anime.id}, '${safeTitle}', '${safeCover}')">
              <img src="${anime.coverImage || ''}" alt="" class="search-result-img">
              <span class="search-result-title">${anime.title}</span>
            </div>
          `;
        }).join('');
      }
      resultsContainer.style.display = 'block';
    }, 200);
  });
  
  // 외부 클릭시 결과 닫기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.form-group')) {
      resultsContainer.style.display = 'none';
    }
  });
}

async function selectAnime(id, title, coverImage) {
  const user = getUser();
  
  document.getElementById('selected-anime-id').value = id;
  document.getElementById('selected-anime-title').textContent = title;
  document.getElementById('selected-anime-img').src = coverImage || '';
  document.getElementById('selected-anime').style.display = 'flex';
  document.getElementById('anime-search').style.display = 'none';
  document.getElementById('anime-search-results').style.display = 'none';
  
  // 이미 리뷰 있는지 확인
  const warning = document.getElementById('anime-warning');
  if (user) {
    const hasReview = await checkUserReview(id, user.id);
    warning.style.display = hasReview ? 'block' : 'none';
  }
  
  isFormDirty = true;
}

function clearAnimeSelection() {
  document.getElementById('selected-anime-id').value = '';
  document.getElementById('selected-anime').style.display = 'none';
  document.getElementById('anime-search').style.display = 'block';
  document.getElementById('anime-search').value = '';
  document.getElementById('anime-warning').style.display = 'none';
}

// ============================================
// 폼 초기화
// ============================================
async function initForm() {
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    location.href = '/';
    return;
  }
  
  // 애니 목록 로드
  allAnimes = await fetchAllAnimes();
  
  // URL에서 animeId 파라미터 확인
  const params = new URLSearchParams(location.search);
  const presetAnimeId = params.get('animeId');
  
  if (presetAnimeId) {
    const anime = allAnimes.find(a => a.id === parseInt(presetAnimeId));
    if (anime) {
      selectAnime(anime.id, anime.title, anime.coverImage);
    }
  }
  
  // 검색 초기화
  initAnimeSearch();
  
  // 폼 변경 감지
  document.getElementById('review-form').addEventListener('input', () => {
    isFormDirty = true;
  });
}

// ============================================
// 폼 제출
// ============================================
async function handleSubmit(e) {
  e.preventDefault();
  
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  const animeId = document.getElementById('selected-anime-id').value;
  
  if (!animeId) {
    alert('애니를 선택해주세요.');
    return;
  }
  
  // 이미 리뷰 있는지 확인
  const hasReview = await checkUserReview(animeId, user.id);
  if (hasReview) {
    alert('이 애니에 이미 리뷰를 작성하셨습니다.');
    return;
  }
  
  const isAnonymous = document.getElementById('is-anonymous').checked;
  const tier = document.querySelector('input[name="tier"]:checked')?.value;
  
  if (!tier) {
    alert('티어를 선택해주세요.');
    return;
  }
  
  const data = {
    animeId: parseInt(animeId),
    tier: tier,
    rating: getTierDefaultRating(tier),
    oneLiner: document.getElementById('review-oneliner').value,
    content: document.getElementById('review-content').value,
    userId: user.id,
    isAnonymous: isAnonymous
  };
  
  const result = await submitReview(data);
  
  if (result.id) {
    isFormDirty = false;
    alert('리뷰가 등록되었습니다!');
    location.href = `/anime.html?id=${result.animeId}`;
  } else {
    alert(result.error || '등록 실패');
  }
}

// 티어별 기본 점수
function getTierDefaultRating(tier) {
  const ratings = {
    'SSS': 9.5,
    'SS': 9.0,
    'S': 8.5,
    'A': 8.0,
    'B': 7.0,
    'C': 6.0,
    'D': 5.0,
    'E': 4.0
  };
  return ratings[tier] || 7.0;
}

// ============================================
// 페이지 이탈 경고
// ============================================
window.addEventListener('beforeunload', (e) => {
  if (isFormDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ============================================
// 초기화
// ============================================
function init() {
  renderAuthHeader();
  initForm();
  
  document.getElementById('review-form').addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', init);