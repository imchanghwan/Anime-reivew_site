/**
 * AniLog Backend Server
 */

const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 80;
const HOST = '0.0.0.0'; // 외부 접속 허용

// uploads 디렉토리 생성
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3.5 * 1024 * 1024 }, // 3.5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('JPG, PNG, GIF, WEBP만 허용됩니다'), false);
    }
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// ============================================
// 유저 API (로그인/회원가입)
// ============================================

// POST /api/register - 회원가입
app.post('/api/register', (req, res) => {
  const { username, password, nickname } = req.body;
  
  if (!username || !password || !nickname) {
    return res.status(400).json({ error: '아이디, 비밀번호, 닉네임 필수' });
  }
  
  if (username.length < 4 || password.length < 4) {
    return res.status(400).json({ error: '아이디와 비밀번호는 4자 이상' });
  }
  
  // 아이디 중복 체크
  db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) {
      return res.status(400).json({ error: '이미 존재하는 아이디입니다' });
    }
    
    db.run(
      `INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)`,
      [username, password, nickname],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: '이미 존재하는 아이디입니다' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, message: '가입 완료' });
      }
    );
  });
});

// POST /api/login - 로그인
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호 필수' });
  }
  
  db.get(
    `SELECT id, username, nickname, profile_image as profileImage, is_admin as isAdmin FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다' });
      
      res.json({ user: row });
    }
  );
});

// PUT /api/users/:id - 프로필 수정 (파일 업로드 지원)
app.put('/api/users/:id', upload.single('profileImage'), (req, res) => {
  const { id } = req.params;
  const { nickname, currentPassword, newPassword } = req.body;

  // 프로필 이미지 경로 결정
  let profileImagePath = req.body.existingProfileImage || ''; // 기존 이미지 유지용
  if (req.file) {
    profileImagePath = `/uploads/${req.file.filename}`;
  }

  // 업데이트 후 유저 정보 반환 헬퍼
  const returnUpdatedUser = () => {
    db.get(
      `SELECT id, username, nickname, profile_image as profileImage, is_admin as isAdmin FROM users WHERE id = ?`,
      [id],
      (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: '수정 완료', user });
      }
    );
  };

  // 비밀번호 변경 시 현재 비밀번호 확인
  if (newPassword) {
    db.get(`SELECT password FROM users WHERE id = ?`, [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'User not found' });
      if (row.password !== currentPassword) {
        return res.status(403).json({ error: '현재 비밀번호가 틀렸습니다' });
      }

      db.run(
        `UPDATE users SET nickname = ?, profile_image = ?, password = ? WHERE id = ?`,
        [nickname, profileImagePath, newPassword, id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          returnUpdatedUser();
        }
      );
    });
  } else {
    db.run(
      `UPDATE users SET nickname = ?, profile_image = ? WHERE id = ?`,
      [nickname, profileImagePath, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        returnUpdatedUser();
      }
    );
  }
});

// DELETE /api/users/:id - 회원탈퇴
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  
  db.get(`SELECT password FROM users WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    if (row.password !== password) {
      return res.status(403).json({ error: '비밀번호가 틀렸습니다' });
    }
    
    // 유저 삭제 (리뷰는 user_id가 NULL로 됨)
    db.run(`DELETE FROM users WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '탈퇴 완료' });
    });
  });
});

// ============================================
// 애니 API (리뷰 평균 포함)
// ============================================

// GET /api/animes - 전체 애니 목록 (검색용, 간단)
app.get('/api/animes', (req, res) => {
  db.all(
    `SELECT id, title, cover_image as coverImage FROM anime ORDER BY title`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET /api/anime - 전체 애니 목록 (리뷰 통계 포함)
app.get('/api/anime', (req, res) => {
  db.all(
    `SELECT 
      a.id, a.title, a.cover_image as coverImage,
      COUNT(r.id) as reviewCount,
      AVG(r.rating) as avgRating
    FROM anime a
    LEFT JOIN reviews r ON a.id = r.anime_id
    GROUP BY a.id
    ORDER BY avgRating DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const animeIds = rows.map(r => r.id);
      if (animeIds.length === 0) return res.json([]);
      
      // 카테고리 조회
      const placeholders = animeIds.map(() => '?').join(',');
      db.all(
        `SELECT ac.anime_id, c.name FROM anime_categories ac
         JOIN categories c ON ac.category_id = c.id
         WHERE ac.anime_id IN (${placeholders})`,
        animeIds,
        (err, catRows) => {
          if (err) return res.status(500).json({ error: err.message });
          
          // 리뷰 조회 (user_id로 닉네임 JOIN)
          db.all(
            `SELECT r.anime_id, r.user_id, r.is_anonymous, r.tier, r.rating, r.one_liner,
                    u.nickname
             FROM reviews r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.anime_id IN (${placeholders})`,
            animeIds,
            (err, reviewRows) => {
              if (err) return res.status(500).json({ error: err.message });
              
              const catMap = {};
              catRows.forEach(cr => {
                if (!catMap[cr.anime_id]) catMap[cr.anime_id] = [];
                catMap[cr.anime_id].push(cr.name);
              });
              
              const reviewMap = {};
              reviewRows.forEach(r => {
                if (!reviewMap[r.anime_id]) reviewMap[r.anime_id] = [];
                reviewMap[r.anime_id].push(r);
              });
              
              const result = rows.map(a => {
                const reviews = reviewMap[a.id] || [];
                const randomReview = reviews.length > 0 ? reviews[Math.floor(Math.random() * reviews.length)] : null;
                
                // 가장 많은 티어 계산
                const tierCounts = {};
                reviews.forEach(r => {
                  tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
                });
                const topTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'A';
                
                // 익명 처리
                const reviewerName = randomReview ? 
                  (randomReview.is_anonymous ? '익명' : (randomReview.nickname || '익명')) : '';
                
                return {
                  id: a.id,
                  title: a.title,
                  coverImage: a.coverImage,
                  tier: topTier,
                  rating: a.avgRating ? Math.round(a.avgRating * 10) / 10 : 0,
                  reviewCount: a.reviewCount,
                  oneLiner: randomReview?.one_liner || '',
                  reviewer: reviewerName,
                  category: catMap[a.id] || []
                };
              });
              
              res.json(result);
            }
          );
        }
      );
    }
  );
});

