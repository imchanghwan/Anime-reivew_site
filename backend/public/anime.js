/**
 * AniLog - 애니 상세 페이지 (리뷰 + 댓글)
 */

const API = '/api';

// ============================================
// 유저 상태
// ============================================
function getUser() {
  const user = localStorage.getItem('anilog_user');
  return user ? JSON.parse(user) : null;
}

function clearUser() {
  localStorage.removeItem('anilog_user');
}

// URL에서 애니 id 추출
function getAnimeId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// ============================================
// API
// ============================================
async function fetchReviewDetail(animeId) {
  try {
    const res = await fetch(`${API}/anime/${animeId}/review`);
    return await res.json();
  } catch (e) {
    console.error('API 실패:', e);
    return null;
  }
}

async function fetchComments(reviewId, sort = 'recent', order = 'desc') {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}/comments?sort=${sort}&order=${order}`);
    return await res.json();
  } catch (e) {
    console.error('댓글 API 실패:', e);
    return [];
  }
}

async function submitComment(reviewId, data) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
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

async function voteComment(commentId, userId) {
  try {
    const res = await fetch(`${API}/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

async function getUserVote(reviewId, userId) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}/user-vote?userId=${userId}`);
    return await res.json();
  } catch (e) {
    return { vote: null };
  }
}

// ============================================
// Markdown -> HTML 변환
// ============================================
function markdownToHtml(md) {
  if (!md) return '';
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

// 날짜 포맷
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
// 상세 페이지 렌더링
// ============================================
let currentReviewId = null;
let currentSort = 'recent';
let currentOrder = 'desc';
let replyTarget = null;

async function renderDetail(data) {
  const container = document.getElementById('anime-detail');
  if (!container) return;
  
  if (!data) {
    container.innerHTML = '<p class="error-msg">애니를 찾을 수 없습니다.</p>';
    return;
  }
  
  document.title = `${data.title} - AniLog`;
  
  const review = data.review;
  
  if (!review) {
    container.innerHTML = `
      <div class="no-review-page">
        <h1>${data.title}</h1>
        <p>아직 작성된 글이 없습니다.</p>
        <a href="/" class="back-btn">← 메인으로</a>
      </div>
    `;
    return;
  }
  
  currentReviewId = review.id;
  const tierClass = `tier-${review.tier.toLowerCase()}`;
  const user = getUser();
  
  // 유저 투표 상태 확인
  let userVote = null;
  if (user) {
    const voteData = await getUserVote(review.id, user.id);
    userVote = voteData.vote;
  }
  
  const initial = review.author.charAt(0).toUpperCase();
  
  container.innerHTML = `
    <!-- 상단 애니 정보 -->
    <div class="review-hero">
      <div class="review-poster">
        <img src="${data.coverImage || ''}" alt="${data.title}">
      </div>
      <div class="review-hero-info">
        <div class="review-hero-header">
          <span class="tier ${tierClass}">${review.tier}</span>
          <h1 class="review-title">${data.title}</h1>
          <span class="review-rating-large">★ ${review.rating}</span>
        </div>
        <p class="review-oneliner-inline">"${review.oneLiner || ''}"</p>
      </div>
    </div>
    
    <!-- 작성자 정보 -->
    <div class="review-meta">
      <div class="review-author-info">
        <div class="user-avatar">
          ${review.profileImage ? `<img src="${review.profileImage}" alt="">` : initial}
        </div>
        <span class="review-author-name">${review.author}</span>
        <span class="review-divider">|</span>
        <span class="review-date">${formatDate(review.createdAt)}</span>
      </div>
      <div class="review-stats">
        <span class="stat-item">👁 ${review.viewCount || 0}</span>
        <span class="stat-item">👍 ${review.upCount || 0}</span>
        <span class="stat-item">💬 ${review.commentCount || 0}</span>
      </div>
    </div>
    
    <!-- 본문 -->
    <div class="review-content-box">
      ${markdownToHtml(review.content)}
    </div>
    
    <!-- 추천/비추천 버튼 -->
    <div class="vote-section">
      <button class="vote-btn up ${userVote === 'up' ? 'active' : ''}" onclick="handleVote('up')">
        👍 개추 <span id="up-count">${review.upCount || 0}</span>
      </button>
      <button class="vote-btn down ${userVote === 'down' ? 'active' : ''}" onclick="handleVote('down')">
        👎 비추 <span id="down-count">${review.downCount || 0}</span>
      </button>
    </div>
    
    <!-- 댓글 섹션 -->
    <div class="comments-section">
      <div class="comments-header">
        <h2>댓글</h2>
        <div class="sort-buttons">
          <button class="sort-btn ${currentSort === 'popular' ? 'active' : ''}" onclick="changeSort('popular')">
            인기순
          </button>
          <button class="sort-btn ${currentSort === 'recent' ? 'active' : ''}" onclick="changeSort('recent')">
            최신순 ${currentOrder === 'desc' ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      <!-- 댓글 작성 폼 -->
      <div class="comment-form-box" id="comment-form-box">
        ${user ? `
          <form id="comment-form" onsubmit="handleCommentSubmit(event)">
            <div class="comment-form-options">
              <label class="checkbox-label">
                <input type="checkbox" id="is-anonymous"> 익명
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="tier-request-check"> 티어 수정 요청
              </label>
              <select id="tier-request-select" disabled>
                <option value="">티어 선택</option>
                <option value="SSS">SSS</option>
                <option value="SS">SS</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
              </select>
            </div>
            <div class="comment-input-row">
              <textarea id="comment-content" placeholder="댓글을 입력하세요..." rows="3" required></textarea>
              <button type="submit" class="submit-btn">등록</button>
            </div>
          </form>
        ` : `
          <p class="login-prompt">댓글을 작성하려면 <a href="/" class="link">로그인</a>이 필요합니다.</p>
        `}
      </div>
      
      <!-- 댓글 목록 -->
      <div class="comments-list" id="comments-list">
        <!-- JS로 렌더링 -->
      </div>
    </div>
    
    <a href="/" class="back-btn">← 메인으로</a>
  `;
  
  // 티어 수정 요청 체크박스 이벤트
  const tierCheck = document.getElementById('tier-request-check');
  const tierSelect = document.getElementById('tier-request-select');
  if (tierCheck && tierSelect) {
    tierCheck.addEventListener('change', () => {
      tierSelect.disabled = !tierCheck.checked;
    });
  }
  
  // 댓글 로드
  loadComments();
}

// ============================================
// 댓글 렌더링
// ============================================
async function loadComments() {
  if (!currentReviewId) return;
  
  const comments = await fetchComments(currentReviewId, currentSort, currentOrder);
  renderComments(comments);
}

function renderComments(comments) {
  const container = document.getElementById('comments-list');
  if (!container) return;
  
  if (comments.length === 0) {
    container.innerHTML = '<p class="no-comments">아직 댓글이 없습니다.</p>';
    return;
  }
  
  // 부모 댓글과 자식 댓글 분리
  const parentComments = comments.filter(c => !c.parentId);
  const childComments = comments.filter(c => c.parentId);
  
  // 부모별로 자식 그룹화
  const childMap = {};
  childComments.forEach(c => {
    if (!childMap[c.parentId]) childMap[c.parentId] = [];
    childMap[c.parentId].push(c);
  });
  
  const user = getUser();
  
  container.innerHTML = parentComments.map(comment => {
    const children = childMap[comment.id] || [];
    const initial = comment.author.charAt(0).toUpperCase();
    const hasReplies = children.length > 0;
    
    return `
      <div class="comment-item" data-comment-id="${comment.id}">
        <div class="comment-main">
          <div class="comment-header">
            <div class="comment-author-info">
              <div class="user-avatar small">
                ${comment.profileImage ? `<img src="${comment.profileImage}" alt="">` : initial}
              </div>
              <span class="comment-author">${comment.author}</span>
              <span class="comment-date">${formatDate(comment.createdAt)}</span>
            </div>
            ${comment.tierRequest ? `<span class="tier-request-badge">티어 수정 요청: ${comment.tierRequest}</span>` : ''}
          </div>
          <p class="comment-text">${comment.content}</p>
          <div class="comment-actions">
            ${user ? `<button class="reply-btn" onclick="setReplyTarget(${comment.id}, '${comment.author}')">답글</button>` : ''}
            <button class="vote-small-btn" onclick="handleCommentVote(${comment.id})">
              👍 ${comment.voteCount || 0}
            </button>
          </div>
        </div>
        
        ${hasReplies ? `
          <button class="toggle-replies-btn" onclick="toggleReplies(${comment.id})">
            <span class="toggle-text">답글 ${children.length}개 펼치기</span>
          </button>
          <div class="comment-replies" id="replies-${comment.id}" style="display: none;">
            ${children.map(child => {
              const childInitial = child.author.charAt(0).toUpperCase();
              return `
                <div class="comment-reply">
                  <div class="comment-header">
                    <div class="comment-author-info">
                      <div class="user-avatar small">
                        ${child.profileImage ? `<img src="${child.profileImage}" alt="">` : childInitial}
                      </div>
                      <span class="comment-author">${child.author}</span>
                      <span class="comment-date">${formatDate(child.createdAt)}</span>
                    </div>
                  </div>
                  <p class="comment-text">${child.content}</p>
                  <div class="comment-actions">
                    ${user ? `<button class="reply-btn" onclick="setReplyTarget(${comment.id}, '${child.author}')">답글</button>` : ''}
                    <button class="vote-small-btn" onclick="handleCommentVote(${child.id})">
                      👍 ${child.voteCount || 0}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// 답글 펼치기/접기
function toggleReplies(commentId) {
  const repliesDiv = document.getElementById(`replies-${commentId}`);
  const btn = document.querySelector(`.comment-item[data-comment-id="${commentId}"] .toggle-replies-btn`);
  const textSpan = btn.querySelector('.toggle-text');
  
  if (repliesDiv.style.display === 'none') {
    repliesDiv.style.display = 'block';
    const count = repliesDiv.querySelectorAll('.comment-reply').length;
    textSpan.textContent = `답글 ${count}개 접기`;
  } else {
    repliesDiv.style.display = 'none';
    const count = repliesDiv.querySelectorAll('.comment-reply').length;
    textSpan.textContent = `답글 ${count}개 펼치기`;
  }
}

// ============================================
// 이벤트 핸들러
// ============================================
async function handleVote(type) {
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  const result = await voteReview(currentReviewId, user.id, type);
  
  if (result.error) {
    alert(result.error);
    return;
  }
  
  // 투표 카운트 다시 가져오기
  const animeId = getAnimeId();
  const data = await fetchReviewDetail(animeId);
  if (data && data.review) {
    document.getElementById('up-count').textContent = data.review.upCount || 0;
    document.getElementById('down-count').textContent = data.review.downCount || 0;
    
    // 버튼 상태 업데이트
    const voteData = await getUserVote(currentReviewId, user.id);
    const upBtn = document.querySelector('.vote-btn.up');
    const downBtn = document.querySelector('.vote-btn.down');
    
    upBtn.classList.toggle('active', voteData.vote === 'up');
    downBtn.classList.toggle('active', voteData.vote === 'down');
  }
}

async function handleCommentVote(commentId) {
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  const result = await voteComment(commentId, user.id);
  if (result.error) {
    alert(result.error);
    return;
  }
  
  // 댓글 목록 새로고침
  loadComments();
}

function changeSort(sort) {
  if (sort === 'recent' && currentSort === 'recent') {
    // 토글
    currentOrder = currentOrder === 'desc' ? 'asc' : 'desc';
  } else {
    currentSort = sort;
    currentOrder = 'desc';
  }
  
  // 버튼 업데이트
  document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.sort-btn:nth-child(${sort === 'popular' ? 1 : 2})`).classList.add('active');
  
  if (sort === 'recent') {
    document.querySelector('.sort-btn:nth-child(2)').textContent = `최신순 ${currentOrder === 'desc' ? '▼' : '▲'}`;
  }
  
  loadComments();
}

function setReplyTarget(parentId, authorName) {
  replyTarget = { parentId, authorName };
  const textarea = document.getElementById('comment-content');
  if (textarea) {
    textarea.value = `@${authorName} `;
    textarea.focus();
  }
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  
  const user = getUser();
  if (!user) return;
  
  const content = document.getElementById('comment-content').value;
  const isAnonymous = document.getElementById('is-anonymous').checked;
  const tierRequestCheck = document.getElementById('tier-request-check');
  const tierRequestSelect = document.getElementById('tier-request-select');
  const tierRequest = tierRequestCheck?.checked ? tierRequestSelect?.value : null;
  
  const data = {
    userId: user.id,
    parentId: replyTarget?.parentId || null,
    isAnonymous,
    content,
    tierRequest
  };
  
  const result = await submitComment(currentReviewId, data);
  
  if (result.id) {
    document.getElementById('comment-content').value = '';
    document.getElementById('is-anonymous').checked = false;
    if (tierRequestCheck) tierRequestCheck.checked = false;
    if (tierRequestSelect) tierRequestSelect.disabled = true;
    replyTarget = null;
    loadComments();
  } else {
    alert(result.error || '댓글 등록 실패');
  }
}

// ============================================
// 초기화
// ============================================
async function init() {
  renderAuthHeader();
  
  const animeId = getAnimeId();
  if (!animeId) {
    location.href = '/';
    return;
  }
  
  const data = await fetchReviewDetail(animeId);
  await renderDetail(data);
}

document.addEventListener('DOMContentLoaded', init);