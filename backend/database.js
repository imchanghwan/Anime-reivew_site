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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // anime 테이블
    db.run(`
      CREATE TABLE IF NOT EXISTS anime (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        cover_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // reviews 테이블 (리뷰 = 글)
    db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anime_id INTEGER NOT NULL UNIQUE,
        user_id INTEGER,
        author TEXT DEFAULT '익명',
        password TEXT,
        tier TEXT NOT NULL CHECK(tier IN ('SSS', 'SS', 'A', 'B', 'C', 'D', 'E')),
        rating REAL NOT NULL CHECK(rating >= 0 AND rating <= 10),
        one_liner TEXT,
        content TEXT,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
  
  const categories = [
    { name: '인기', icon: '🔥', sort_order: 1 },
    { name: '추천', icon: '💎', sort_order: 2 },
    { name: '클래식', icon: '🏆', sort_order: 3 }
  ];
  
  const animeData = [
    { title: '장송의 프리렌', coverImage: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg', categories: ['인기', '추천'], featured: true, review: 
      { author: '프리렌덕후', tier: 'SSS', rating: 9.8, one_liner: '여운이 오래 남는 작품, 인생 애니 등극', content: '정말 최고의 애니입니다. 스토리, 작화, 음악 모두 완벽합니다. 프리렌과 힘멜의 이야기가 너무 감동적이에요.' }
    },
    { title: 'SPY×FAMILY', coverImage: 'https://cdn.myanimelist.net/images/anime/1764/126627.jpg', categories: ['인기', '추천'], featured: true, review: 
      { author: '아냐팬', tier: 'SS', rating: 9.2, one_liner: '가족 코미디의 정석, 아냐는 신이다', content: '아냐 너무 귀여워요! 온 가족이 함께 볼 수 있는 힐링 애니입니다. 주말마다 봤습니다.' }
    },
    { title: '체인소 맨', coverImage: 'https://cdn.myanimelist.net/images/anime/1806/126216.jpg', categories: ['인기'], featured: true, review: 
      { author: 'MAPPA신자', tier: 'A', rating: 8.7, one_liner: 'MAPPA 작화 미쳤고, 2기 기다리는 중', content: '액션신 퀄리티가 미쳤습니다. 데빌 헌터들의 이야기가 신선해요.' }
    },
    { title: '귀멸의 칼날', coverImage: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg', categories: ['인기'], featured: false, review: 
      { author: '탄지로', tier: 'SS', rating: 9.0, one_liner: '작화 혁명의 시작', content: 'UFOtable 작화 최고입니다. 무한열차편 극장판도 꼭 보세요.' }
    },
    { title: '원펀맨', coverImage: 'https://cdn.myanimelist.net/images/anime/10/78745.jpg', categories: ['인기'], featured: false, review: 
      { author: '사이타마', tier: 'A', rating: 8.5, one_liner: '히어로물의 새로운 패러다임', content: '1기 작화가 전설입니다. 사이타마 선생님 최고!' }
    },
    { title: '진격의 거인', coverImage: 'https://cdn.myanimelist.net/images/anime/1000/110531.jpg', categories: ['인기', '클래식'], featured: false, review: 
      { author: '에렌예거', tier: 'SSS', rating: 9.5, one_liner: '스토리텔링의 교과서', content: '복선 회수가 미쳤습니다. 파이널 시즌까지 완주했는데 대단합니다.' }
    },
    { title: '주술회전', coverImage: 'https://cdn.myanimelist.net/images/anime/1171/109222.jpg', categories: ['인기'], featured: false, review: 
      { author: '고죠사토루', tier: 'SS', rating: 8.9, one_liner: '전투신 퀄리티 미쳤다', content: 'MAPPA 작화 좋습니다. 고죠 선생님이 너무 멋있어요.' }
    },
    { title: '【최애의 아이】', coverImage: 'https://cdn.myanimelist.net/images/anime/1498/134443.jpg', categories: ['인기'], featured: false, review: 
      { author: '아이돌덕후', tier: 'SS', rating: 9.1, one_liner: '아이돌 업계의 어둠을 파헤치다', content: '충격적인 1화였습니다. 아이의 이야기가 계속 궁금해요.' }
    },
    { title: '봇치 더 록!', coverImage: 'https://cdn.myanimelist.net/images/anime/1160/122627.jpg', categories: ['인기', '추천'], featured: false, review: 
      { author: '봇치짱', tier: 'A', rating: 8.8, one_liner: '사회불안 밴드부의 성장기', content: '공감 100%입니다. 봇치 너무 귀여워요 ㅠㅠ' }
    },
    { title: '바이올렛 에버가든', coverImage: 'https://cdn.myanimelist.net/images/anime/1935/127974.jpg', categories: ['추천'], featured: false, review: 
      { author: '교애니팬', tier: 'SSS', rating: 9.4, one_liner: '눈물샘 터지는 감동 스토리', content: '매 화 울었습니다. 바이올렛의 성장이 감동적이에요.' }
    },
    { title: '슈타인즈 게이트', coverImage: 'https://cdn.myanimelist.net/images/anime/5/87048.jpg', categories: ['추천', '클래식'], featured: false, review: 
      { author: '오카린', tier: 'SSS', rating: 9.6, one_liner: '이거 안 보면 인생 손해', content: 'SF 걸작입니다. 타임루프물 최고봉이에요.' }
    },
    { title: '카우보이 비밥', coverImage: 'https://cdn.myanimelist.net/images/anime/1314/108941.jpg', categories: ['클래식'], featured: false, review: 
      { author: '스파이크', tier: 'SSS', rating: 9.5, one_liner: '애니메이션 역사의 한 페이지', content: 'OST가 전설입니다. 칸노 요코 천재.' }
    },
    { title: '에반게리온', coverImage: 'https://cdn.myanimelist.net/images/anime/10/22061.jpg', categories: ['클래식'], featured: false, review: 
      { author: '신지', tier: 'SSS', rating: 9.3, one_liner: '로봇물의 패러다임을 바꾸다', content: '해석이 어렵지만 명작입니다. 신극장판도 꼭 보세요.' }
    },
    { title: '강철의 연금술사', coverImage: 'https://cdn.myanimelist.net/images/anime/1223/96541.jpg', categories: ['클래식'], featured: false, review: 
      { author: '에드워드', tier: 'SSS', rating: 9.7, one_liner: '완벽한 스토리 구조의 교과서', content: '원작 완결까지 완벽합니다. BROTHERHOOD 버전 추천!' }
    },
    { title: '데스노트', coverImage: 'https://cdn.myanimelist.net/images/anime/9/9453.jpg', categories: ['클래식'], featured: false, review: 
      { author: '라이토', tier: 'SS', rating: 9.0, one_liner: '심리전의 끝판왕', content: 'L vs 라이토 명승부입니다. 두뇌 싸움 좋아하면 필수 시청!' }
    }
  ];
  
  // 카테고리 삽입
  categories.forEach(cat => {
    db.run(`INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)`, [cat.name, cat.icon, cat.sort_order]);
  });
  
  // 애니 및 리뷰 삽입
  setTimeout(() => {
    let featuredOrder = 1;
    animeData.forEach(anime => {
      db.run(
        `INSERT INTO anime (title, cover_image) VALUES (?, ?)`,
        [anime.title, anime.coverImage],
        function(err) {
          if (err) return;
          const animeId = this.lastID;
          
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
          
          // 리뷰 삽입 (1개만)
          if (anime.review) {
            const review = anime.review;
            db.run(
              `INSERT INTO reviews (anime_id, author, tier, rating, one_liner, content) VALUES (?, ?, ?, ?, ?, ?)`,
              [animeId, review.author, review.tier, review.rating, review.one_liner, review.content]
            );
          }
        }
      );
    });
    console.log('✅ 샘플 데이터 삽입 완료');
  }, 100);
}

module.exports = db;