// GET /api/anime/:id - 애니 상세 (모든 리뷰 포함)
app.get('/api/anime/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT id, title, cover_image as coverImage FROM anime WHERE id = ?`, [id], (err, anime) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!anime) return res.status(404).json({ error: 'Anime not found' });
    
    db.all(
      `SELECT r.id, r.user_id as userId, r.author, r.tier, r.rating, r.one_liner as oneLiner, r.content, r.created_at as createdAt,
              u.nickname, u.profile_image as profileImage
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.anime_id = ? 
       ORDER BY r.created_at DESC`,
      [id],
      (err, reviews) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // 닉네임 우선, 없으면 author
        const formattedReviews = reviews.map(r => ({
          ...r,
          author: r.nickname || r.author || '익명',
          profileImage: r.profileImage || ''
        }));
        
        res.json({ ...anime, reviews: formattedReviews });
      }
    );
  });
});

// ============================================
// Featured API (상단 카드) - 평점 TOP 3
// ============================================

// GET /api/featured - 평점 상위 3개 애니
app.get('/api/featured', (req, res) => {
  db.all(
    `SELECT 
      a.id, a.title, a.cover_image as coverImage,
      AVG(r.rating) as avgRating,
      COUNT(r.id) as reviewCount
    FROM anime a
    LEFT JOIN reviews r ON a.id = r.anime_id
    GROUP BY a.id
    HAVING reviewCount > 0
    ORDER BY avgRating DESC
    LIMIT 3`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const animeIds = rows.map(r => r.id);
      if (animeIds.length === 0) return res.json([]);
      
      const placeholders = animeIds.map(() => '?').join(',');
      db.all(
        `SELECT r.anime_id, r.user_id, r.is_anonymous, r.tier, r.rating, r.one_liner,
                u.nickname
         FROM reviews r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.anime_id IN (${placeholders})`,
        animeIds,
        (err, reviewRows) => {
          if (err) return res.status(500).json({ error: err.message });
          
          const reviewMap = {};
          reviewRows.forEach(r => {
            if (!reviewMap[r.anime_id]) reviewMap[r.anime_id] = [];
            reviewMap[r.anime_id].push(r);
          });
          
          const result = rows.map(a => {
            const reviews = reviewMap[a.id] || [];
            const randomReview = reviews.length > 0 ? reviews[Math.floor(Math.random() * reviews.length)] : null;
            
            const tierCounts = {};
            reviews.forEach(r => {
              tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
            });
            const topTier = Object.entries(tierCounts).sort((x, y) => y[1] - x[1])[0]?.[0] || 'A';
            
            // 익명 처리
            const reviewerName = randomReview ? 
              (randomReview.is_anonymous ? '익명' : (randomReview.nickname || '익명')) : '';
            
            return {
              id: a.id,
              title: a.title,
              coverImage: a.coverImage,
              tier: topTier,
              rating: a.avgRating ? Math.round(a.avgRating * 10) / 10 : 0,
              oneLiner: randomReview?.one_liner || '',
              reviewer: reviewerName
            };
          });
          
          res.json(result);
        }
      );
    }
  );
});

// GET /api/recent-activity - 최근 활동 애니 (리뷰, 댓글, 추천 등)
app.get('/api/recent-activity', (req, res) => {
  db.all(
    `SELECT a.id, a.title, a.cover_image as coverImage,
            MAX(
              IFNULL(r.created_at, ''),
              IFNULL(c.created_at, ''),
              IFNULL(rv.created_at, '')
            ) as lastActivity,
            AVG(r2.rating) as avgRating
     FROM anime a
     LEFT JOIN reviews r ON a.id = r.anime_id
     LEFT JOIN reviews r2 ON a.id = r2.anime_id
     LEFT JOIN comments c ON r.id = c.review_id
     LEFT JOIN review_votes rv ON r.id = rv.review_id
     GROUP BY a.id
     HAVING lastActivity != ''
     ORDER BY lastActivity DESC
     LIMIT 10`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 티어 계산
      const animeIds = rows.map(r => r.id);
      if (animeIds.length === 0) return res.json([]);
      
      const placeholders = animeIds.map(() => '?').join(',');
      db.all(
        `SELECT anime_id, tier FROM reviews WHERE anime_id IN (${placeholders})`,
        animeIds,
        (err, tierRows) => {
          if (err) return res.json(rows);
          
          const tierMap = {};
          tierRows.forEach(t => {
            if (!tierMap[t.anime_id]) tierMap[t.anime_id] = {};
            tierMap[t.anime_id][t.tier] = (tierMap[t.anime_id][t.tier] || 0) + 1;
          });
          
          const result = rows.map(a => {
            const tiers = tierMap[a.id] || {};
            const topTier = Object.entries(tiers).sort((x, y) => y[1] - x[1])[0]?.[0] || 'A';
            return {
              id: a.id,
              title: a.title,
              coverImage: a.coverImage,
              tier: topTier,
              rating: a.avgRating ? Math.round(a.avgRating * 10) / 10 : 0
            };
          });
          
          res.json(result);
        }
      );
    }
  );
});

// GET /api/all-anime - 모든 애니 목록 (메인 페이지용)
app.get('/api/all-anime', (req, res) => {
  db.all(
    `SELECT 
      a.id, a.title, a.cover_image as coverImage,
      AVG(r.rating) as avgRating
     FROM anime a
     LEFT JOIN reviews r ON a.id = r.anime_id
     GROUP BY a.id
     ORDER BY a.title`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 티어 계산
      const animeIds = rows.map(r => r.id);
      if (animeIds.length === 0) return res.json([]);
      
      const placeholders = animeIds.map(() => '?').join(',');
      db.all(
        `SELECT anime_id, tier FROM reviews WHERE anime_id IN (${placeholders})`,
        animeIds,
        (err, tierRows) => {
          if (err) return res.json(rows);
          
          const tierMap = {};
          tierRows.forEach(t => {
            if (!tierMap[t.anime_id]) tierMap[t.anime_id] = {};
            tierMap[t.anime_id][t.tier] = (tierMap[t.anime_id][t.tier] || 0) + 1;
          });
          
          const result = rows.map(a => {
            const tiers = tierMap[a.id] || {};
            const topTier = Object.entries(tiers).sort((x, y) => y[1] - x[1])[0]?.[0] || null;
            return {
              id: a.id,
              title: a.title,
              coverImage: a.coverImage,
              tier: topTier,
              rating: a.avgRating ? Math.round(a.avgRating * 10) / 10 : 0
            };
          });
          
          res.json(result);
        }
      );
    }
  );
});

