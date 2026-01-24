/**
 * AniLog Backend Server
 */

const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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
    `SELECT id, username, nickname, profile_image as profileImage FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다' });
      
      res.json({ user: row });
    }
  );
});

// PUT /api/users/:id - 프로필 수정
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { nickname, profileImage, currentPassword, newPassword } = req.body;
  
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
        [nickname, profileImage || '', newPassword, id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: '수정 완료' });
        }
      );
    });
  } else {
    db.run(
      `UPDATE users SET nickname = ?, profile_image = ? WHERE id = ?`,
      [nickname, profileImage || '', id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: '수정 완료' });
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
          
          // 리뷰 조회 (랜덤 한줄평용)
          db.all(
            `SELECT anime_id, author, tier, rating, one_liner FROM reviews WHERE anime_id IN (${placeholders})`,
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
                
                return {
                  id: a.id,
                  title: a.title,
                  coverImage: a.coverImage,
                  tier: topTier,
                  rating: a.avgRating ? Math.round(a.avgRating * 10) / 10 : 0,
                  reviewCount: a.reviewCount,
                  oneLiner: randomReview?.one_liner || '',
                  reviewer: randomReview?.author || '',
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
// Featured API (상단 카드)
// ============================================

// GET /api/featured - 상단 카드용 (3개)
app.get('/api/featured', (req, res) => {
  db.all(
    `SELECT 
      a.id, a.title, a.cover_image as coverImage,
      AVG(r.rating) as avgRating
    FROM featured f
    JOIN anime a ON f.anime_id = a.id
    LEFT JOIN reviews r ON a.id = r.anime_id
    GROUP BY a.id
    ORDER BY f.sort_order
    LIMIT 3`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const animeIds = rows.map(r => r.id);
      if (animeIds.length === 0) return res.json([]);
      
      const placeholders = animeIds.map(() => '?').join(',');
      db.all(
        `SELECT anime_id, author, tier, rating, one_liner FROM reviews WHERE anime_id IN (${placeholders})`,
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
            const topTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'A';
            
            return {
              id: a.id,
              title: a.title,
              coverImage: a.coverImage,
              tier: topTier,
              rating: a.avgRating ? Math.round(a.avgRating * 10) / 10 : 0,
              oneLiner: randomReview?.one_liner || '',
              reviewer: randomReview?.author || ''
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
            `SELECT anime_id, author, tier, rating, one_liner FROM reviews WHERE anime_id IN (${placeholders})`,
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
                
                return {
                  id: a.id,
                  title: a.title,
                  coverImage: a.coverImage,
                  tier: topTier,
                  rating: a.avgRating ? Math.round(a.avgRating * 10) / 10 : 0,
                  oneLiner: randomReview?.one_liner || '',
                  reviewer: randomReview?.author || ''
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

// GET /api/anime/:id/review - 애니 리뷰 상세 (조회수 증가 포함)
app.get('/api/anime/:id/review', (req, res) => {
  const { id } = req.params;
  
  // 조회수 증가
  db.run(`UPDATE reviews SET view_count = view_count + 1 WHERE anime_id = ?`, [id]);
  
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
      
      // 관련 애니 조회 (같은 부모의 다른 자식들)
      const fetchRelatedAnime = (callback) => {
        if (!anime.parentId) {
          callback([]);
          return;
        }
        
        db.all(
          `SELECT a.id, a.title, a.cover_image as coverImage,
                  r.tier, r.rating, r.one_liner as oneLiner
           FROM anime a
           LEFT JOIN reviews r ON a.id = r.anime_id
           WHERE a.parent_id = ? AND a.id != ?
           ORDER BY a.id`,
          [anime.parentId, id],
          (err, rows) => {
            callback(rows || []);
          }
        );
      };
      
      fetchRelatedAnime((relatedAnime) => {
        db.get(
          `SELECT r.id, r.anime_id as animeId, r.user_id as userId, r.is_anonymous as isAnonymous,
                  r.tier, r.rating, r.one_liner as oneLiner, r.content, 
                  r.view_count as viewCount, r.created_at as createdAt,
                  u.nickname, u.profile_image as profileImage
           FROM reviews r
           LEFT JOIN users u ON r.user_id = u.id
           WHERE r.anime_id = ?`,
          [id],
          (err, review) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (!review) {
              return res.json({ ...anime, review: null, relatedAnime });
            }
            
            // 추천수 조회
            db.get(
              `SELECT 
                SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE 0 END) as upCount,
                SUM(CASE WHEN vote_type = 'down' THEN 1 ELSE 0 END) as downCount
               FROM review_votes WHERE review_id = ?`,
              [review.id],
              (err, votes) => {
                // 댓글수 조회
                db.get(`SELECT COUNT(*) as count FROM comments WHERE review_id = ?`, [review.id], (err, commentCount) => {
                  // 익명 처리
                  const authorName = review.isAnonymous ? '익명' : (review.nickname || '익명');
                  const authorImage = review.isAnonymous ? '' : (review.profileImage || '');
                  
                  res.json({
                    ...anime,
                    relatedAnime,
                    review: {
                      ...review,
                      author: authorName,
                      profileImage: authorImage,
                      upCount: votes?.upCount || 0,
                      downCount: votes?.downCount || 0,
                      commentCount: commentCount?.count || 0
                    }
                  });
                });
              }
            );
          }
        );
      });
    }
  );
});

// GET /api/reviews/:id/check-has-review - 리뷰 존재 여부 체크
app.get('/api/anime/:id/check-review', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT id FROM reviews WHERE anime_id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ hasReview: !!row });
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

// POST /api/reviews - 리뷰 작성 (로그인 필수, 익명 옵션)
app.post('/api/reviews', (req, res) => {
  const { animeId, animeTitle, animeCoverImage, parentId, tier, rating, oneLiner, content, categories, userId, isAnonymous } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: '로그인이 필요합니다' });
  }
  
  if (!tier || rating === undefined) {
    return res.status(400).json({ error: 'tier, rating 필수' });
  }
  
  const insertReview = (animeIdToUse) => {
    // 이미 리뷰가 있는지 확인
    db.get(`SELECT id FROM reviews WHERE anime_id = ?`, [animeIdToUse], (err, existing) => {
      if (existing) {
        return res.status(400).json({ error: '이미 리뷰가 존재하는 애니입니다' });
      }
      
      db.run(
        `INSERT INTO reviews (anime_id, user_id, is_anonymous, tier, rating, one_liner, content) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [animeIdToUse, userId, isAnonymous ? 1 : 0, tier, rating, oneLiner || '', content || ''],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return res.status(400).json({ error: '이미 리뷰가 존재하는 애니입니다' });
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

