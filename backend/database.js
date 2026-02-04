/**
 * AniLog Database Module
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'anilog.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('DB 연결 실패:', err);
  } else {
    console.log('✅ SQLite 데이터베이스 연결됨');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // users 테이블
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        nickname TEXT NOT NULL,
        profile_image TEXT DEFAULT '',
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 기존 DB 마이그레이션: is_admin 컬럼 추가
    db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (err) => {
      // 이미 있으면 에러 무시
      if (!err) {
        console.log('📦 is_admin 컬럼 추가됨');
        // admin 유저에게 관리자 권한 부여
        db.run(`UPDATE users SET is_admin = 1 WHERE username = 'admin'`);
      }
    });
    
    // anime 테이블 (parent_id: 부모 애니 참조, NULL이면 자식 애니)
    db.run(`
      CREATE TABLE IF NOT EXISTS anime (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        cover_image TEXT,
        parent_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES anime(id) ON DELETE SET NULL
      )
    `);
    
    // parent_anime 테이블 (부모 애니 - 시리즈 그룹용)
    db.run(`
      CREATE TABLE IF NOT EXISTS parent_anime (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // reviews 테이블 - 복수 리뷰 허용 (애니당 유저당 1개)
    db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anime_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        is_anonymous INTEGER DEFAULT 0,
        tier TEXT NOT NULL CHECK(tier IN ('SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E')),
        rating REAL NOT NULL CHECK(rating >= 0 AND rating <= 10),
        one_liner TEXT,
        content TEXT,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(anime_id, user_id)
      )
    `);
    
    // review_votes 테이블 (개추/비추)
    db.run(`
      CREATE TABLE IF NOT EXISTS review_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(review_id, user_id)
      )
    `);
    
    // comments 테이블
    db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        parent_id INTEGER,
        anon_number INTEGER,
        is_anonymous INTEGER DEFAULT 0,
        content TEXT NOT NULL,
        tier_request TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `);
    
    // comment_votes 테이블 (댓글 개추)
    db.run(`
      CREATE TABLE IF NOT EXISTS comment_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(comment_id, user_id)
      )
    `);
    
    // categories 테이블
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT DEFAULT '📁',
        sort_order INTEGER DEFAULT 0
      )
    `);
    
    // anime_categories 테이블
    db.run(`
      CREATE TABLE IF NOT EXISTS anime_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anime_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        UNIQUE(anime_id, category_id)
      )
    `);
    
    // featured 테이블 (상단 카드용)
    db.run(`
      CREATE TABLE IF NOT EXISTS featured (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anime_id INTEGER NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
      )
    `);
    
    // 초기 데이터 확인
    db.get('SELECT COUNT(*) as count FROM categories', [], (err, row) => {
      if (err || !row || row.count === 0) {
        insertSampleData();
      }
    });
  });
}

function insertSampleData() {
  console.log('📦 샘플 데이터 삽입 중...');
  
  // 테스트 유저들
  const users = [
    { id: 1, username: 'admin', password: 'admin', nickname: '관리자', isAdmin: 1 },
    { id: 2, username: 'user1', password: '1234', nickname: '애니덕후', isAdmin: 0 },
    { id: 3, username: 'user2', password: '1234', nickname: '프리렌사랑', isAdmin: 0 },
    { id: 4, username: 'user3', password: '1234', nickname: '아냐팬', isAdmin: 0 },
    { id: 5, username: 'user4', password: '1234', nickname: 'MAPPA신자', isAdmin: 0 }
  ];
  
  users.forEach(u => {
    db.run(`INSERT INTO users (id, username, password, nickname, is_admin) VALUES (?, ?, ?, ?, ?)`, 
      [u.id, u.username, u.password, u.nickname, u.isAdmin]);
  });
  
  const categories = [
    { name: '인기', icon: '🔥', sort_order: 1 },
    { name: '추천', icon: '💎', sort_order: 2 },
    { name: '클래식', icon: '🏆', sort_order: 3 }
  ];
  
  // 부모 애니 (시리즈 그룹)
  const parentAnimeData = [
    { id: 1, title: '진격의 거인' },
    { id: 2, title: '귀멸의 칼날' },
    { id: 3, title: 'SPY×FAMILY' },
    { id: 4, title: '주술회전' }
  ];
  
  const animeData = [
    { title: '장송의 프리렌', coverImage: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg', parentId: null, categories: ['인기', '추천'], featured: true },
    { title: 'SPY×FAMILY 1기', coverImage: 'https://cdn.myanimelist.net/images/anime/1764/126627.jpg', parentId: 3, categories: ['인기', '추천'], featured: true },
    { title: 'SPY×FAMILY 2기', coverImage: 'https://cdn.myanimelist.net/images/anime/1506/138982.jpg', parentId: 3, categories: ['인기'], featured: false },
    { title: '체인소 맨', coverImage: 'https://cdn.myanimelist.net/images/anime/1806/126216.jpg', parentId: null, categories: ['인기'], featured: true },
    { title: '귀멸의 칼날 1기', coverImage: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg', parentId: 2, categories: ['인기'], featured: false },
    { title: '귀멸의 칼날 유곽편', coverImage: 'https://cdn.myanimelist.net/images/anime/1908/120036.jpg', parentId: 2, categories: ['인기'], featured: false },
    { title: '귀멸의 칼날 대장장이 마을편', coverImage: 'https://cdn.myanimelist.net/images/anime/1765/135099.jpg', parentId: 2, categories: ['인기'], featured: false },
    { title: '원펀맨', coverImage: 'https://cdn.myanimelist.net/images/anime/10/78745.jpg', parentId: null, categories: ['인기'], featured: false },
    { title: '진격의 거인 1기', coverImage: 'https://cdn.myanimelist.net/images/anime/1000/110531.jpg', parentId: 1, categories: ['인기', '클래식'], featured: false },
    { title: '진격의 거인 2기', coverImage: 'https://cdn.myanimelist.net/images/anime/4/84177.jpg', parentId: 1, categories: ['인기'], featured: false },
    { title: '진격의 거인 3기', coverImage: 'https://cdn.myanimelist.net/images/anime/1173/92110.jpg', parentId: 1, categories: ['인기'], featured: false },
    { title: '진격의 거인 파이널', coverImage: 'https://cdn.myanimelist.net/images/anime/1988/119437.jpg', parentId: 1, categories: ['인기'], featured: false },
    { title: '주술회전 1기', coverImage: 'https://cdn.myanimelist.net/images/anime/1171/109222.jpg', parentId: 4, categories: ['인기'], featured: false },
    { title: '주술회전 2기', coverImage: 'https://cdn.myanimelist.net/images/anime/1792/138022.jpg', parentId: 4, categories: ['인기'], featured: false },
    { title: '【최애의 아이】', coverImage: 'https://cdn.myanimelist.net/images/anime/1498/134443.jpg', parentId: null, categories: ['인기'], featured: false },
    { title: '봇치 더 록!', coverImage: 'https://cdn.myanimelist.net/images/anime/1160/122627.jpg', parentId: null, categories: ['인기', '추천'], featured: false },
    { title: '바이올렛 에버가든', coverImage: 'https://cdn.myanimelist.net/images/anime/1935/127974.jpg', parentId: null, categories: ['추천'], featured: false },
    { title: '슈타인즈 게이트', coverImage: 'https://cdn.myanimelist.net/images/anime/5/87048.jpg', parentId: null, categories: ['추천', '클래식'], featured: false },
    { title: '카우보이 비밥', coverImage: 'https://cdn.myanimelist.net/images/anime/1314/108941.jpg', parentId: null, categories: ['클래식'], featured: false },
    { title: '에반게리온', coverImage: 'https://cdn.myanimelist.net/images/anime/10/22061.jpg', parentId: null, categories: ['클래식'], featured: false },
    { title: '강철의 연금술사', coverImage: 'https://cdn.myanimelist.net/images/anime/1223/96541.jpg', parentId: null, categories: ['클래식'], featured: false },
    { title: '데스노트', coverImage: 'https://cdn.myanimelist.net/images/anime/9/9453.jpg', parentId: null, categories: ['클래식'], featured: false }
  ];
  
  // 리뷰 데이터 (anime_id 기준, 복수 리뷰)
  const reviewsData = [
    // 장송의 프리렌 (anime_id: 1) - 여러 리뷰
    { animeId: 1, userId: 1, isAnonymous: 0, tier: 'SSS', rating: 9.8, oneLiner: '여운이 오래 남는 작품, 인생 애니 등극', content: '정말 최고의 애니입니다. 스토리, 작화, 음악 모두 완벽합니다.', viewCount: 1520 },
    { animeId: 1, userId: 2, isAnonymous: 0, tier: 'SSS', rating: 9.9, oneLiner: '10년에 한번 나올까 말까 한 명작', content: '프리렌과 힘멜의 관계가 너무 아름다워요.', viewCount: 890 },
    { animeId: 1, userId: 3, isAnonymous: 1, tier: 'SS', rating: 9.5, oneLiner: '프리렌 최고! 힘멜도 최고!', content: '매 화 감동입니다. 강추합니다.', viewCount: 456 },
    { animeId: 1, userId: 4, isAnonymous: 0, tier: 'SSS', rating: 9.7, oneLiner: '작화 퀄리티 미쳤다', content: '매드하우스 작화 진짜 대단합니다.', viewCount: 234 },
    
    // SPY×FAMILY 1기 (anime_id: 2)
    { animeId: 2, userId: 1, isAnonymous: 0, tier: 'SS', rating: 9.2, oneLiner: '가족 코미디의 정석, 아냐는 신이다', content: '온 가족이 함께 볼 수 있는 힐링 애니입니다.', viewCount: 980 },
    { animeId: 2, userId: 4, isAnonymous: 0, tier: 'SS', rating: 9.0, oneLiner: '아냐 너무 귀여워요!!', content: '매주 기다리며 봤습니다.', viewCount: 567 },
    { animeId: 2, userId: 5, isAnonymous: 1, tier: 'A', rating: 8.5, oneLiner: '재밌지만 스토리가 좀 느림', content: '캐릭터는 좋은데 진행이 느려요.', viewCount: 123 },
    
    // 체인소 맨 (anime_id: 4)
    { animeId: 4, userId: 5, isAnonymous: 0, tier: 'A', rating: 8.7, oneLiner: 'MAPPA 작화 미쳤고, 2기 기다리는 중', content: '액션신 퀄리티가 미쳤습니다.', viewCount: 1100 },
    { animeId: 4, userId: 1, isAnonymous: 0, tier: 'SS', rating: 9.0, oneLiner: '원작팬인데 애니도 만족', content: '데빌 헌터들의 이야기가 신선해요.', viewCount: 780 },
    { animeId: 4, userId: 2, isAnonymous: 1, tier: 'B', rating: 7.5, oneLiner: '호불호 갈리는 작품', content: '작화는 좋은데 스토리가 취향 아님.', viewCount: 340 },
    
    // 귀멸의 칼날 1기 (anime_id: 5)
    { animeId: 5, userId: 1, isAnonymous: 0, tier: 'SS', rating: 9.0, oneLiner: '작화 혁명의 시작', content: 'UFOtable 작화 최고입니다.', viewCount: 2100 },
    { animeId: 5, userId: 2, isAnonymous: 0, tier: 'SS', rating: 9.2, oneLiner: '19화 히노카미 카구라 레전드', content: '전투신 역대급입니다.', viewCount: 1450 },
    
    // 원펀맨 (anime_id: 8)
    { animeId: 8, userId: 2, isAnonymous: 0, tier: 'A', rating: 8.5, oneLiner: '히어로물의 새로운 패러다임', content: '1기 작화가 전설입니다.', viewCount: 890 },
    
    // 진격의 거인 1기 (anime_id: 9)
    { animeId: 9, userId: 1, isAnonymous: 0, tier: 'SSS', rating: 9.5, oneLiner: '스토리텔링의 교과서', content: '복선 회수가 미쳤습니다.', viewCount: 3200 },
    { animeId: 9, userId: 3, isAnonymous: 0, tier: 'SSS', rating: 9.8, oneLiner: '역대급 떡밥 회수', content: '파이널까지 완주 필수입니다.', viewCount: 2100 },
    
    // 주술회전 1기 (anime_id: 13)
    { animeId: 13, userId: 5, isAnonymous: 0, tier: 'SS', rating: 8.9, oneLiner: '전투신 퀄리티 미쳤다', content: 'MAPPA 작화 좋습니다.', viewCount: 1560 },
    
    // 최애의 아이 (anime_id: 15)
    { animeId: 15, userId: 2, isAnonymous: 0, tier: 'SS', rating: 9.1, oneLiner: '아이돌 업계의 어둠을 파헤치다', content: '충격적인 1화였습니다.', viewCount: 1230 },
    
    // 봇치 더 록 (anime_id: 16)
    { animeId: 16, userId: 3, isAnonymous: 0, tier: 'A', rating: 8.8, oneLiner: '사회불안 밴드부의 성장기', content: '공감 100%입니다.', viewCount: 670 },
    
    // 바이올렛 에버가든 (anime_id: 17)
    { animeId: 17, userId: 1, isAnonymous: 0, tier: 'SSS', rating: 9.4, oneLiner: '눈물샘 터지는 감동 스토리', content: '매 화 울었습니다.', viewCount: 1890 },
    
    // 슈타인즈 게이트 (anime_id: 18)
    { animeId: 18, userId: 1, isAnonymous: 0, tier: 'SSS', rating: 9.6, oneLiner: '이거 안 보면 인생 손해', content: 'SF 걸작입니다.', viewCount: 2340 },
    
    // 카우보이 비밥 (anime_id: 19)
    { animeId: 19, userId: 2, isAnonymous: 0, tier: 'SSS', rating: 9.5, oneLiner: '애니메이션 역사의 한 페이지', content: 'OST가 전설입니다.', viewCount: 1670 },
    
    // 에반게리온 (anime_id: 20)
    { animeId: 20, userId: 1, isAnonymous: 0, tier: 'SSS', rating: 9.3, oneLiner: '로봇물의 패러다임을 바꾸다', content: '해석이 어렵지만 명작입니다.', viewCount: 2890 },
    
    // 강철의 연금술사 (anime_id: 21)
    { animeId: 21, userId: 1, isAnonymous: 0, tier: 'SSS', rating: 9.7, oneLiner: '완벽한 스토리 구조의 교과서', content: '원작 완결까지 완벽합니다.', viewCount: 3100 },
    
    // 데스노트 (anime_id: 22)
    { animeId: 22, userId: 2, isAnonymous: 0, tier: 'SS', rating: 9.0, oneLiner: '심리전의 끝판왕', content: 'L vs 라이토 명승부입니다.', viewCount: 2450 }
  ];
  
  // 카테고리 삽입
  categories.forEach(cat => {
    db.run(`INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)`, [cat.name, cat.icon, cat.sort_order]);
  });
  
  // 부모 애니 삽입
  parentAnimeData.forEach(parent => {
    db.run(`INSERT INTO parent_anime (id, title) VALUES (?, ?)`, [parent.id, parent.title]);
  });
  
  // 애니 삽입
  setTimeout(() => {
    let featuredOrder = 1;
    animeData.forEach((anime, idx) => {
      const animeId = idx + 1;
      db.run(
        `INSERT INTO anime (id, title, cover_image, parent_id) VALUES (?, ?, ?, ?)`,
        [animeId, anime.title, anime.coverImage, anime.parentId],
        function(err) {
          if (err) return;
          
          // 카테고리 연결
          anime.categories.forEach(catName => {
            db.get(`SELECT id FROM categories WHERE name = ?`, [catName], (err, row) => {
              if (row) {
                db.run(`INSERT INTO anime_categories (anime_id, category_id) VALUES (?, ?)`, [animeId, row.id]);
              }
            });
          });
          
          // Featured 등록
          if (anime.featured) {
            db.run(`INSERT INTO featured (anime_id, sort_order) VALUES (?, ?)`, [animeId, featuredOrder++]);
          }
        }
      );
    });
    
    // 리뷰 삽입
    setTimeout(() => {
      reviewsData.forEach(review => {
        db.run(
          `INSERT INTO reviews (anime_id, user_id, is_anonymous, tier, rating, one_liner, content, view_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [review.animeId, review.userId, review.isAnonymous, review.tier, review.rating, review.oneLiner, review.content, review.viewCount],
          function(err) {
            if (err) return;
            const reviewId = this.lastID;
            
            // 일부 리뷰에 추천 추가
            if (review.viewCount > 1000) {
              // 높은 조회수 리뷰에 추천 추가
              const voteCount = Math.floor(review.viewCount / 100);
              for (let i = 1; i <= Math.min(voteCount, 5); i++) {
                if (i !== review.userId) {
                  db.run(`INSERT OR IGNORE INTO review_votes (review_id, user_id, vote_type) VALUES (?, ?, 'up')`, [reviewId, i]);
                }
              }
            }
          }
        );
      });
      console.log('✅ 샘플 데이터 삽입 완료');
    }, 100);
  }, 100);
}

module.exports = db;