// ============================================
// 카테고리 API
// ============================================

// GET /api/categories - 카테고리별 애니 목록
app.get('/api/categories', (req, res) => {
  db.all(`SELECT id, name, icon, sort_order as sortOrder FROM categories ORDER BY sort_order`, [], (err, categories) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (categories.length === 0) return res.json([]);
    
    const result = [];
    let completed = 0;
    
    categories.forEach((cat, index) => {
      db.all(
        `SELECT 
          a.id, a.title, a.cover_image as coverImage,
          AVG(r.rating) as avgRating
        FROM anime a
        JOIN anime_categories ac ON a.id = ac.anime_id
        LEFT JOIN reviews r ON a.id = r.anime_id
        WHERE ac.category_id = ?
        GROUP BY a.id
        ORDER BY avgRating DESC`,
        [cat.id],
        (err, animeRows) => {
          if (err) {
            result[index] = { ...cat, animeList: [] };
            completed++;
            if (completed === categories.length) res.json(result);
            return;
          }
          
          const animeIds = animeRows.map(a => a.id);
          if (animeIds.length === 0) {
            result[index] = { ...cat, animeList: [] };
            completed++;
            if (completed === categories.length) res.json(result);
            return;
          }
          
          const placeholders = animeIds.map(() => '?').join(',');
          db.all(
            `SELECT r.anime_id, r.user_id, r.is_anonymous, r.tier, r.rating, r.one_liner,
                    u.nickname
             FROM reviews r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.anime_id IN (${placeholders})`,
            animeIds,
            (err, reviewRows) => {
              const reviewMap = {};
              (reviewRows || []).forEach(r => {
                if (!reviewMap[r.anime_id]) reviewMap[r.anime_id] = [];
                reviewMap[r.anime_id].push(r);
              });
              
              const animeList = animeRows.map(a => {
                const reviews = reviewMap[a.id] || [];
                const randomReview = reviews.length > 0 ? reviews[Math.floor(Math.random() * reviews.length)] : null;
                
                const tierCounts = {};
                reviews.forEach(r => {
                  tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
                });
                const topTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'A';
                
                // 익명 처리
                const reviewerName = randomReview ? 
                  (randomReview.is_anonymous ? '익명' : (randomReview.nickname || '익명')) : '';
                
                return {
                  id: a.id,
                  title: a.title,
                  coverImage: a.coverImage,
                  tier: topTier,
                  rating: a.avgRating ? Math.round(a.avgRating * 10) / 10 : 0,
                  oneLiner: randomReview?.one_liner || '',
                  reviewer: reviewerName
                };
              });
              
              result[index] = { ...cat, animeList };
              completed++;
              if (completed === categories.length) res.json(result);
            }
          );
        }
      );
    });
  });
});

// POST /api/categories
app.post('/api/categories', (req, res) => {
  const { name, icon, sortOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'name 필수' });
  
  db.run(`INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)`, [name, icon || '📁', sortOrder || 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

// ============================================
// 리뷰 API (글쓰기)
// ============================================

// GET /api/anime/:id/reviews - 애니의 리뷰 목록 (정렬 지원)
app.get('/api/anime/:id/reviews', (req, res) => {
  const { id } = req.params;
  const { sort } = req.query; // sort: votes (추천순, 기본), views (조회순)
  
  // 애니 정보 조회
  db.get(
    `SELECT a.id, a.title, a.cover_image as coverImage, a.parent_id as parentId,
            p.title as parentTitle
     FROM anime a
     LEFT JOIN parent_anime p ON a.parent_id = p.id
     WHERE a.id = ?`, 
    [id], 
    (err, anime) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!anime) return res.status(404).json({ error: 'Anime not found' });
      
      // 관련 애니 조회
      const fetchRelatedAnime = (callback) => {
        if (!anime.parentId) {
          callback([]);
          return;
        }
        
        db.all(
          `SELECT a.id, a.title, a.cover_image as coverImage
           FROM anime a
           WHERE a.parent_id = ? AND a.id != ?
           ORDER BY a.id`,
          [anime.parentId, id],
          (err, rows) => {
            callback(rows || []);
          }
        );
      };
      
      // 리뷰 목록 조회 (추천수, 조회수, 댓글수 포함)
      db.all(
        `SELECT r.id, r.anime_id as animeId, r.user_id as userId, r.is_anonymous as isAnonymous,
                r.tier, r.rating, r.one_liner as oneLiner, r.content, 
                r.view_count as viewCount, r.created_at as createdAt,
                u.nickname, u.profile_image as profileImage,
                (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote_type = 'up') as upCount,
                (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote_type = 'down') as downCount,
                (SELECT COUNT(*) FROM comments c WHERE c.review_id = r.id) as commentCount
         FROM reviews r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.anime_id = ?`,
        [id],
        (err, reviews) => {
          if (err) return res.status(500).json({ error: err.message });
          
          fetchRelatedAnime((relatedAnime) => {
            // 정렬
            const sortedReviews = [...(reviews || [])];
            if (sort === 'views') {
              sortedReviews.sort((a, b) => b.viewCount - a.viewCount);
            } else {
              // 기본: 추천순
              sortedReviews.sort((a, b) => (b.upCount - b.downCount) - (a.upCount - a.downCount));
            }
            
            // 포맷팅
            const formattedReviews = sortedReviews.map(r => {
              const authorName = r.isAnonymous ? '익명' : (r.nickname || '알 수 없음');
              const authorImage = r.isAnonymous ? '' : (r.profileImage || '');
              
              return {
                ...r,
                author: authorName,
                profileImage: authorImage
              };
            });
            
            // 평균 평점 계산
            const avgRating = reviews && reviews.length > 0 
              ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10 
              : 0;
            
            res.json({
              ...anime,
              relatedAnime,
              avgRating,
              reviewCount: reviews ? reviews.length : 0,
              reviews: formattedReviews
            });
          });
        }
      );
    }
  );
});

// GET /api/reviews/:reviewId - 개별 리뷰 상세 (조회수 증가)
app.get('/api/reviews/:reviewId', (req, res) => {
  const { reviewId } = req.params;
  
  // 조회수 증가
  db.run(`UPDATE reviews SET view_count = view_count + 1 WHERE id = ?`, [reviewId]);
  
  db.get(
    `SELECT r.id, r.anime_id as animeId, r.user_id as userId, r.is_anonymous as isAnonymous,
            r.tier, r.rating, r.one_liner as oneLiner, r.content, 
            r.view_count as viewCount, r.created_at as createdAt,
            u.nickname, u.profile_image as profileImage,
            a.title as animeTitle, a.cover_image as animeCoverImage
     FROM reviews r
     LEFT JOIN users u ON r.user_id = u.id
     LEFT JOIN anime a ON r.anime_id = a.id
     WHERE r.id = ?`,
    [reviewId],
    (err, review) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!review) return res.status(404).json({ error: 'Review not found' });
      
      // 추천수 조회
      db.get(
        `SELECT 
          SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE 0 END) as upCount,
          SUM(CASE WHEN vote_type = 'down' THEN 1 ELSE 0 END) as downCount
         FROM review_votes WHERE review_id = ?`,
        [reviewId],
        (err, votes) => {
          // 댓글수 조회
          db.get(`SELECT COUNT(*) as count FROM comments WHERE review_id = ?`, [reviewId], (err, commentCount) => {
            // 익명 처리
            const authorName = review.isAnonymous ? '익명' : (review.nickname || '알 수 없음');
            const authorImage = review.isAnonymous ? '' : (review.profileImage || '');
            
            res.json({
              ...review,
              author: authorName,
              profileImage: authorImage,
              upCount: votes?.upCount || 0,
              downCount: votes?.downCount || 0,
              commentCount: commentCount?.count || 0
            });
          });
        }
      );
    }
  );
});

