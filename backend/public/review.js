/**
 * AniLog - 리뷰 상세 페이지
 */

const API = '/api';

let currentReviewId = null;
let currentSort = 'recent';
let currentOrder = 'desc';
let replyTarget = null;

// ============================================
// 유틸리티
// ============================================
function getReviewId() {
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

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  const datepart = date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timepart = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datepart} ${timepart}`;
}

function renderTierBadge(tier) {
  const tierClass = `tier-${tier.toLowerCase()}`;
  return `<span class="tier ${tierClass}">${tier}</span>`;
}

// 간단한 마크다운 파서
function parseMarkdown(text) {
  if (!text) return '';
  
  let html = text
    // & 이스케이프
    .replace(/&/g, '&amp;')
    // 헤더 (### > ## > #)
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // 굵게 & 기울임
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // 취소선
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // 인라인 코드
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 코드 블록
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // 인용
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // 순서 없는 리스트
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // 순서 있는 리스트
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 가로선
    .replace(/^---$/gm, '<hr>')
    // 이미지 (링크보다 먼저 처리)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // 링크
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // 줄바꿈
    .replace(/\n/g, '<br>');
  
  // 연속된 <li>를 <ul>로 감싸기
  html = html.replace(/(<li>.*?<\/li>)(<br>)?(<li>)/g, '$1$3');
  html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
  
  // 연속된 blockquote 병합
  html = html.replace(/<\/blockquote><br><blockquote>/g, '<br>');
  
  return html;
}

// ============================================
// API
// ============================================
async function fetchReview(reviewId) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function fetchComments(reviewId, sort, order) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}/comments?sort=${sort}&order=${order}`);
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function fetchUserAnonStatus(reviewId, userId) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}/user-anon-status?userId=${userId}`);
    return await res.json();
  } catch (e) {
    return { forced: false, isAnonymous: false };
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

async function updateReview(reviewId, data) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

async function deleteReview(reviewId, userId) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

async function deleteComment(commentId, userId) {
  try {
    const res = await fetch(`${API}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
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

