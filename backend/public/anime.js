/**
 * 오덕후 - 애니 상세 페이지 (리뷰 리스트)
 */

const API = '/api';

// 상태
let currentAnimeId = null;
let currentSort = 'votes'; // votes: 추천순, views: 조회순
let userVotes = {}; // 유저의 투표 상태 저장

// ============================================
// 유틸리티
// ============================================
function getAnimeId() {
  const params = new URLSearchParams(location.search);
  return params.get('id');
}

function getUser() {
  const user = localStorage.getItem('anilog_user');
  return user ? JSON.parse(user) : null;
}

function clearUser() {
  localStorage.removeItem('anilog_user');
}

// 날짜 포맷 (시:분 포함)
function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  const datepart = date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timepart = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datepart} ${timepart}`;
}

// ============================================
// API
// ============================================
async function fetchAnimeReviews(animeId, sort = 'votes') {
  try {
    const res = await fetch(`${API}/anime/${animeId}/reviews?sort=${sort}`);
    return await res.json();
  } catch (e) {
    console.error('API 실패:', e);
    return null;
  }
}

async function fetchUserVotes(userId, reviewIds) {
  if (!userId || reviewIds.length === 0) return {};
  try {
    const res = await fetch(`${API}/user-votes?userId=${userId}&reviewIds=${reviewIds.join(',')}`);
    return await res.json();
  } catch (e) {
    return {};
  }
}

async function voteReview(reviewId, userId, voteType) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, voteType })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
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
    container.innerHTML = `
      <button class="auth-btn" onclick="location.href='/'">로그인</button>
    `;
  }
}

function handleLogout() {
  clearUser();
  location.reload();
}

// ============================================
// 메인 렌더링
// ============================================
async function renderAnimePage(data) {
  const container = document.getElementById('anime-detail');
  if (!container) return;
  
  if (!data) {
    container.innerHTML = '<div class="error-msg">애니를 찾을 수 없습니다.</div>';
    return;
  }
  
  const user = getUser();
  
  // 유저 투표 상태 가져오기
  if (user && data.reviews && data.reviews.length > 0) {
    const reviewIds = data.reviews.map(r => r.id);
    userVotes = await fetchUserVotes(user.id, reviewIds);
  } else {
    userVotes = {};
  }
  
  // 유저가 이미 리뷰를 작성했는지 확인
  const userReview = user && data.reviews ? data.reviews.find(r => r.userId === user.id) : null;
  const userHasReview = !!userReview;
  
  // 관련 애니 HTML
  const relatedAnimeHtml = data.relatedAnime && data.relatedAnime.length > 0 ? `
    <div class="related-anime-section">
      <h3 class="related-anime-title">📺 ${data.parentTitle || '관련'} 시리즈</h3>
      <div class="related-anime-list">
        ${data.relatedAnime.map(anime => `
          <a href="/anime.html?id=${anime.id}" class="related-anime-card">
            <div class="related-anime-poster">
              <img src="${anime.coverImage || ''}" alt="${anime.title}">
            </div>
            <p class="related-anime-name">${anime.title}</p>
          </a>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  // 리뷰 작성 버튼 영역
  const reviewButtonsHtml = userHasReview ? `
    <div class="review-action-bar">
      <span class="already-reviewed-text">이미 리뷰를 작성하셨습니다.</span>
      <div class="my-review-actions">
        <a href="/review.html?id=${userReview.id}" class="view-my-review-btn">👁 보기</a>
        <button class="edit-my-review-btn" onclick="openEditMyReviewModal(${userReview.id})">✏️ 수정</button>
        <button class="delete-my-review-btn" onclick="handleDeleteMyReview(${userReview.id})">🗑️ 삭제</button>
      </div>
    </div>
  ` : `
    <div class="review-action-bar">
      <button class="quick-review-btn" onclick="openQuickReviewModal()">⚡ 간단 리뷰</button>
      <a href="/write.html?animeId=${data.id}" class="detail-review-btn">✏️ 상세 리뷰 작성</a>
    </div>
  `;
  
  // 리뷰가 없는 경우
  if (!data.reviews || data.reviews.length === 0) {
    container.innerHTML = `
      <div class="anime-hero-simple">
        <div class="anime-poster-large">
          <img src="${data.coverImage || ''}" alt="${data.title}">
        </div>
        <div class="anime-hero-info">
          <h1 class="anime-title-large">${data.title}</h1>
          <p class="no-reviews-msg">아직 리뷰가 없습니다. 첫 번째 리뷰를 작성해보세요!</p>
        </div>
      </div>
      ${relatedAnimeHtml}
      ${user ? reviewButtonsHtml : '<div class="review-action-bar"><p class="login-prompt-simple">리뷰를 작성하려면 <a href="/">로그인</a>하세요.</p></div>'}
      <a href="/" class="back-btn">← 메인으로</a>
    `;
    return;
  }
  
  // 상위 3개와 나머지 분리
  const topReviews = data.reviews.slice(0, 3);
  const restReviews = data.reviews.slice(3);
  
  container.innerHTML = `
    <!-- 애니 정보 히어로 -->
    <div class="anime-hero">
      <div class="anime-poster-hero">
        <img src="${data.coverImage || ''}" alt="${data.title}">
      </div>
      <div class="anime-hero-content">
        <h1 class="anime-title-hero">${data.title}</h1>
        <div class="anime-stats">
          <span class="stat-item">★ ${data.avgRating || 0}</span>
          <span class="stat-item">리뷰 ${data.reviewCount || 0}개</span>
        </div>
      </div>
    </div>
    
    ${relatedAnimeHtml}
    
    <!-- 리뷰 작성 버튼 -->
    ${user ? reviewButtonsHtml : '<div class="review-action-bar"><p class="login-prompt-simple">리뷰를 작성하려면 <a href="/">로그인</a>하세요.</p></div>'}
    
    <!-- 리뷰 섹션 -->
    <div class="reviews-section">
      <div class="reviews-header">
        <h2>리뷰</h2>
        <div class="sort-buttons">
          <button class="sort-btn ${currentSort === 'votes' ? 'active' : ''}" onclick="changeSort('votes')">
            추천순
          </button>
          <button class="sort-btn ${currentSort === 'views' ? 'active' : ''}" onclick="changeSort('views')">
            조회순
          </button>
        </div>
      </div>
      
      <!-- 상위 1, 2, 3위 리뷰 -->
      <div class="top-reviews">
        ${topReviews.map((review, idx) => renderTopReviewCard(review, idx + 1)).join('')}
      </div>
      
      <!-- 4위 이후 리뷰 -->
      ${restReviews.length > 0 ? `
        <div class="rest-reviews">
          ${restReviews.map(review => renderReviewCard(review)).join('')}
        </div>
      ` : ''}
    </div>
    
    <a href="/" class="back-btn">← 메인으로</a>
  `;
}

// 상위 1, 2, 3위 리뷰 카드 (크기 다름)
function renderTopReviewCard(review, rank) {
  const initial = review.author.charAt(0).toUpperCase();
  const rankClass = `rank-${rank}`;
  const isVoted = userVotes[review.id] === 'up';
  
  return `
    <div class="top-review-card ${rankClass}" onclick="goToReview(${review.id})">
      <div class="rank-badge">${rank}</div>
      <div class="review-card-header">
        <div class="review-author-row">
          <div class="user-avatar ${rank === 1 ? '' : 'small'}">
            ${review.profileImage ? `<img src="${review.profileImage}" alt="">` : initial}
          </div>
          <span class="review-author">${review.author}</span>
          <span class="review-date">${formatDateTime(review.createdAt)}</span>
        </div>
        <div class="review-stats-row">
          <span class="stat-item">👁 ${review.viewCount || 0}</span>
          <span class="stat-item">💬 ${review.commentCount || 0}</span>
          <button class="vote-inline-btn ${isVoted ? 'active' : ''}" onclick="event.stopPropagation(); handleVote(${review.id}, 'up')">
            👍 ${review.upCount || 0}
          </button>
        </div>
      </div>
      <div class="review-oneliner-row">
        <span class="tier tier-${review.tier.toLowerCase()} tier-card">${review.tier}</span>
        ${review.content ? '<span class="content-badge">[본문]</span>' : ''}
        <p class="review-oneliner-card">"${review.oneLiner || ''}"</p>
      </div>
    </div>
  `;
}

// 4위 이후 리뷰 카드 (동일 크기)
function renderReviewCard(review) {
  const initial = review.author.charAt(0).toUpperCase();
  const isVoted = userVotes[review.id] === 'up';
  
  return `
    <div class="review-card" onclick="goToReview(${review.id})">
      <div class="review-card-header">
        <div class="review-author-row">
          <div class="user-avatar small">
            ${review.profileImage ? `<img src="${review.profileImage}" alt="">` : initial}
          </div>
          <span class="review-author">${review.author}</span>
          <span class="review-date">${formatDateTime(review.createdAt)}</span>
        </div>
        <div class="review-stats-row">
          <span class="stat-item">👁 ${review.viewCount || 0}</span>
          <span class="stat-item">💬 ${review.commentCount || 0}</span>
          <button class="vote-inline-btn ${isVoted ? 'active' : ''}" onclick="event.stopPropagation(); handleVote(${review.id}, 'up')">
            👍 ${review.upCount || 0}
          </button>
        </div>
      </div>
      <div class="review-oneliner-row">
        <span class="tier tier-${review.tier.toLowerCase()} tier-card-small">${review.tier}</span>
        ${review.content ? '<span class="content-badge">[본문]</span>' : ''}
        <p class="review-oneliner-card">"${review.oneLiner || ''}"</p>
      </div>
    </div>
  `;
}

// ============================================
// 이벤트 핸들러
// ============================================
function goToReview(reviewId) {
  location.href = `/review.html?id=${reviewId}`;
}

async function handleVote(reviewId, voteType) {
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  await voteReview(reviewId, user.id, voteType);
  
  // 리뷰 목록 새로고침
  const data = await fetchAnimeReviews(currentAnimeId, currentSort);
  renderAnimePage(data);
}

async function changeSort(sort) {
  currentSort = sort;
  const data = await fetchAnimeReviews(currentAnimeId, sort);
  renderAnimePage(data);
}

// ============================================
// 간단 리뷰 모달
// ============================================
function openQuickReviewModal() {
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  closeModal();
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'quick-review-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">⚡ 간단 리뷰</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form class="modal-form" onsubmit="handleQuickReviewSubmit(event)">
        <div class="form-group">
          <label>티어 선택</label>
          <div class="tier-select-grid tier-select-wide">
            <label class="tier-radio"><input type="radio" name="tier" value="SSS" required><span class="tier tier-sss">SSS</span></label>
            <label class="tier-radio"><input type="radio" name="tier" value="SS"><span class="tier tier-ss">SS</span></label>
            <label class="tier-radio"><input type="radio" name="tier" value="S"><span class="tier tier-s">S</span></label>
            <label class="tier-radio"><input type="radio" name="tier" value="A"><span class="tier tier-a">A</span></label>
            <label class="tier-radio"><input type="radio" name="tier" value="B"><span class="tier tier-b">B</span></label>
            <label class="tier-radio"><input type="radio" name="tier" value="C"><span class="tier tier-c">C</span></label>
            <label class="tier-radio"><input type="radio" name="tier" value="D"><span class="tier tier-d">D</span></label>
            <label class="tier-radio"><input type="radio" name="tier" value="E"><span class="tier tier-e">E</span></label>
          </div>
        </div>
        <div class="form-group">
          <label>한줄평</label>
          <input type="text" id="quick-oneliner" placeholder="이 애니를 한 줄로 표현하면?" maxlength="100" required>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="quick-anonymous"> 익명으로 작성
          </label>
        </div>
        <div class="modal-actions">
          <button type="submit" class="auth-btn primary" style="width:100%">등록</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function closeModal() {
  const modal = document.getElementById('quick-review-modal');
  if (modal) modal.remove();
}

async function handleQuickReviewSubmit(e) {
  e.preventDefault();
  
  const user = getUser();
  if (!user) return;
  
  const tier = document.querySelector('input[name="tier"]:checked')?.value;
  const oneLiner = document.getElementById('quick-oneliner').value;
  const isAnonymous = document.getElementById('quick-anonymous').checked;
  
  if (!tier) {
    alert('티어를 선택해주세요.');
    return;
  }
  
  const data = {
    animeId: currentAnimeId,
    tier,
    rating: getTierDefaultRating(tier), // 티어 기반 기본 점수
    oneLiner,
    content: '', // 간단 리뷰는 본문 없음
    userId: user.id,
    isAnonymous
  };
  
  try {
    const res = await fetch(`${API}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    
    if (result.id) {
      closeModal();
      alert('리뷰가 등록되었습니다!');
      // 페이지 새로고침
      const newData = await fetchAnimeReviews(currentAnimeId, currentSort);
      renderAnimePage(newData);
    } else {
      alert(result.error || '등록 실패');
    }
  } catch (e) {
    alert('서버 오류');
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
// 내 리뷰 수정/삭제
// ============================================
let myReviewData = null;

async function openEditMyReviewModal(reviewId) {
  const user = getUser();
  if (!user) return;
  
  // 리뷰 데이터 가져오기
  try {
    const res = await fetch(`${API}/reviews/${reviewId}`);
    myReviewData = await res.json();
  } catch (e) {
    alert('리뷰 정보를 불러올 수 없습니다.');
    return;
  }
  
  closeModal();
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'quick-review-modal';
  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-header">
        <h3 class="modal-title">✏️ 리뷰 수정</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form class="modal-form" onsubmit="handleEditMyReviewSubmit(event, ${reviewId})">
        <div class="form-group">
          <label>한줄평</label>
          <input type="text" id="edit-oneliner" value="${myReviewData.oneLiner || ''}" maxlength="100">
        </div>
        <div class="form-group">
          <label>본문</label>
          <textarea id="edit-content" rows="8">${myReviewData.content || ''}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="cancel-btn" onclick="closeModal()">취소</button>
          <button type="submit" class="auth-btn primary">수정</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

async function handleEditMyReviewSubmit(e, reviewId) {
  e.preventDefault();
  
  const user = getUser();
  if (!user) return;
  
  const oneLiner = document.getElementById('edit-oneliner').value;
  const content = document.getElementById('edit-content').value;
  
  try {
    const res = await fetch(`${API}/reviews/${reviewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, oneLiner, content })
    });
    const result = await res.json();
    
    if (result.message) {
      closeModal();
      alert('수정되었습니다.');
      const newData = await fetchAnimeReviews(currentAnimeId, currentSort);
      renderAnimePage(newData);
    } else {
      alert(result.error || '수정 실패');
    }
  } catch (e) {
    alert('서버 오류');
  }
}

async function handleDeleteMyReview(reviewId) {
  const user = getUser();
  if (!user) return;
  
  if (!confirm('정말 이 리뷰를 삭제하시겠습니까?\n댓글도 모두 삭제됩니다.')) return;
  
  try {
    const res = await fetch(`${API}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    const result = await res.json();
    
    if (result.message) {
      alert('삭제되었습니다.');
      const newData = await fetchAnimeReviews(currentAnimeId, currentSort);
      renderAnimePage(newData);
    } else {
      alert(result.error || '삭제 실패');
    }
  } catch (e) {
    alert('서버 오류');
  }
}

// ============================================
// 초기화
// ============================================
async function init() {
  renderAuthHeader();
  
  currentAnimeId = getAnimeId();
  if (!currentAnimeId) {
    location.href = '/';
    return;
  }
  
  // 검색용 애니 목록 로드
  loadAnimeListForSearch();
  
  const data = await fetchAnimeReviews(currentAnimeId, currentSort);
  renderAnimePage(data);
}

// ============================================
// 헤더 검색 기능
// ============================================
let searchTimeout = null;

async function loadAnimeListForSearch() {
  try {
    const res = await fetch(`${API}/all-anime`);
    window.allAnimeList = await res.json();
  } catch (e) {
    window.allAnimeList = [];
  }
}

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