// 기존 호환성 유지: GET /api/anime/:id/review (단일 리뷰 - deprecated)
app.get('/api/anime/:id/review', (req, res) => {
  res.redirect(`/api/anime/${req.params.id}/reviews`);
});

// GET /api/anime/:id/check-user-review - 유저가 이 애니에 리뷰를 썼는지 확인
app.get('/api/anime/:id/check-user-review', (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  if (!userId) return res.json({ hasReview: false });
  
  db.get(`SELECT id FROM reviews WHERE anime_id = ? AND user_id = ?`, [id, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ hasReview: !!row, reviewId: row?.id });
  });
});

// GET /api/parent-anime - 부모 애니 목록
app.get('/api/parent-anime', (req, res) => {
  db.all(`SELECT id, title FROM parent_anime ORDER BY title`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// POST /api/parent-anime - 부모 애니 추가
app.post('/api/parent-anime', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title 필수' });
  
  db.run(`INSERT INTO parent_anime (title) VALUES (?)`, [title], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: '이미 존재하는 시리즈입니다' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, title });
  });
});

// POST /api/reviews - 리뷰 작성 (유저당 애니당 1개)
app.post('/api/reviews', (req, res) => {
  const { animeId, animeTitle, animeCoverImage, parentId, tier, rating, oneLiner, content, categories, userId, isAnonymous } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: '로그인이 필요합니다' });
  }
  
  if (!tier || rating === undefined) {
    return res.status(400).json({ error: 'tier, rating 필수' });
  }
  
  const insertReview = (animeIdToUse) => {
    // 이 유저가 이 애니에 이미 리뷰를 작성했는지 확인
    db.get(`SELECT id FROM reviews WHERE anime_id = ? AND user_id = ?`, [animeIdToUse, userId], (err, existing) => {
      if (existing) {
        return res.status(400).json({ error: '이미 이 애니에 리뷰를 작성하셨습니다' });
      }
      
      db.run(
        `INSERT INTO reviews (anime_id, user_id, is_anonymous, tier, rating, one_liner, content) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [animeIdToUse, userId, isAnonymous ? 1 : 0, tier, rating, oneLiner || '', content || ''],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return res.status(400).json({ error: '이미 이 애니에 리뷰를 작성하셨습니다' });
            }
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json({ id: this.lastID, animeId: animeIdToUse });
        }
      );
    });
  };
  
  if (animeId) {
    insertReview(animeId);
  } else if (animeTitle) {
    db.run(
      `INSERT INTO anime (title, cover_image, parent_id) VALUES (?, ?, ?)`,
      [animeTitle, animeCoverImage || '', parentId || null],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const newAnimeId = this.lastID;
        
        if (categories && categories.length > 0) {
          categories.forEach(catName => {
            db.get(`SELECT id FROM categories WHERE name = ?`, [catName], (err, row) => {
              if (row) {
                db.run(`INSERT OR IGNORE INTO anime_categories (anime_id, category_id) VALUES (?, ?)`, [newAnimeId, row.id]);
              }
            });
          });
        }
        
        insertReview(newAnimeId);
      }
    );
  } else {
    return res.status(400).json({ error: 'animeId 또는 animeTitle 필수' });
  }
});

// POST /api/reviews/:id/vote - 리뷰 추천/비추
app.post('/api/reviews/:id/vote', (req, res) => {
  const { id } = req.params;
  const { userId, voteType } = req.body;
  
  if (!userId) return res.status(401).json({ error: '로그인 필요' });
  if (!['up', 'down'].includes(voteType)) return res.status(400).json({ error: 'Invalid vote type' });
  
  // 기존 투표 확인
  db.get(`SELECT id, vote_type FROM review_votes WHERE review_id = ? AND user_id = ?`, [id, userId], (err, existing) => {
    if (existing) {
      if (existing.vote_type === voteType) {
        // 같은 투표 취소
        db.run(`DELETE FROM review_votes WHERE id = ?`, [existing.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: '투표 취소' });
        });
      } else {
        // 다른 투표로 변경
        db.run(`UPDATE review_votes SET vote_type = ? WHERE id = ?`, [voteType, existing.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: '투표 변경' });
        });
      }
    } else {
      // 새 투표
      db.run(`INSERT INTO review_votes (review_id, user_id, vote_type) VALUES (?, ?, ?)`, [id, userId, voteType], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: '투표 완료' });
      });
    }
  });
});

// GET /api/reviews/:id/user-vote - 유저의 투표 상태 확인
app.get('/api/reviews/:id/user-vote', (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  if (!userId) return res.json({ vote: null });
  
  db.get(`SELECT vote_type FROM review_votes WHERE review_id = ? AND user_id = ?`, [id, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ vote: row?.vote_type || null });
  });
});

// GET /api/user-votes - 유저의 여러 리뷰 투표 상태 일괄 조회
app.get('/api/user-votes', (req, res) => {
  const { userId, reviewIds } = req.query;
  
  if (!userId || !reviewIds) return res.json({});
  
  const ids = reviewIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
  if (ids.length === 0) return res.json({});
  
  const placeholders = ids.map(() => '?').join(',');
  db.all(
    `SELECT review_id, vote_type FROM review_votes WHERE user_id = ? AND review_id IN (${placeholders})`,
    [userId, ...ids],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const votes = {};
      rows.forEach(r => {
        votes[r.review_id] = r.vote_type;
      });
      res.json(votes);
    }
  );
});

// PUT /api/reviews/:id - 리뷰 수정
app.put('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  const { userId, tier, rating, oneLiner, content } = req.body;

  if (!userId) return res.status(401).json({ error: '로그인 필요' });

  // 리뷰 소유자 확인
  db.get(`SELECT user_id FROM reviews WHERE id = ?`, [id], (err, review) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!review) return res.status(404).json({ error: '리뷰를 찾을 수 없습니다' });
    if (review.user_id !== userId) return res.status(403).json({ error: '수정 권한이 없습니다' });

    db.run(
      `UPDATE reviews SET tier = ?, rating = ?, one_liner = ?, content = ? WHERE id = ?`,
      [tier, rating, oneLiner || '', content || '', id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: '수정 완료' });
      }
    );
  });
});

// DELETE /api/reviews/:id - 리뷰 삭제
app.delete('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  if (!userId) return res.status(401).json({ error: '로그인 필요' });
  
  // 리뷰 소유자 확인
  db.get(`SELECT user_id FROM reviews WHERE id = ?`, [id], (err, review) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!review) return res.status(404).json({ error: '리뷰를 찾을 수 없습니다' });
    if (review.user_id !== userId) return res.status(403).json({ error: '삭제 권한이 없습니다' });
    
    // 관련 데이터 삭제 (댓글, 투표 등)
    db.run(`DELETE FROM comments WHERE review_id = ?`, [id]);
    db.run(`DELETE FROM review_votes WHERE review_id = ?`, [id]);
    db.run(`DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM comments WHERE review_id = ?)`, [id]);
    
    db.run(`DELETE FROM reviews WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '삭제 완료' });
    });
  });
});