// ============================================
// 댓글 API
// ============================================

// GET /api/reviews/:id/comments - 댓글 목록
app.get('/api/reviews/:id/comments', (req, res) => {
  const { id } = req.params;
  const { sort, order } = req.query; // sort: popular/recent, order: asc/desc
  
  let orderBy = 'c.created_at DESC';
  if (sort === 'popular') {
    orderBy = 'voteCount DESC, c.created_at DESC';
  } else if (sort === 'recent' && order === 'asc') {
    orderBy = 'c.created_at ASC';
  }
  
  db.all(
    `SELECT c.id, c.review_id as reviewId, c.user_id as odriginUserId, c.parent_id as parentId, 
            c.anon_number as anonNumber, c.is_anonymous as isAnonymous, c.content, c.tier_request as tierRequest,
            c.created_at as createdAt, u.nickname, u.profile_image as profileImage,
            (SELECT COUNT(*) FROM comment_votes cv WHERE cv.comment_id = c.id) as voteCount
     FROM comments c
     LEFT JOIN users u ON c.user_id = u.id
     WHERE c.review_id = ?
     ORDER BY ${sort === 'popular' ? orderBy : 'COALESCE(c.parent_id, c.id), c.parent_id IS NOT NULL, c.created_at'}`,
    [id],
    (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // 댓글 정리 (부모-자식 구조)
      const formatted = comments.map(c => ({
        ...c,
        author: c.isAnonymous ? `익명${c.anonNumber}` : (c.nickname || '알 수 없음'),
        profileImage: c.isAnonymous ? '' : (c.profileImage || '')
      }));
      
      res.json(formatted);
    }
  );
});

// POST /api/reviews/:id/comments - 댓글 작성
app.post('/api/reviews/:id/comments', (req, res) => {
  const { id } = req.params;
  const { userId, parentId, isAnonymous, content, tierRequest } = req.body;
  
  if (!userId) return res.status(401).json({ error: '로그인 필요' });
  if (!content) return res.status(400).json({ error: '댓글 내용 필수' });
  
  // 익명 번호 계산
  const getAnonNumber = (callback) => {
    if (!isAnonymous) return callback(null);
    
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
  
  // 답글인 경우 부모의 부모를 찾아서 최상위 부모로 설정 (1단계 답글만 허용)
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
  
  getActualParentId((actualParentId) => {
    getAnonNumber((anonNumber) => {
      db.run(
        `INSERT INTO comments (review_id, user_id, parent_id, anon_number, is_anonymous, content, tier_request) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, actualParentId, anonNumber, isAnonymous ? 1 : 0, content, tierRequest || null],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ id: this.lastID, anonNumber });
        }
      );
    });
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

// DELETE /api/reviews/:id - 리뷰 삭제 (비번 확인)
app.delete('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  
  db.get(`SELECT password FROM reviews WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Review not found' });
    
    if (row.password && row.password !== password) {
      return res.status(403).json({ error: '비밀번호가 일치하지 않습니다' });
    }
    
    db.run(`DELETE FROM reviews WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '삭제 완료' });
    });
  });
});

// GET /api/anime-list - 애니 목록 (선택용, 리뷰 여부 포함)
app.get('/api/anime-list', (req, res) => {
  db.all(
    `SELECT a.id, a.title, 
            (SELECT COUNT(*) FROM reviews r WHERE r.anime_id = a.id) as hasReview
     FROM anime a ORDER BY a.title`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => ({ ...r, hasReview: r.hasReview > 0 })));
    }
  );
});

app.listen(PORT, () => {
  console.log(`🚀 AniLog 서버: http://localhost:${PORT}`);
});