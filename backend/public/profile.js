/**
 * AniLog - 프로필 편집 페이지
 */

const API = '/api';

// 유저 상태
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

// API - FormData로 파일 업로드
async function updateProfile(id, formData) {
  try {
    const res = await fetch(`${API}/users/${id}`, {
      method: 'PUT',
      body: formData // FormData는 Content-Type 자동 설정
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

async function deleteAccount(id, password) {
  try {
    const res = await fetch(`${API}/users/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return await res.json();
  } catch (e) {
    return { error: '서버 오류' };
  }
}

// 헤더 렌더링
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
  location.href = '/';
}

// 프로필 페이지 렌더링
let selectedImageFile = null;

function renderProfilePage() {
  const container = document.getElementById('profile-page');
  if (!container) return;
  
  const user = getUser();
  
  if (!user) {
    location.href = '/';
    return;
  }
  
  const initial = user.nickname.charAt(0).toUpperCase();
  
  container.innerHTML = `
    <h1 class="page-title">마이페이지</h1>
    
    <!-- 프로필 정보 섹션 -->
    <section class="profile-section">
      <h2 class="section-title">프로필 편집</h2>
      <form id="profile-form" class="profile-form">
        <div class="profile-avatar-section">
          <div class="avatar-container">
            <div class="user-avatar large" id="preview-avatar">
              ${user.profileImage ? `<img src="${user.profileImage}" alt="">` : initial}
            </div>
            <button type="button" class="camera-trigger-btn" onclick="document.getElementById('profileImageInput').click()">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                <circle cx="12" cy="13" r="3"></circle>
              </svg>
            </button>
            <input type="file" id="profileImageInput" accept="image/*" style="display: none;">
          </div>
          <div class="profile-info-text">
            <h4>프로필 이미지</h4>
            <p>JPG, PNG. 최대 3.5MB.</p>
          </div>
        </div>
        <div class="form-group">
          <label for="nickname">닉네임</label>
          <input type="text" id="nickname" value="${user.nickname}" required>
        </div>
        <button type="submit" class="submit-btn">저장</button>
      </form>
    </section>
    
    <!-- 비밀번호 변경 섹션 -->
    <section class="profile-section">
      <h2 class="section-title">비밀번호 변경</h2>
      <form id="password-form" class="profile-form">
        <div class="form-group">
          <label for="currentPassword">현재 비밀번호</label>
          <input type="password" id="currentPassword" required>
        </div>
        <div class="form-group">
          <label for="newPassword">새 비밀번호 (4자 이상)</label>
          <input type="password" id="newPassword" minlength="4" required>
        </div>
        <div class="form-group">
          <label for="newPasswordConfirm">새 비밀번호 확인</label>
          <input type="password" id="newPasswordConfirm" minlength="4" required>
        </div>
        <button type="submit" class="submit-btn">비밀번호 변경</button>
      </form>
    </section>
    
    <!-- 회원탈퇴 섹션 -->
    <section class="profile-section danger-section">
      <h2 class="section-title">회원탈퇴</h2>
      <p class="danger-text">탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.</p>
      <button class="danger-btn" onclick="showDeleteModal()">회원탈퇴</button>
    </section>
    
    <a href="/" class="back-btn">← 메인으로</a>
  `;
  
  // 파일 선택 이벤트
  document.getElementById('profileImageInput').addEventListener('change', handleImageSelect);
  
  // 프로필 저장
  document.getElementById('profile-form').addEventListener('submit', handleProfileSubmit);
  
  // 비밀번호 변경
  document.getElementById('password-form').addEventListener('submit', handlePasswordSubmit);
}

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // 파일 크기 체크 (3.5MB)
  if (file.size > 3.5 * 1024 * 1024) {
    alert('파일 크기는 3.5MB 이하여야 합니다.');
    e.target.value = '';
    return;
  }
  
  // 파일 타입 체크
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    alert('JPG, PNG, GIF, WEBP 파일만 허용됩니다.');
    e.target.value = '';
    return;
  }
  
  selectedImageFile = file;
  
  // 미리보기
  const reader = new FileReader();
  reader.onload = (event) => {
    const preview = document.getElementById('preview-avatar');
    preview.innerHTML = `<img src="${event.target.result}" alt="">`;
  };
  reader.readAsDataURL(file);
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  
  const user = getUser();
  const nickname = document.getElementById('nickname').value;
  
  const formData = new FormData();
  formData.append('nickname', nickname);
  
  if (selectedImageFile) {
    formData.append('profileImage', selectedImageFile);
  } else {
    // 기존 이미지 유지
    formData.append('existingProfileImage', user.profileImage || '');
  }
  
  const result = await updateProfile(user.id, formData);
  
  if (result.message) {
    // 로컬 유저 정보 업데이트
    user.nickname = nickname;
    user.profileImage = result.profileImage || user.profileImage;
    setUser(user);
    selectedImageFile = null;
    renderAuthHeader();
    alert('프로필이 수정되었습니다.');
  } else {
    alert(result.error || '수정 실패');
  }
}

async function handlePasswordSubmit(e) {
  e.preventDefault();
  
  const user = getUser();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const newPasswordConfirm = document.getElementById('newPasswordConfirm').value;
  
  // 비밀번호 2중 체크
  if (newPassword !== newPasswordConfirm) {
    alert('새 비밀번호가 일치하지 않습니다.');
    return;
  }
  
  const formData = new FormData();
  formData.append('nickname', user.nickname);
  formData.append('existingProfileImage', user.profileImage || '');
  formData.append('currentPassword', currentPassword);
  formData.append('newPassword', newPassword);
  
  const result = await updateProfile(user.id, formData);
  
  if (result.message) {
    alert('비밀번호가 변경되었습니다.');
    document.getElementById('password-form').reset();
  } else {
    alert(result.error || '변경 실패');
  }
}

function showDeleteModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'delete-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">회원탈퇴</h3>
        <button class="modal-close" onclick="closeDeleteModal()">&times;</button>
      </div>
      <form class="modal-form" onsubmit="handleDeleteAccount(event)">
        <p class="danger-text">정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
        <div class="form-group">
          <label>비밀번호 확인</label>
          <input type="password" id="delete-password" required>
        </div>
        <div class="modal-actions">
          <button type="button" class="auth-btn" onclick="closeDeleteModal()">취소</button>
          <button type="submit" class="danger-btn">탈퇴하기</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDeleteModal();
  });
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-modal');
  if (modal) modal.remove();
}

async function handleDeleteAccount(e) {
  e.preventDefault();
  
  const user = getUser();
  const password = document.getElementById('delete-password').value;
  
  const result = await deleteAccount(user.id, password);
  
  if (result.message) {
    clearUser();
    alert('탈퇴가 완료되었습니다.');
    location.href = '/';
  } else {
    alert(result.error || '탈퇴 실패');
  }
}

// 초기화
function init() {
  renderAuthHeader();
  renderProfilePage();
}

document.addEventListener('DOMContentLoaded', init);