// ============================================
// 댓글 API
// ============================================

// GET /api/reviews/:id/comments - 댓글 목록
app.get('/api/reviews/:id/comments', (req, res) => {
  const { id } = req.params;
  const { sort, order } = req.query; // sort: popular/recent, order: asc/desc
  
  // 먼저 리뷰 정보 가져오기 (작성자, 익명여부)
  db.get(`SELECT user_id, is_anonymous FROM reviews WHERE id = ?`, [id], (err, review) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // 정렬 기준 결정
    // 부모 댓글은 정렬 기준대로, 답글은 부모 아래에 시간순으로
    let parentOrder = 'c.created_at DESC';
    if (sort === 'popular') {
      parentOrder = 'voteCount DESC, c.created_at DESC';
    } else if (sort === 'recent') {
      parentOrder = order === 'asc' ? 'c.created_at ASC' : 'c.created_at DESC';
    }
    
    db.all(
      `SELECT c.id, c.review_id as reviewId, c.user_id as odriginUserId, c.parent_id as parentId, 
              c.anon_number as anonNumber, c.is_anonymous as isAnonymous, c.content, c.tier_request as tierRequest,
              c.created_at as createdAt, u.nickname, u.profile_image as profileImage,
              (SELECT COUNT(*) FROM comment_votes cv WHERE cv.comment_id = c.id) as voteCount
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.review_id = ?`,
      [id],
      (err, comments) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // 부모/자식 분리
        const parents = comments.filter(c => !c.parentId);
        const children = comments.filter(c => c.parentId);
        
        // 부모 정렬
        parents.sort((a, b) => {
          if (sort === 'popular') {
            return (b.voteCount - a.voteCount) || new Date(b.createdAt) - new Date(a.createdAt);
          } else {
            // recent
            const diff = new Date(b.createdAt) - new Date(a.createdAt);
            return order === 'asc' ? -diff : diff;
          }
        });
        
        // 자식은 항상 시간순 (오래된 것부터)
        children.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // 부모 아래에 자식 배치
        const result = [];
        parents.forEach(parent => {
          result.push(parent);
          children.filter(c => c.parentId === parent.id).forEach(child => {
            result.push(child);
          });
        });
        
        // 포맷팅
        const formatted = result.map(c => {
          const isReviewAuthor = review && c.odriginUserId === review.user_id;
          let authorName;
          
          if (c.isAnonymous) {
            authorName = isReviewAuthor ? `익명${c.anonNumber}(작성자)` : `익명${c.anonNumber}`;
          } else {
            authorName = isReviewAuthor ? `${c.nickname || '알 수 없음'}(작성자)` : (c.nickname || '알 수 없음');
          }
          
          return {
            ...c,
            userId: c.odriginUserId,
            author: authorName,
            profileImage: c.isAnonymous ? '' : (c.profileImage || ''),
            isReviewAuthor
          };
        });
        
        res.json(formatted);
      }
    );
  });
});