async function getUserVote(reviewId, userId) {
  try {
    const res = await fetch(`${API}/reviews/${reviewId}/user-vote?userId=${userId}`);
    return await res.json();
  } catch (e) {
    return { vote: null };
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
  location.reload();
}

function goToWrite(e) {
  e.preventDefault();
  const user = getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  location.href = '/write.html';
}

// ============================================
// 리뷰 상세 렌더링
// ============================================
let currentReview = null;

async function renderReviewDetail(review) {
  const container = document.getElementById('review-detail');
  if (!container || !review) {
    if (container) container.innerHTML = '<div class="error-msg">리뷰를 찾을 수 없습니다.</div>';
    return;
  }
  
  currentReview = review;
  const user = getUser();
  const userVoteData = user ? await getUserVote(review.id, user.id) : { vote: null };
  const userVote = userVoteData.vote;
  const isOwner = user && user.id === review.userId;
  
  const tierClass = `tier-${review.tier.toLowerCase()}`;
  const initial = review.author.charAt(0).toUpperCase();
  
  // 수정/삭제 버튼 (본인만)
  const ownerActionsHtml = isOwner ? `
    <div class="review-owner-actions">
      <button class="edit-btn" onclick="openEditReviewModal()">✏️ 수정</button>
      <button class="delete-btn" onclick="handleDeleteReview()">🗑️ 삭제</button>
    </div>
  ` : '';
  
  container.innerHTML = `
    <div class="review-hero">
      <div class="review-poster">
        <a href="/anime.html?id=${review.animeId}">
          <img src="${review.animeCoverImage || ''}" alt="${review.animeTitle}">
        </a>
      </div>
      <div class="review-hero-info">
        <div class="review-hero-header">
          <span class="tier ${tierClass}">${review.tier}</span>
          <h1 class="review-title"><a href="/anime.html?id=${review.animeId}">${review.animeTitle}</a></h1>
          <span class="review-rating-large">★ ${review.rating}</span>
        </div>
        <div class="review-oneliner-box">
          <p class="review-oneliner-text">"${review.oneLiner || ''}"</p>
          <span class="review-oneliner-author">- ${review.author}</span>
        </div>
      </div>
    </div>
    
    <div class="review-meta">
      <div class="review-author-info">
        <div class="user-avatar">
          ${review.profileImage ? `<img src="${review.profileImage}" alt="">` : initial}
        </div>
        <span class="review-author-name">${review.author}</span>
        <span class="review-divider">|</span>
        <span class="review-date">${formatDateTime(review.createdAt)}</span>
      </div>
      <div class="review-stats">
        <span class="stat-item">👁 조회 ${review.viewCount || 0}</span>
        <span class="stat-item">💬 댓글 ${review.commentCount || 0}</span>
        ${ownerActionsHtml}
      </div>
    </div>
    
    <article class="review-content markdown-body">
      ${review.content ? parseMarkdown(review.content) : '<span class="no-content">본문이 없습니다.</span>'}
    </article>
    
    <div class="vote-section">
      <button class="vote-btn up ${userVote === 'up' ? 'active' : ''}" onclick="handleVote('up')">
        👍 개추 <span id="up-count">${review.upCount || 0}</span>
      </button>
      <button class="vote-btn down ${userVote === 'down' ? 'active' : ''}" onclick="handleVote('down')">
        👎 비추 <span id="down-count">${review.downCount || 0}</span>
      </button>
    </div>
    
    <div class="comments-section">
      <div class="comments-header">
        <h2>댓글</h2>
        <div class="sort-buttons">
          <button class="sort-btn ${currentSort === 'popular' ? 'active' : ''}" onclick="changeSortComment('popular')">인기순</button>
          <button class="sort-btn ${currentSort === 'recent' ? 'active' : ''}" onclick="changeSortComment('recent')">최신순 ${currentOrder === 'desc' ? '▼' : '▲'}</button>
        </div>
      </div>
      
      <div class="comment-form-box" id="comment-form-box">
        ${user ? `
          <form id="comment-form" onsubmit="handleCommentSubmit(event)">
            <div class="comment-form-options">
              <label class="checkbox-label" id="anon-checkbox-label">
                <input type="checkbox" id="is-anonymous"> 익명
              </label>
              <span class="anon-status-msg" id="anon-status-msg"></span>
              <label class="checkbox-label">
                <input type="checkbox" id="tier-request-check"> 티어 수정 요청
              </label>
              <select id="tier-request-select" disabled>
                <option value="">티어 선택</option>
                <option value="SSS">SSS</option>
                <option value="SS">SS</option>
                <option value="S">S</option>
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
        ` : `<p class="login-prompt">댓글을 작성하려면 <a href="/" class="link">로그인</a>이 필요합니다.</p>`}
      </div>
      
      <div class="comments-list" id="comments-list"></div>
    </div>
    
    <a href="/anime.html?id=${review.animeId}" class="back-btn">← 리뷰 목록으로</a>
  `;
  
  const tierCheck = document.getElementById('tier-request-check');
  const tierSelect = document.getElementById('tier-request-select');
  if (tierCheck && tierSelect) {
    tierCheck.addEventListener('change', () => {
      tierSelect.disabled = !tierCheck.checked;
    });
  }
  
  if (user) updateAnonStatus();
  loadComments();
}

async function updateAnonStatus() {
  const user = getUser();
  if (!user || !currentReviewId) return;
  
  const status = await fetchUserAnonStatus(currentReviewId, user.id);
  const anonCheckbox = document.getElementById('is-anonymous');
  const anonLabel = document.getElementById('anon-checkbox-label');
  const anonMsg = document.getElementById('anon-status-msg');
  
  if (!anonCheckbox || !anonMsg) return;
  
  if (status.forced) {
    anonCheckbox.checked = status.isAnonymous;
    anonCheckbox.disabled = true;
    anonLabel.style.opacity = '0.6';
    anonLabel.style.cursor = 'not-allowed';
    anonMsg.textContent = status.isReviewAuthor 
      ? (status.isAnonymous ? '(리뷰가 익명이므로 익명 고정)' : '(리뷰가 공개이므로 공개 고정)')
      : (status.isAnonymous ? '(이전 댓글이 익명이므로 익명 고정)' : '(이전 댓글이 공개이므로 공개 고정)');
  } else {
    anonCheckbox.disabled = false;
    anonLabel.style.opacity = '1';
    anonLabel.style.cursor = 'pointer';
    anonMsg.textContent = '';
  }
}

async function loadComments() {
  const comments = await fetchComments(currentReviewId, currentSort, currentOrder);
  renderComments(comments);
}

function renderComments(comments) {
  const container = document.getElementById('comments-list');
  if (!container) return;
  
  if (!comments || comments.length === 0) {
    container.innerHTML = '<p class="no-comments">아직 댓글이 없습니다.</p>';
    return;
  }
  
  const parentComments = comments.filter(c => !c.parentId);
  const childComments = comments.filter(c => c.parentId);
  const childMap = {};
  childComments.forEach(c => {
    if (!childMap[c.parentId]) childMap[c.parentId] = [];
    childMap[c.parentId].push(c);
  });
  
  const user = getUser();
  
  container.innerHTML = parentComments.map(comment => {
    const children = childMap[comment.id] || [];
    const initial = comment.author.charAt(0).toUpperCase();
    const isCommentOwner = user && user.id === comment.userId;
    
    return `
      <div class="comment-item" data-comment-id="${comment.id}">
        <div class="comment-main">
          <div class="comment-header">
            <div class="comment-author-info">
              <div class="user-avatar small">${comment.profileImage ? `<img src="${comment.profileImage}" alt="">` : initial}</div>
              <span class="comment-author">${comment.author}</span>
              <span class="comment-date">${formatDateTime(comment.createdAt)}</span>
            </div>
            ${comment.tierRequest ? `<span class="tier-request-badge">티어 수정 요청 → ${renderTierBadge(comment.tierRequest)}</span>` : ''}
          </div>
          <p class="comment-text">${comment.content}</p>
          <div class="comment-actions">
            ${user ? `<button class="reply-btn" onclick="setReplyTarget(${comment.id}, '${comment.author}')">답글</button>` : ''}
            <button class="vote-small-btn" onclick="handleCommentVote(${comment.id})">👍 ${comment.voteCount || 0}</button>
            ${isCommentOwner ? `<button class="delete-comment-btn" onclick="handleDeleteComment(${comment.id})">삭제</button>` : ''}
          </div>
        </div>
        ${children.length > 0 ? `
          <button class="toggle-replies-btn" onclick="toggleReplies(${comment.id})">
            <span class="toggle-text">답글 ${children.length}개 펼치기</span>
          </button>
          <div class="comment-replies" id="replies-${comment.id}" style="display: none;">
            ${children.map(child => {
              const isChildOwner = user && user.id === child.userId;
              return `
              <div class="comment-reply">
                <div class="comment-header">
                  <div class="comment-author-info">
                    <div class="user-avatar small">${child.profileImage ? `<img src="${child.profileImage}" alt="">` : child.author.charAt(0).toUpperCase()}</div>
                    <span class="comment-author">${child.author}</span>
                    <span class="comment-date">${formatDateTime(child.createdAt)}</span>
                  </div>
                  ${child.tierRequest ? `<span class="tier-request-badge">티어 수정 요청 → ${renderTierBadge(child.tierRequest)}</span>` : ''}
                </div>
                <p class="comment-text">${child.content}</p>
                <div class="comment-actions">
                  ${user ? `<button class="reply-btn" onclick="setReplyTarget(${comment.id}, '${child.author}')">답글</button>` : ''}
                  <button class="vote-small-btn" onclick="handleCommentVote(${child.id})">👍 ${child.voteCount || 0}</button>
                  ${isChildOwner ? `<button class="delete-comment-btn" onclick="handleDeleteComment(${child.id})">삭제</button>` : ''}
                </div>
              </div>
            `;}).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function toggleReplies(commentId) {
  const repliesDiv = document.getElementById(`replies-${commentId}`);
  const btn = document.querySelector(`.comment-item[data-comment-id="${commentId}"] .toggle-replies-btn`);
  const textSpan = btn.querySelector('.toggle-text');
  
  if (repliesDiv.style.display === 'none') {
    repliesDiv.style.display = 'block';
    textSpan.textContent = `답글 ${repliesDiv.querySelectorAll('.comment-reply').length}개 접기`;
    btn.classList.add('expanded');
  } else {
    repliesDiv.style.display = 'none';
    textSpan.textContent = `답글 ${repliesDiv.querySelectorAll('.comment-reply').length}개 펼치기`;
    btn.classList.remove('expanded');
  }
}

// ============================================
// 이벤트 핸들러
// ============================================
async function handleVote(type) {
  const user = getUser();
  if (!user) { alert('로그인이 필요합니다.'); return; }
  
  await voteReview(currentReviewId, user.id, type);
  const review = await fetchReview(currentReviewId);
  if (review) {
    document.getElementById('up-count').textContent = review.upCount || 0;
    document.getElementById('down-count').textContent = review.downCount || 0;
    const voteData = await getUserVote(currentReviewId, user.id);
    document.querySelector('.vote-btn.up').classList.toggle('active', voteData.vote === 'up');
    document.querySelector('.vote-btn.down').classList.toggle('active', voteData.vote === 'down');
  }
}

async function handleCommentVote(commentId) {
  const user = getUser();
  if (!user) { alert('로그인이 필요합니다.'); return; }
  await voteComment(commentId, user.id);
  loadComments();
}

function changeSortComment(sort) {
  if (sort === 'recent' && currentSort === 'recent') {
    currentOrder = currentOrder === 'desc' ? 'asc' : 'desc';
  } else {
    currentSort = sort;
    currentOrder = 'desc';
  }
  document.querySelectorAll('.comments-header .sort-btn').forEach(btn => btn.classList.remove('active'));
  if (sort === 'popular') {
    document.querySelector('.sort-btn:first-child').classList.add('active');
  } else {
    const btn = document.querySelector('.sort-btn:last-child');
    btn.classList.add('active');
    btn.textContent = `최신순 ${currentOrder === 'desc' ? '▼' : '▲'}`;
  }
  loadComments();
}

function setReplyTarget(parentId, authorName) {
  replyTarget = { parentId, authorName };
  const textarea = document.getElementById('comment-content');
  if (textarea) { textarea.value = `@${authorName} `; textarea.focus(); }
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
  
  const result = await submitComment(currentReviewId, {
    userId: user.id,
    parentId: replyTarget?.parentId || null,
    isAnonymous, content, tierRequest
  });
  
  if (result.id) {
    document.getElementById('comment-content').value = '';
    if (tierRequestCheck) tierRequestCheck.checked = false;
    if (tierRequestSelect) tierRequestSelect.disabled = true;
    replyTarget = null;
    await updateAnonStatus();
    loadComments();
  } else {
    alert(result.error || '댓글 등록 실패');
  }
}

// ============================================
// 리뷰 수정/삭제
// ============================================
function openEditReviewModal() {
  if (!currentReview) return;
  
  closeModal();
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'edit-review-modal';
  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-header">
        <h3 class="modal-title">✏️ 리뷰 수정</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form class="modal-form" onsubmit="handleEditReviewSubmit(event)">
        <div class="form-group">
          <label>한줄평</label>
          <input type="text" id="edit-oneliner" value="${currentReview.oneLiner || ''}" maxlength="100">
        </div>
        <div class="form-group">
          <label>본문</label>
          <textarea id="edit-content" rows="8">${currentReview.content || ''}</textarea>
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

function closeModal() {
  const modal = document.getElementById('edit-review-modal');
  if (modal) modal.remove();
}

async function handleEditReviewSubmit(e) {
  e.preventDefault();
  
  const user = getUser();
  if (!user) return;
  
  const oneLiner = document.getElementById('edit-oneliner').value;
  const content = document.getElementById('edit-content').value;
  
  const result = await updateReview(currentReviewId, {
    userId: user.id,
    oneLiner,
    content
  });
  
  if (result.message) {
    closeModal();
    alert('수정되었습니다.');
    const review = await fetchReview(currentReviewId);
    await renderReviewDetail(review);
  } else {
    alert(result.error || '수정 실패');
  }
}

async function handleDeleteReview() {
  const user = getUser();
  if (!user) return;
  
  if (!confirm('정말 이 리뷰를 삭제하시겠습니까?\n댓글도 모두 삭제됩니다.')) return;
  
  const result = await deleteReview(currentReviewId, user.id);
  
  if (result.message) {
    alert('삭제되었습니다.');
    location.href = `/anime.html?id=${currentReview.animeId}`;
  } else {
    alert(result.error || '삭제 실패');
  }
}

async function handleDeleteComment(commentId) {
  const user = getUser();
  if (!user) return;
  
  if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
  
  const result = await deleteComment(commentId, user.id);
  
  if (result.message) {
    loadComments();
  } else {
    alert(result.error || '삭제 실패');
  }
}

// ============================================
// 초기화
// ============================================
async function init() {
  renderAuthHeader();
  currentReviewId = getReviewId();
  if (!currentReviewId) { location.href = '/'; return; }
  const review = await fetchReview(currentReviewId);
  await renderReviewDetail(review);
}

document.addEventListener('DOMContentLoaded', init);