// POST /api/reviews/:id/comments - 댓글 작성
app.post('/api/reviews/:id/comments', (req, res) => {
  const { id } = req.params;
  const { userId, parentId, isAnonymous, content, tierRequest } = req.body;
  
  if (!userId) return res.status(401).json({ error: '로그인 필요' });
  if (!content) return res.status(400).json({ error: '댓글 내용 필수' });
  
  // 1. 리뷰 작성자인지 확인하고, 리뷰의 익명 여부 확인
  db.get(`SELECT user_id, is_anonymous FROM reviews WHERE id = ?`, [id], (err, review) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!review) return res.status(404).json({ error: '리뷰를 찾을 수 없습니다' });
    
    const isReviewAuthor = review.user_id === userId;
    
    // 2. 익명 강제 여부 결정
    const determineAnonymous = (callback) => {
      // 리뷰 작성자인 경우: 리뷰의 익명 상태를 따름
      if (isReviewAuthor) {
        callback(review.is_anonymous === 1);
        return;
      }
      
      // 리뷰 작성자가 아닌 경우: 이 리뷰에서 첫 댓글의 익명 상태를 따름
      db.get(
        `SELECT is_anonymous FROM comments WHERE review_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 1`,
        [id, userId],
        (err, existingComment) => {
          if (existingComment) {
            // 기존 댓글이 있으면 그 상태를 따름
            callback(existingComment.is_anonymous === 1);
          } else {
            // 첫 댓글이면 요청한 대로
            callback(isAnonymous);
          }
        }
      );
    };
    
    // 3. 익명 번호 계산
    const getAnonNumber = (forcedAnonymous, callback) => {
      if (!forcedAnonymous) return callback(null);
      
      // 이 유저가 이 리뷰에서 이미 익명으로 댓글을 달았는지 확인
      db.get(
        `SELECT anon_number FROM comments WHERE review_id = ? AND user_id = ? AND is_anonymous = 1 LIMIT 1`,
        [id, userId],
        (err, existing) => {
          if (existing) {
            callback(existing.anon_number);
          } else {
            // 새 익명 번호 할당
            db.get(
              `SELECT MAX(anon_number) as maxAnon FROM comments WHERE review_id = ? AND is_anonymous = 1`,
              [id],
              (err, row) => {
                callback((row?.maxAnon || 0) + 1);
              }
            );
          }
        }
      );
    };
    
    // 4. 답글인 경우 부모의 부모를 찾아서 최상위 부모로 설정 (1단계 답글만 허용)
    const getActualParentId = (callback) => {
      if (!parentId) return callback(null);
      
      db.get(`SELECT parent_id FROM comments WHERE id = ?`, [parentId], (err, parent) => {
        if (parent && parent.parent_id) {
          // 부모가 이미 답글이면 부모의 부모를 사용
          callback(parent.parent_id);
        } else {
          callback(parentId);
        }
      });
    };
    
    // 실행
    determineAnonymous((forcedAnonymous) => {
      getActualParentId((actualParentId) => {
        getAnonNumber(forcedAnonymous, (anonNumber) => {
          db.run(
            `INSERT INTO comments (review_id, user_id, parent_id, anon_number, is_anonymous, content, tier_request) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, userId, actualParentId, anonNumber, forcedAnonymous ? 1 : 0, content, tierRequest || null],
            function(err) {
              if (err) return res.status(500).json({ error: err.message });
              res.status(201).json({ 
                id: this.lastID, 
                anonNumber,
                isAnonymous: forcedAnonymous,
                isReviewAuthor
              });
            }
          );
        });
      });
    });
  });
});

// GET /api/reviews/:id/user-anon-status - 유저의 익명 강제 상태 확인
app.get('/api/reviews/:id/user-anon-status', (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  if (!userId) return res.json({ forced: false, isAnonymous: false, isReviewAuthor: false });
  
  // 리뷰 정보
  db.get(`SELECT user_id, is_anonymous FROM reviews WHERE id = ?`, [id], (err, review) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!review) return res.status(404).json({ error: '리뷰를 찾을 수 없습니다' });
    
    const isReviewAuthor = review.user_id === parseInt(userId);
    
    // 리뷰 작성자인 경우
    if (isReviewAuthor) {
      return res.json({
        forced: true,
        isAnonymous: review.is_anonymous === 1,
        isReviewAuthor: true,
        reason: '리뷰 작성자는 리뷰와 동일한 익명 상태를 유지해야 합니다'
      });
    }
    
    // 기존 댓글 확인
    db.get(
      `SELECT is_anonymous FROM comments WHERE review_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 1`,
      [id, userId],
      (err, existingComment) => {
        if (existingComment) {
          return res.json({
            forced: true,
            isAnonymous: existingComment.is_anonymous === 1,
            isReviewAuthor: false,
            reason: '이 리뷰에서 이미 작성한 댓글과 동일한 익명 상태를 유지해야 합니다'
          });
        }
        
        // 첫 댓글
        res.json({
          forced: false,
          isAnonymous: false,
          isReviewAuthor: false
        });
      }
    );
  });
});

// POST /api/comments/:id/vote - 댓글 추천
app.post('/api/comments/:id/vote', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  if (!userId) return res.status(401).json({ error: '로그인 필요' });
  
  db.get(`SELECT id FROM comment_votes WHERE comment_id = ? AND user_id = ?`, [id, userId], (err, existing) => {
    if (existing) {
      // 이미 추천함 -> 취소
      db.run(`DELETE FROM comment_votes WHERE id = ?`, [existing.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: '추천 취소' });
      });
    } else {
      // 새 추천
      db.run(`INSERT INTO comment_votes (comment_id, user_id) VALUES (?, ?)`, [id, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: '추천 완료' });
      });
    }
  });
});

// DELETE /api/comments/:id - 댓글 삭제
app.delete('/api/comments/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  if (!userId) return res.status(401).json({ error: '로그인 필요' });
  
  // 댓글 소유자 확인
  db.get(`SELECT user_id, parent_id FROM comments WHERE id = ?`, [id], (err, comment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!comment) return res.status(404).json({ error: '댓글을 찾을 수 없습니다' });
    if (comment.user_id !== userId) return res.status(403).json({ error: '삭제 권한이 없습니다' });
    
    // 답글들도 함께 삭제
    db.run(`DELETE FROM comment_votes WHERE comment_id = ?`, [id]);
    db.run(`DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM comments WHERE parent_id = ?)`, [id]);
    db.run(`DELETE FROM comments WHERE parent_id = ?`, [id]); // 답글 삭제
    
    db.run(`DELETE FROM comments WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '삭제 완료' });
    });
  });
});

// GET /api/anime-list - 애니 목록 (선택용, 유저별 리뷰 여부 포함)
app.get('/api/anime-list', (req, res) => {
  db.all(
    `SELECT a.id, a.title FROM anime a ORDER BY a.title`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 각 애니에 리뷰 작성한 유저 ID 목록 가져오기
      db.all(
        `SELECT anime_id, user_id FROM reviews`,
        [],
        (err, reviews) => {
          if (err) return res.status(500).json({ error: err.message });
          
          const reviewMap = {};
          reviews.forEach(r => {
            if (!reviewMap[r.anime_id]) reviewMap[r.anime_id] = [];
            reviewMap[r.anime_id].push(r.user_id);
          });
          
          res.json(rows.map(a => ({ 
            ...a, 
            userReviewedIds: reviewMap[a.id] || []
          })));
        }
      );
    }
  );
});

// ============================================
// 관리자 API
// ============================================

// 관리자 권한 확인 미들웨어
function checkAdmin(req, res, next) {
  const userId = req.body.adminUserId || req.query.adminUserId;
  if (!userId) return res.status(401).json({ error: '로그인 필요' });
  
  db.get(`SELECT is_admin FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row || !row.is_admin) return res.status(403).json({ error: '관리자 권한 필요' });
    next();
  });
}

// GET /api/admin/stats - 관리자 대시보드 통계
app.get('/api/admin/stats', (req, res) => {
  const stats = {};
  
  db.get(`SELECT COUNT(*) as count FROM users`, [], (err, row) => {
    stats.userCount = row?.count || 0;
    
    db.get(`SELECT COUNT(*) as count FROM anime`, [], (err, row) => {
      stats.animeCount = row?.count || 0;
      
      db.get(`SELECT COUNT(*) as count FROM reviews`, [], (err, row) => {
        stats.reviewCount = row?.count || 0;
        
        db.get(`SELECT COUNT(*) as count FROM comments`, [], (err, row) => {
          stats.commentCount = row?.count || 0;
          res.json(stats);
        });
      });
    });
  });
});

// GET /api/admin/users - 유저 목록
app.get('/api/admin/users', checkAdmin, (req, res) => {
  db.all(
    `SELECT u.id, u.username, u.nickname, u.profile_image as profileImage, u.is_admin as isAdmin, u.created_at as createdAt,
            (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id) as reviewCount,
            (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) as commentCount
     FROM users u
     ORDER BY u.id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// PUT /api/admin/users/:id - 유저 수정 (관리자 권한 부여/해제)
app.put('/api/admin/users/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  const { nickname, isAdmin } = req.body;
  
  const updates = [];
  const params = [];
  
  if (nickname !== undefined) { updates.push('nickname = ?'); params.push(nickname); }
  if (isAdmin !== undefined) { updates.push('is_admin = ?'); params.push(isAdmin ? 1 : 0); }
  
  if (updates.length === 0) return res.status(400).json({ error: '수정할 내용 없음' });
  
  params.push(id);
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: '수정 완료' });
  });
});

// DELETE /api/admin/users/:id - 유저 삭제
app.delete('/api/admin/users/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM users WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: '삭제 완료' });
  });
});

// GET /api/admin/anime - 애니 목록
app.get('/api/admin/anime', checkAdmin, (req, res) => {
  db.all(
    `SELECT a.id, a.title, a.cover_image as coverImage, a.parent_id as parentId, a.created_at as createdAt,
            p.title as parentTitle,
            (SELECT COUNT(*) FROM reviews r WHERE r.anime_id = a.id) as reviewCount
     FROM anime a
     LEFT JOIN parent_anime p ON a.parent_id = p.id
     ORDER BY a.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 각 애니의 카테고리 ID 가져오기
      const animeIds = rows.map(r => r.id);
      if (animeIds.length === 0) return res.json([]);
      
      const placeholders = animeIds.map(() => '?').join(',');
      db.all(
        `SELECT anime_id, category_id FROM anime_categories WHERE anime_id IN (${placeholders})`,
        animeIds,
        (err, catRows) => {
          if (err) return res.json(rows);
          
          // 카테고리 매핑
          const catMap = {};
          catRows.forEach(c => {
            if (!catMap[c.anime_id]) catMap[c.anime_id] = [];
            catMap[c.anime_id].push(c.category_id);
          });
          
          rows.forEach(r => {
            r.categoryIds = catMap[r.id] || [];
          });
          
          res.json(rows);
        }
      );
    }
  );
});

// POST /api/admin/anime - 애니 추가
app.post('/api/admin/anime', checkAdmin, (req, res) => {
  const { title, coverImage, parentId, categories } = req.body;
  
  if (!title) return res.status(400).json({ error: '제목 필수' });
  
  db.run(
    `INSERT INTO anime (title, cover_image, parent_id) VALUES (?, ?, ?)`,
    [title, coverImage || '', parentId || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const animeId = this.lastID;
      
      // 카테고리 연결
      if (categories && categories.length > 0) {
        categories.forEach(catId => {
          db.run(`INSERT INTO anime_categories (anime_id, category_id) VALUES (?, ?)`, [animeId, catId]);
        });
      }
      
      res.status(201).json({ id: animeId, message: '추가 완료' });
    }
  );
});

// PUT /api/admin/anime/:id - 애니 수정
app.put('/api/admin/anime/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  const { title, coverImage, parentId, categories } = req.body;
  
  const updates = [];
  const params = [];
  
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (coverImage !== undefined) { updates.push('cover_image = ?'); params.push(coverImage); }
  if (parentId !== undefined) { updates.push('parent_id = ?'); params.push(parentId || null); }
  
  if (updates.length > 0) {
    params.push(id);
    db.run(`UPDATE anime SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  
  // 카테고리 업데이트
  if (categories !== undefined) {
    db.run(`DELETE FROM anime_categories WHERE anime_id = ?`, [id], () => {
      categories.forEach(catId => {
        db.run(`INSERT INTO anime_categories (anime_id, category_id) VALUES (?, ?)`, [id, catId]);
      });
    });
  }
  
  res.json({ message: '수정 완료' });
});

// DELETE /api/admin/anime/:id - 애니 삭제
app.delete('/api/admin/anime/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM anime WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: '삭제 완료' });
  });
});

// GET /api/admin/series - 시리즈(부모 애니) 목록
app.get('/api/admin/series', checkAdmin, (req, res) => {
  db.all(
    `SELECT p.id, p.title, p.created_at as createdAt,
            (SELECT COUNT(*) FROM anime a WHERE a.parent_id = p.id) as animeCount
     FROM parent_anime p
     ORDER BY p.title`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 각 시리즈의 애니 ID 목록 가져오기
      const seriesIds = rows.map(r => r.id);
      if (seriesIds.length === 0) return res.json([]);
      
      db.all(
        `SELECT id, title, parent_id FROM anime WHERE parent_id IS NOT NULL`,
        [],
        (err, animeRows) => {
          if (err) return res.json(rows);
          
          const animeMap = {};
          animeRows.forEach(a => {
            if (!animeMap[a.parent_id]) animeMap[a.parent_id] = [];
            animeMap[a.parent_id].push({ id: a.id, title: a.title });
          });
          
          rows.forEach(r => {
            r.animes = animeMap[r.id] || [];
          });
          
          res.json(rows);
        }
      );
    }
  );
});

// POST /api/admin/series - 시리즈 추가
app.post('/api/admin/series', checkAdmin, (req, res) => {
  const { title } = req.body;
  
  if (!title) return res.status(400).json({ error: '제목 필수' });
  
  db.run(`INSERT INTO parent_anime (title) VALUES (?)`, [title], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: '이미 존재하는 시리즈입니다' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, message: '추가 완료' });
  });
});

// PUT /api/admin/series/:id - 시리즈 수정
app.put('/api/admin/series/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  const { title, animeIds } = req.body;
  
  if (!title) return res.status(400).json({ error: '제목 필수' });
  
  db.run(`UPDATE parent_anime SET title = ? WHERE id = ?`, [title, id], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: '이미 존재하는 시리즈입니다' });
      }
      return res.status(500).json({ error: err.message });
    }
    
    // 애니 연결 업데이트
    if (animeIds !== undefined) {
      // 기존 연결 해제
      db.run(`UPDATE anime SET parent_id = NULL WHERE parent_id = ?`, [id], () => {
        // 새로운 연결
        if (animeIds && animeIds.length > 0) {
          const placeholders = animeIds.map(() => '?').join(',');
          db.run(`UPDATE anime SET parent_id = ? WHERE id IN (${placeholders})`, [id, ...animeIds]);
        }
      });
    }
    
    res.json({ message: '수정 완료' });
  });
});

// DELETE /api/admin/series/:id - 시리즈 삭제
app.delete('/api/admin/series/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  
  // 시리즈 삭제 시 연결된 애니의 parent_id를 NULL로
  db.run(`UPDATE anime SET parent_id = NULL WHERE parent_id = ?`, [id], () => {
    db.run(`DELETE FROM parent_anime WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '삭제 완료' });
    });
  });
});

// GET /api/admin/categories - 카테고리 목록 (연결된 애니 포함)
app.get('/api/admin/categories', checkAdmin, (req, res) => {
  db.all(
    `SELECT c.id, c.name, c.icon, c.sort_order as sortOrder,
            (SELECT COUNT(*) FROM anime_categories ac WHERE ac.category_id = c.id) as animeCount
     FROM categories c
     ORDER BY c.sort_order`,
    [],
    (err, categories) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (categories.length === 0) return res.json([]);
      
      // 각 카테고리별 연결된 애니 조회
      const catIds = categories.map(c => c.id);
      const placeholders = catIds.map(() => '?').join(',');
      
      db.all(
        `SELECT ac.category_id, a.id, a.title
         FROM anime_categories ac
         JOIN anime a ON ac.anime_id = a.id
         WHERE ac.category_id IN (${placeholders})
         ORDER BY a.title`,
        catIds,
        (err, animeRows) => {
          if (err) return res.json(categories);
          
          const animeMap = {};
          animeRows.forEach(row => {
            if (!animeMap[row.category_id]) animeMap[row.category_id] = [];
            animeMap[row.category_id].push({ id: row.id, title: row.title });
          });
          
          const result = categories.map(c => ({
            ...c,
            animes: animeMap[c.id] || []
          }));
          
          res.json(result);
        }
      );
    }
  );
});

// POST /api/admin/categories - 카테고리 추가
app.post('/api/admin/categories', checkAdmin, (req, res) => {
  const { name, icon, sortOrder, animeIds } = req.body;
  
  if (!name) return res.status(400).json({ error: '이름 필수' });
  
  db.run(`INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)`, 
    [name, icon || '📁', sortOrder || 0], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: '이미 존재하는 카테고리입니다' });
      }
      return res.status(500).json({ error: err.message });
    }
    
    const catId = this.lastID;
    
    // 애니 연결
    if (animeIds && animeIds.length > 0) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO anime_categories (anime_id, category_id) VALUES (?, ?)`);
      animeIds.forEach(animeId => stmt.run(animeId, catId));
      stmt.finalize();
    }
    
    res.status(201).json({ id: catId, message: '추가 완료' });
  });
});

// PUT /api/admin/categories/:id - 카테고리 수정 (애니 연결 포함)
app.put('/api/admin/categories/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  const { name, icon, sortOrder, animeIds } = req.body;
  
  const updates = [];
  const params = [];
  
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
  if (sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(sortOrder); }
  
  const doUpdate = () => {
    if (updates.length > 0) {
      params.push(id);
      db.run(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: '수정 완료' });
      });
    } else {
      res.json({ message: '수정 완료' });
    }
  };
  
  // 애니 연결 업데이트
  if (animeIds !== undefined) {
    db.run(`DELETE FROM anime_categories WHERE category_id = ?`, [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (animeIds.length > 0) {
        const stmt = db.prepare(`INSERT INTO anime_categories (anime_id, category_id) VALUES (?, ?)`);
        animeIds.forEach(animeId => stmt.run(animeId, id));
        stmt.finalize(() => doUpdate());
      } else {
        doUpdate();
      }
    });
  } else {
    doUpdate();
  }
});

// DELETE /api/admin/categories/:id - 카테고리 삭제
app.delete('/api/admin/categories/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM categories WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: '삭제 완료' });
  });
});

// GET /api/admin/reviews - 리뷰 목록
app.get('/api/admin/reviews', checkAdmin, (req, res) => {
  db.all(
    `SELECT r.id, r.anime_id as animeId, r.user_id as userId, r.tier, r.rating, r.one_liner as oneLiner,
            r.view_count as viewCount, r.created_at as createdAt,
            a.title as animeTitle,
            u.nickname as authorName,
            (SELECT COUNT(*) FROM comments c WHERE c.review_id = r.id) as commentCount
     FROM reviews r
     LEFT JOIN anime a ON r.anime_id = a.id
     LEFT JOIN users u ON r.user_id = u.id
     ORDER BY r.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// DELETE /api/admin/reviews/:id - 리뷰 삭제 (관리자)
app.delete('/api/admin/reviews/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM comments WHERE review_id = ?`, [id]);
  db.run(`DELETE FROM review_votes WHERE review_id = ?`, [id]);
  
  db.run(`DELETE FROM reviews WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: '삭제 완료' });
  });
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 AniLog 서버 시작!`);
  console.log(`   로컬: http://localhost:${PORT}`);
  console.log(`   네트워크: http://${getLocalIP()}:${PORT}`);
});

// 로컬 IP 가져오기
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}