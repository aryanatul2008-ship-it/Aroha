require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err.stack);
    } else {
        console.log('✅ Connected to PostgreSQL database at:', res.rows[0].now);
    }
});

// ─── Auto-Migration: Add user data columns if they don't exist ───
async function runMigrations() {
    try {
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_skills JSONB DEFAULT '[]';
        `);
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS target_career VARCHAR(255) DEFAULT '';
        `);
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS required_skills JSONB DEFAULT '[]';
        `);
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS readiness_score INTEGER DEFAULT 0;
        `);
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
        `);
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_quests JSONB DEFAULT '[]';
        `);
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS language_scores JSONB DEFAULT '{"C": 15, "C++": 15, "Python": 15, "Java": 15, "JavaScript": 40, "HTML": 40, "CSS": 40}'::jsonb;
        `);
        await pool.query(`
            UPDATE users SET language_scores = '{"C": 15, "C++": 15, "Python": 15, "Java": 15, "JavaScript": 40, "HTML": 40, "CSS": 40}'::jsonb WHERE language_scores IS NULL;
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                company VARCHAR(255) NOT NULL,
                required_skills TEXT[] NOT NULL,
                logo_url TEXT,
                location TEXT,
                salary_range TEXT
            );
        `);
        await pool.query(`
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS logo_url TEXT;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location TEXT;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_range TEXT;
        `);
        const jobsCount = await pool.query('SELECT COUNT(*) FROM jobs');
        if (parseInt(jobsCount.rows[0].count, 10) === 0) {
            await pool.query(`
                INSERT INTO jobs (title, company, required_skills, logo_url, location, salary_range) VALUES
                ('Frontend React Developer', 'Vercel', ARRAY['JavaScript', 'React', 'HTML', 'CSS'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 116 100\\'%3E%3Cpath fill=\\'%23ffffff\\' d=\\'M57.5 0L115 100H0z\\'/%3E%3C/svg%3E', 'Remote', '$95k - $120k'),
                ('Senior Frontend Engineer', 'Figma', ARRAY['JavaScript', 'React', 'CSS', 'TypeScript'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 38 57\\'%3E%3Cpath fill=\\'%231ABCFE\\' d=\\'M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z\\'/%3E%3Cpath fill=\\'%230ACF83\\' d=\\'M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z\\'/%3E%3Cpath fill=\\'%23FF7262\\' d=\\'M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z\\'/%3E%3Cpath fill=\\'%23F24E1E\\' d=\\'M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z\\'/%3E%3Cpath fill=\\'%23A259FF\\' d=\\'M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z\\'/%3E%3C/svg%3E', 'Remote', '$85k - $110k'),
                ('Web Application Developer', 'Shopify', ARRAY['HTML', 'CSS', 'JavaScript', 'REST APIs'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%2395bf47\\'%3E%3Cpath d=\\'M19.5 7.5L18 3.5H15V2C15 0.9 14.1 0 13 0H11C9.9 0 9 0.9 9 2V3.5H6L4.5 7.5L2 9.5L4 23.5L12 24L20 23.5L22 9.5L19.5 7.5ZM10.5 2C10.5 1.7 10.7 1.5 11 1.5H13C13.3 1.5 13.5 1.7 13.5 2V3.5H10.5V2Z\\'/%3E%3C/svg%3E', 'Remote', '$120k - $160k'),
                ('Full Stack Engineer', 'Netlify', ARRAY['JavaScript', 'React', 'Node.js', 'REST APIs', 'Git'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%2300c7b7\\'%3E%3Cpath d=\\'M14.9 3.1l-2.4 2.4 2.4 2.4-2.4 2.4 2.4 2.4-4.8 4.8 4.8 4.8 7.2-7.2-7.2-7.2zm-5.8 4.8l2.4-2.4-2.4-2.4-7.2 7.2 7.2 7.2 2.4-2.4-2.4-2.4 4.8-4.8-4.8-4.8z\\'/%3E%3C/svg%3E', 'Remote', '$110k - $145k'),
                ('Embedded Firmware Engineer', 'Texas Instruments', ARRAY['C', 'Embedded C', 'Microcontrollers', 'UART'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' rx=\\'20\\' fill=\\'%23cc0000\\'/%3E%3Ctext x=\\'50\\' y=\\'63\\' font-family=\\'sans-serif\\' font-size=\\'38\\' font-weight=\\'900\\' fill=\\'white\\' text-anchor=\\'middle\\'%3ETI%3C/text%3E%3C/svg%3E', 'On-site', '$90k - $125k'),
                ('Systems Software Developer', 'NVIDIA', ARRAY['C', 'C++', 'RTOS', 'Pointers'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' rx=\\'20\\' fill=\\'%23000000\\' stroke=\\'%2376b900\\' stroke-width=\\'4\\'/%3E%3Ctext x=\\'50\\' y=\\'63\\' font-family=\\'sans-serif\\' font-size=\\'36\\' font-weight=\\'900\\' fill=\\'%2376b900\\' text-anchor=\\'middle\\'%3ENV%3C/text%3E%3C/svg%3E', 'Hybrid', '$135k - $175k'),
                ('IoT Devices Engineer', 'Qualcomm', ARRAY['C', 'UART', 'SPI', 'I2C', 'Microcontrollers'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' rx=\\'20\\' fill=\\'%233253dc\\'/%3E%3Ctext x=\\'50\\' y=\\'60\\' font-family=\\'sans-serif\\' font-size=\\'22\\' font-weight=\\'800\\' fill=\\'white\\' text-anchor=\\'middle\\'%3EQCOM%3C/text%3E%3C/svg%3E', 'Hybrid', '$115k - $150k'),
                ('Junior Data Analyst', 'Deloitte', ARRAY['SQL', 'Excel', 'Python', 'Statistics'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' rx=\\'20\\' fill=\\'%23000000\\'/%3E%3Ctext x=\\'44\\' y=\\'64\\' font-family=\\'sans-serif\\' font-size=\\'42\\' font-weight=\\'900\\' fill=\\'white\\' text-anchor=\\'middle\\'%3ED%3C/text%3E%3Ccircle cx=\\'66\\' cy=\\'60\\' r=\\'6\\' fill=\\'%2386bc25\\'/%3E%3C/svg%3E', 'Hybrid', '$80k - $105k'),
                ('Business Intelligence Analyst', 'Google', ARRAY['SQL', 'Python', 'Pandas', 'Data Visualization'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'%3E%3Cpath fill=\\'%234285F4\\' d=\\'M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.685-5.17 3.685-9.09z\\'/%3E%3Cpath fill=\\'%2334A853\\' d=\\'M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z\\'/%3E%3Cpath fill=\\'%23FBBC05\\' d=\\'M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z\\'/%3E%3Cpath fill=\\'%23EA4335\\' d=\\'M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z\\'/%3E%3C/svg%3E', 'Hybrid', '$130k - $170k'),
                ('Data Infrastructure Engineer', 'IBM', ARRAY['Python', 'SQL', 'Pandas', 'Git'], 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' rx=\\'20\\' fill=\\'%23006699\\'/%3E%3Ctext x=\\'50\\' y=\\'63\\' font-family=\\'sans-serif\\' font-size=\\'32\\' font-weight=\\'900\\' fill=\\'white\\' text-anchor=\\'middle\\' letter-spacing=\\'2\\'%3EIBM%3C/text%3E%3C/svg%3E', 'Remote', '$105k - $140k');
            `);
        }

        const peerUsersCount = await pool.query("SELECT COUNT(*) FROM users WHERE email LIKE '%@peer.aroha.io'");
        if (parseInt(peerUsersCount.rows[0].count, 10) === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPwd = await bcrypt.hash('ArohaPeer2026!', salt);
            await pool.query(`
                INSERT INTO users (name, email, password, xp, target_career, readiness_score, selected_skills) VALUES
                ('Sarah Chen', 'sarah.chen@peer.aroha.io', $1, 3420, 'Full Stack Engineer', 94, '["JavaScript", "React", "Node.js", "PostgreSQL"]'),
                ('Alex Rivera', 'alex.rivera@peer.aroha.io', $1, 2980, 'Embedded Systems Engineer', 88, '["C", "Embedded C", "Microcontrollers", "RTOS"]'),
                ('Maya Patel', 'maya.patel@peer.aroha.io', $1, 2650, 'Data Analyst', 82, '["Python", "SQL", "Pandas", "Statistics"]'),
                ('Marcus Vance', 'marcus.vance@peer.aroha.io', $1, 2310, 'Frontend Developer', 78, '["JavaScript", "React", "CSS", "TypeScript"]'),
                ('Elena Rostova', 'elena.rostova@peer.aroha.io', $1, 1890, 'Full Stack Engineer', 72, '["React", "Node.js", "REST APIs", "Git"]'),
                ('David Kim', 'david.kim@peer.aroha.io', $1, 1420, 'Embedded Systems Engineer', 65, '["C", "Microcontrollers", "UART", "SPI"]'),
                ('Aaliyah Khan', 'aaliyah.khan@peer.aroha.io', $1, 1150, 'Frontend Developer', 60, '["HTML", "CSS", "JavaScript", "REST APIs"]');
            `, [hashedPwd]);
            console.log('✅ Seeded demo peer students for leaderboard');
        }
        console.log('✅ Database migrations complete');
    } catch (err) {
        console.error('⚠️ Migration warning:', err.message);
    }
}

runMigrations();

// ─── Auth Middleware ───
function authMiddleware(req, res, next) {
    const userId = req.cookies.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }
    req.userId = userId;
    next();
}

// ─── Signup Route ───
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );

        // Auto-login after signup: set cookie
        res.cookie('userId', newUser.rows[0].id, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            secure: false
        });

        res.status(201).json({ message: 'User registered successfully!', user: newUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error during signup.' });
    }
});

// ─── Login Route with 30-Day "Remember Me" Cookie Logic ───
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;

        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        // 30 days expiry if rememberMe is true, otherwise session cookie
        const cookieExpiry = rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined;

        res.cookie('userId', user.id, {
            httpOnly: true,
            maxAge: cookieExpiry,
            secure: false
        });

        res.json({
            message: 'Logged in successfully!',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                target_career: user.target_career || ''
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// ─── GET /api/me — Return full profile for logged-in user ───
app.get('/api/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, selected_skills, target_career,
                    required_skills, readiness_score, xp, completed_quests, language_scores
             FROM users WHERE id = $1`,
            [req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── PUT /api/profile — Update name, skills, career ───
app.put('/api/profile', authMiddleware, async (req, res) => {
    try {
        const { name, selected_skills, target_career, required_skills } = req.body;
        const updates = [];
        const values = [];
        let p = 0;

        if (name !== undefined) {
            p++;
            updates.push(`name = $${p}`);
            values.push(typeof name === 'string' ? name.trim() : name);
        }
        if (selected_skills !== undefined) {
            p++;
            updates.push(`selected_skills = $${p}`);
            values.push(JSON.stringify(selected_skills));
        }
        if (target_career !== undefined) {
            const cleanCareer = typeof target_career === 'string' ? target_career.trim() : target_career;
            p++;
            updates.push(`target_career = $${p}`);
            values.push(cleanCareer);

            if (required_skills === undefined) {
                const careerRequiredSkillsMap = {
                    'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'REST APIs', 'Git'],
                    'Embedded Systems Engineer': ['C', 'Pointers', 'Embedded C', 'Microcontrollers', 'UART', 'SPI', 'I2C', 'RTOS'],
                    'Data Analyst': ['Python', 'SQL', 'Excel', 'Statistics', 'Pandas', 'Data Visualization']
                };
                if (careerRequiredSkillsMap[cleanCareer]) {
                    p++;
                    updates.push(`required_skills = $${p}`);
                    values.push(JSON.stringify(careerRequiredSkillsMap[cleanCareer]));
                }
            }
        }
        if (required_skills !== undefined) {
            p++;
            updates.push(`required_skills = $${p}`);
            values.push(JSON.stringify(required_skills));
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

        p++;
        values.push(req.userId);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${p}`, values);

        console.log(`✅ Profile updated in DB for user ${req.userId}: target_career="${target_career || ''}"`);
        res.json({ message: 'Profile updated.', target_career });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── PUT /api/progress — Update XP, completed quests, readiness score, language_scores ───
app.put('/api/progress', authMiddleware, async (req, res) => {
    try {
        const { xp, completed_quests, readiness_score, language_scores } = req.body;
        const updates = [];
        const values = [];
        let p = 0;

        if (xp !== undefined)               { p++; updates.push(`xp = $${p}`);               values.push(xp); }
        if (completed_quests !== undefined)  { p++; updates.push(`completed_quests = $${p}`);  values.push(JSON.stringify(completed_quests)); }
        if (readiness_score !== undefined)   { p++; updates.push(`readiness_score = $${p}`);   values.push(readiness_score); }
        if (language_scores !== undefined)   { p++; updates.push(`language_scores = $${p}`);   values.push(JSON.stringify(language_scores)); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

        p++; values.push(req.userId);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${p}`, values);

        res.json({ message: 'Progress updated.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── GET /api/user/history — Return completed quests history ───
app.get('/api/user/history', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT completed_quests, xp FROM users WHERE id = $1',
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        let history = result.rows[0].completed_quests;
        if (typeof history === 'string') {
            try { history = JSON.parse(history); } catch (e) { history = []; }
        }

        if (!Array.isArray(history) || history.length === 0) {
            return res.json([]);
        }

        // Load questions.json arenas map to resolve quest IDs to titles & XP
        let arenasMap = {};
        try {
            const qData = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
            if (Array.isArray(qData.arenas)) {
                qData.arenas.forEach(a => { arenasMap[a.id] = a; });
            }
        } catch (_) {}

        // Normalize items to ensure { timestamp, quest_name, earned_xp }
        const formattedHistory = history.map((item, idx) => {
            if (typeof item === 'number' || (!isNaN(item) && typeof item === 'string')) {
                const qId = Number(item);
                const quest = arenasMap[qId];
                return {
                    timestamp: new Date(Date.now() - 3600000 * (idx + 1) * 4).toISOString(),
                    quest_name: quest ? quest.title : `Arena Challenge #${qId}`,
                    earned_xp: quest ? quest.xp : 100
                };
            }
            if (typeof item === 'string') {
                return {
                    timestamp: new Date(Date.now() - 3600000 * (idx + 1) * 8).toISOString(),
                    quest_name: item,
                    earned_xp: 100
                };
            }
            return {
                timestamp: item.timestamp || item.date || new Date().toISOString(),
                quest_name: item.quest_name || item.name || item.title || 'Algorithmic Quest',
                earned_xp: item.earned_xp || item.xp || 50
            };
        });

        res.json(formattedHistory);
    } catch (err) {
        console.error('❌ Error fetching user history:', err);
        res.status(500).json({ error: 'Server error fetching user history.' });
    }
});

// ─── GET /api/jobs/match — Return top 6 job matches based on user's skills ───
app.get('/api/jobs/match', authMiddleware, async (req, res) => {
    try {
        // Fetch authenticated user's skills array from PostgreSQL
        const userResult = await pool.query(
            'SELECT selected_skills FROM users WHERE id = $1',
            [req.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const rawSkills = userResult.rows[0].selected_skills;
        let userSkills = Array.isArray(rawSkills)
            ? rawSkills
            : (typeof rawSkills === 'string' ? JSON.parse(rawSkills || '[]') : []);

        // Optional query parameter override for testing/filtering (?skills=React,CSS)
        if (req.query.skills) {
            userSkills = req.query.skills.split(',').map(s => s.trim());
        }

        const query = `
            SELECT 
                id,
                title,
                company,
                required_skills,
                logo_url,
                location,
                salary_range,
                CASE 
                    WHEN cardinality($1::text[]) = 0 OR $1::text[] IS NULL THEN 0
                    ELSE ROUND(
                        (
                            SELECT COUNT(*)::NUMERIC 
                            FROM unnest(required_skills) AS req_skill 
                            WHERE req_skill ILIKE ANY($1::text[])
                        ) * 100.0 / NULLIF(cardinality(required_skills), 0),
                        0
                    )::INTEGER
                END AS match_percentage
            FROM jobs
            ORDER BY match_percentage DESC, id ASC
            LIMIT 6;
        `;

        const result = await pool.query(query, [userSkills]);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error calculating job matches:', err);
        res.status(500).json({ error: 'Server error while calculating job matches.' });
    }
});

// ─── GET /api/leaderboard — Return top students ordered by accumulated XP ───
app.get('/api/leaderboard', async (req, res) => {
    try {
        const currentUserId = req.cookies.userId ? parseInt(req.cookies.userId, 10) : null;

        // Query top 10 students ordered by accumulated XP descending
        const query = `
            SELECT id, name, COALESCE(xp, 0) AS xp, target_career, readiness_score
            FROM users
            ORDER BY xp DESC, id ASC
            LIMIT 10;
        `;
        const result = await pool.query(query);

        const leaderboard = result.rows.map((row, index) => ({
            rank: index + 1,
            id: row.id,
            name: row.name || 'Anonymous Student',
            xp: parseInt(row.xp, 10) || 0,
            target_career: row.target_career || 'Software Engineer',
            readiness_score: parseInt(row.readiness_score, 10) || 0,
            is_current_user: currentUserId ? (row.id === currentUserId) : false
        }));

        res.json(leaderboard);
    } catch (err) {
        console.error('❌ Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Server error while fetching leaderboard.' });
    }
});

// ─── Procedural Dynamic Roadmap Generator (Pace-Adaptive with Rotational Variations) ───
function generateProceduralRoadmap(targetCareer, paceStr, skills) {
    let totalWeeks = 12;
    if (typeof paceStr === 'string') {
        const match = paceStr.match(/(\d+)/);
        if (match) {
            totalWeeks = parseInt(match[1], 10);
        } else if (paceStr.toLowerCase().includes('fast')) {
            totalWeeks = 4;
        } else if (paceStr.toLowerCase().includes('deep')) {
            totalWeeks = 24;
        }
    }
    totalWeeks = Math.max(4, Math.min(30, totalWeeks));

    const roleBanks = {
        'Frontend Developer': [
            { topic: 'Semantic HTML5 Standards & DOM Hierarchies', concepts: 'ARIA accessibility (WCAG AA), microdata schemas, SEO markup, and modern document structure.', projects: ['Build a fully accessible responsive corporate landing page adhering to WCAG AA guidelines.', 'Implement semantic HTML structure with custom schema metadata and accessible forms.'] },
            { topic: 'Fluid CSS Architecture, Grid & Custom Properties', concepts: 'CSS Grid, subgrid, container queries, CSS custom properties, and fluid typography.', projects: ['Architect a multi-theme design system using CSS custom properties and fluid typography.', 'Develop a responsive magazine grid layout using CSS Subgrid and container queries.'] },
            { topic: 'JavaScript Execution Engine, Scope & Closures', concepts: 'Call stack, execution contexts, lexical scoping, hoisting, closures, and garbage collection diagnostics.', projects: ['Implement a custom JavaScript memoization engine and private-state closure utilities.', 'Build an in-browser event emitter library with subscription lifecycle management.'] },
            { topic: 'Async JavaScript, Event Loop & Concurrency', concepts: 'Event loop phases, microtasks vs macrotasks, Promise internals, async/await, and AbortController.', projects: ['Construct a concurrent asynchronous task queue with automated retries and exponential backoff.', 'Build an abortable fetch controller with rate limiting and timeout cancellation.'] },
            { topic: 'Modern Component Architecture in React', concepts: 'Declarative UI patterns, component lifecycles, pure functional components, and Virtual DOM diffing.', projects: ['Create a flexible component tree featuring nested slots and compound component patterns.', 'Build an interactive form system with controlled/uncontrolled inputs and live validation.'] },
            { topic: 'Advanced React Hooks & Custom Hook Design', concepts: 'useReducer dispatch pipelines, useRef DOM persistence, useMemo profiling, and custom hook abstractions.', projects: ['Develop a custom hooks library for debounced search, window listeners, and local storage sync.', 'Build an undo/redo history engine powered by useReducer and immutable state snapshots.'] },
            { topic: 'Client-Side State Architecture & Context Isolation', concepts: 'Context API re-rendering traps, modular store design, Zustand, and Redux Toolkit patterns.', projects: ['Engineer a lightweight centralized state manager for a real-time collaborative workspace.', 'Implement global shopping cart state with persistent storage and optimistic balance updates.'] },
            { topic: 'Server Cache Synchronization & React Query', concepts: 'TanStack Query: optimistic updates, query invalidation, automated refetching, and pagination.', projects: ['Build an offline-first data browser with automated background sync and stale-while-revalidate caching.', 'Implement infinite scrolling list with cursor-based pagination and optimistic cache mutation.'] },
            { topic: 'RESTful API Engineering & Secure Auth Flows', concepts: 'HTTP headers, CORS negotiation, JWT cookies, refresh token rotation, and Axios interceptors.', projects: ['Engineer a secure client authentication layer with transparent JWT refresh token rotation.', 'Build an authenticated API client with automatic request retry and centralized error handling.'] },
            { topic: 'TypeScript Integration & Strict Type Safety', concepts: 'Generics, union types, type guards, mapped types, utility types, and runtime schema validation with Zod.', projects: ['Migrate an untyped React code repository to 100% strict TypeScript with Zod API validation.', 'Build a type-safe generic form builder that automatically infers submission payload types.'] },
            { topic: 'Next.js App Router & React Server Components', concepts: 'Server vs client boundary, streaming with Suspense, server actions, and nested layout architecture.', projects: ['Develop a full-stack Next.js content portal with dynamic SEO metadata and server-side rendering.', 'Build an e-commerce catalog utilizing React Server Components and server action checkouts.'] },
            { topic: 'Full-Stack Edge Handlers & Database Integration', concepts: 'Edge runtime latency, serverless execution limits, middleware routing, and PostgreSQL connection pooling.', projects: ['Build serverless CRUD API endpoints backed by PostgreSQL with transactional integrity.', 'Implement edge middleware for geo-routing and localized content delivery.'] },
            { topic: 'Web Performance Optimization & Core Web Vitals', concepts: 'Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), Interaction to Next Paint (INP), and code splitting.', projects: ['Profile and optimize an application bundle to achieve 95+ Google Lighthouse scores.', 'Refactor an asset-heavy application using dynamic imports, lazy loading, and modern image formats.'] },
            { topic: 'Automated Unit & Integration Testing (Vitest/Jest)', concepts: 'Unit testing pure logic, mocking API calls with MSW, and React Testing Library accessible queries.', projects: ['Write an automated test suite achieving 85%+ statement and branch coverage across core components.', 'Implement integration tests validating multi-step user workflows using Mock Service Worker.'] },
            { topic: 'End-to-End (E2E) Browser Testing with Playwright', concepts: 'Headless browser automation, visual regression testing, and cross-browser device emulation.', projects: ['Deploy automated Playwright regression tests running inside a GitHub Actions CI pipeline.', 'Script an end-to-end test verifying multi-role user authentication and checkout flows.'] },
            { topic: 'Real-Time WebSockets & Event-Driven UI', concepts: 'WebSocket protocol lifecycles, heartbeat keep-alive, reconnection backoff, and Socket.io.', projects: ['Build a real-time collaborative whiteboarding canvas with multi-cursor tracking.', 'Develop an instant chat and live notification streaming channel using WebSockets.'] },
            { topic: 'Microfrontends & Module Federation Architecture', concepts: 'Webpack 5 module federation, independent bundle deployment, and cross-application routing.', projects: ['Architect a federated container shell seamlessly hosting two decoupled remote applications.', 'Create a shared design system module federated across separate client micro-apps.'] },
            { topic: 'Client Security, XSS Mitigation & CSP Headers', concepts: 'Cross-site scripting sanitization, strict Content Security Policy directives, and CSRF protection.', projects: ['Harden a web app against injection vulnerabilities and configure strict CSP response headers.', 'Audit and sanitize rich-text user inputs using DOMPurify and secure iframe sandboxes.'] },
            { topic: 'CI/CD Automation, Docker & Cloud Deployment', concepts: 'Multi-stage Docker builds, GitHub Actions workflows, preview deployments, and CDN caching.', projects: ['Configure a multi-stage Dockerfile and automated GitHub Action delivering live preview deployments.', 'Deploy a production application to a globally distributed edge CDN with cache-control headers.'] },
            { topic: 'Progressive Web Apps (PWA) & Service Workers', concepts: 'Cache First vs Network First strategies, service worker lifecycles, web app manifests, and offline storage.', projects: ['Transform an online portal into an installable offline-capable Progressive Web Application.', 'Build a background sync queue that buffers offline mutations and syncs upon reconnection.'] },
            { topic: 'Advanced UI Animation & Motion Design', concepts: 'Framer Motion layout animations, gesture controls, physics-based springs, and exit transitions.', projects: ['Craft fluid interactive page transitions and physics-based gesture drag controls.', 'Build a high-performance interactive animated data dashboard with SVG path morphing.'] },
            { topic: 'Monitoring, Error Logging & Telemetry (Sentry)', concepts: 'Real-time exception capture, breadcrumb trails, performance tracing, and user session replay.', projects: ['Instrument an enterprise React application with full error boundaries and distributed telemetry.', 'Build an automated monitoring alert pipeline notifying engineers of runtime client regressions.'] },
            { topic: 'System Design: Enterprise Frontend Architecture', concepts: 'Large-scale frontend architecture: state normalization, asset pipelines, monorepo tooling with Turborepo.', projects: ['Author an architectural system design specification document for a high-traffic web platform.', 'Set up a Turborepo monorepo structuring shared UI components, utility libraries, and apps.'] },
            { topic: 'Capstone Production Project & Technical Interview Prep', concepts: 'Full portfolio capstone deployment, algorithmic coding patterns, and live coding interview mastery.', projects: ['Deploy and polish your complete production capstone application with live documentation.', 'Complete a comprehensive technical interview review covering frontend algorithms and architecture.'] }
        ],
        'Embedded Systems Engineer': [
            { topic: 'Low-Level C Programming & Memory Pointers', concepts: 'Pointer arithmetic, stack vs heap allocation, structs, bitfields, and memory alignment.', projects: ['Implement a memory-efficient circular ring buffer and custom fixed-block memory allocator.'] },
            { topic: 'Bit Manipulation & Register-Level Hardware Access', concepts: 'Bitwise operations, bit masks, shift registers, and volatile memory-mapped I/O peripherals.', projects: ['Write a register-level GPIO hardware driver without relying on external vendor HAL libraries.'] },
            { topic: 'Microcontroller Architecture & Clock Trees', concepts: 'ARM Cortex-M core registers, clock tree PLL configuration, and MCU boot vectors.', projects: ['Configure an MCU clock system for maximum operating frequency with low-power sleep modes.'] },
            { topic: 'Interrupt Service Routines (ISR) & NVIC Priorities', concepts: 'Interrupt latency, priority grouping, subpriorities, and thread-safe volatile flag signaling.', projects: ['Implement an interrupt-driven button debouncer and hardware timer capture routine.'] },
            { topic: 'UART Serial Communication Driver', concepts: 'Asynchronous framing, parity, baud rate calculation, and circular FIFO ring buffers.', projects: ['Build a non-blocking interrupt-driven UART driver supporting streaming serial transmission.'] },
            { topic: 'SPI Protocol & Peripheral Interfacing', concepts: 'SPI clock polarity and phase (CPOL/CPHA), master-slave topology, and DMA streaming.', projects: ['Interface an SPI graphical OLED display with high-speed DMA burst transfers.'] },
            { topic: 'I2C Protocol & Multi-Sensor Integration', concepts: 'Start/stop conditions, acknowledge bits, bus arbitration, and 7-bit/10-bit addressing.', projects: ['Read temperature, humidity, and IMU sensor data concurrently over an I2C bus.'] },
            { topic: 'Analog-to-Digital Conversion (ADC) & Sensors', concepts: 'Successive approximation ADC, sampling rate, resolution, and input impedance matching.', projects: ['Sample analog sensor signals with DMA transfer and perform moving average digital filtering.'] },
            { topic: 'Pulse Width Modulation (PWM) & Motor Control', concepts: 'Timer counter modes, center-aligned PWM, duty cycle control, and dead-time generation.', projects: ['Design a closed-loop motor speed controller with PWM and optical encoder feedback.'] },
            { topic: 'Real-Time Operating Systems (RTOS) Core Concepts', concepts: 'Task states, preemptive priority scheduling, context switching, and tick frequency.', projects: ['Set up FreeRTOS with three concurrent tasks managing sensors, display, and telemetry.'] },
            { topic: 'RTOS Synchronization (Mutexes, Semaphores & Queues)', concepts: 'Binary and counting semaphores, recursive mutexes, and thread-safe FreeRTOS queues.', projects: ['Implement a producer-consumer pipeline with inter-task message queues and mutex locking.'] },
            { topic: 'Priority Inversion & Priority Ceiling Protocols', concepts: 'Priority inversion diagnosis, priority inheritance, and deadlock mitigation techniques.', projects: ['Benchmark priority inheritance mechanisms under high CPU load conditions.'] },
            { topic: 'Direct Memory Access (DMA) Controllers', concepts: 'Memory-to-peripheral, peripheral-to-memory, double buffering, and half-transfer interrupts.', projects: ['Stream audio data continuously from flash memory to a DAC using DMA circular buffers.'] },
            { topic: 'Hardware Timers, Watchdogs & System Resets', concepts: 'Independent watchdog (IWDG), window watchdog (WWDG), and brownout detection.', projects: ['Implement a watchdog fail-safe with fault logging into persistent non-volatile memory.'] },
            { topic: 'Flash Memory Management & EEPROM Emulation', concepts: 'Page erase cycles, flash wear leveling, sector security, and persistent parameter storage.', projects: ['Build a robust key-value configuration store on top of internal flash memory.'] },
            { topic: 'Low Power Modes & Energy Harvesting', concepts: 'Sleep, stop, and standby modes, wake-up timer pins, and measuring current consumption.', projects: ['Optimize a battery-powered sensor node to consume less than 15 microamps in deep sleep.'] },
            { topic: 'CAN Bus Protocol & Automotive Telemetry', concepts: 'CAN 2.0B / CAN FD frame architecture, differential signaling, and message filtering.', projects: ['Transmit and decode vehicle telemetry frames across an isolated CAN transceiver bus.'] },
            { topic: 'BLE (Bluetooth Low Energy) Fundamentals', concepts: 'GAP/GATT profiles, advertising intervals, services, and characteristics.', projects: ['Develop a custom GATT service broadcasting real-time sensor measurements to a smartphone.'] },
            { topic: 'Firmware Over-The-Air (FOTA) Bootloaders', concepts: 'Dual-bank flash partitions, bootloader verification, and CRC32 checksums.', projects: ['Design a custom bootloader capable of receiving and verifying firmware updates over UART.'] },
            { topic: 'Hardware Debugging with JTAG/SWD & Logic Analyzers', concepts: 'Breakpoints, watchpoints, trace buffers, and decoding bus signals with Sigrok/Saleae.', projects: ['Analyze timing jitter on SPI/I2C buses and optimize clock edge transitions.'] },
            { topic: 'Embedded C++ & Hardware Abstraction Layers', concepts: 'Zero-cost abstractions, template metaprogramming, avoiding dynamic allocation, and RAII.', projects: ['Build a type-safe modern C++ register access library without runtime overhead.'] },
            { topic: 'Embedded Linux & Device Driver Basics', concepts: 'Kernel space vs user space, device tree overlays, sysfs, and char device drivers.', projects: ['Write and load a Linux kernel module controlling GPIO peripherals on an embedded SBC.'] },
            { topic: 'Automated Hardware-in-the-Loop (HIL) Testing', concepts: 'Mocking peripherals, unit testing with Unity/CMock, and automated regression suites.', projects: ['Construct an automated CI pipeline running firmware unit tests with mock registers.'] },
            { topic: 'Capstone Embedded Hardware System Integration', concepts: 'Complete product prototype integration, PCB enclosure constraints, and field readiness.', projects: ['Deliver and document a complete multi-sensor IoT device with cloud reporting.'] }
        ],
        'Data Analyst': [
            { topic: 'Relational Database Architecture & SQL Fundamentals', concepts: 'SELECT, WHERE, aggregate functions, GROUP BY, and HAVING constraints.', projects: ['Analyze customer transaction logs and extract key revenue performance indicators.'] },
            { topic: 'Advanced SQL Joins & Subqueries', concepts: 'INNER, LEFT, RIGHT, FULL OUTER joins, self joins, and correlated subqueries.', projects: ['Reconstruct a multi-table e-commerce database into denormalized analytics summaries.'] },
            { topic: 'SQL Window Functions & Analytical Partitioning', concepts: 'ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, and moving window frames.', projects: ['Calculate customer retention rates and rolling 30-day revenue moving averages.'] },
            { topic: 'Query Optimization & Indexing Strategies', concepts: 'EXPLAIN ANALYZE query plans, B-tree indexes, covering indexes, and partition pruning.', projects: ['Optimize a slow 10-million-row SQL query to execute in under 200 milliseconds.'] },
            { topic: 'Python Environment & Data Structures for Analytics', concepts: 'List comprehensions, dictionary mappings, lambda functions, and data cleaning.', projects: ['Process and validate semi-structured log records from an external analytics API.'] },
            { topic: 'NumPy Vectorization & Scientific Computations', concepts: 'Multi-dimensional ndarrays, broadcasting, linear algebra, and random sampling.', projects: ['Implement vectorized financial risk simulations using matrix operations.'] },
            { topic: 'Pandas DataFrames: Manipulation & Transformation', concepts: 'Indexing, filtering, groupby aggregations, pivot tables, and merging datasets.', projects: ['Clean, normalize, and reshape multi-source sales datasets into clean reporting models.'] },
            { topic: 'Handling Missing Data & Outlier Detection', concepts: 'Imputation techniques (mean, median, KNN), IQR methods, and z-score filtering.', projects: ['Build a reusable data cleaning pipeline capable of handling anomalies automatically.'] },
            { topic: 'Exploratory Data Analysis (EDA) Techniques', concepts: 'Summary statistics, skewness, kurtosis, correlation heatmaps, and pair plots.', projects: ['Perform complete exploratory analysis on housing market trends and consumer demand.'] },
            { topic: 'Data Storytelling & Static Visualizations with Matplotlib', concepts: 'Subplots, custom color palettes, annotations, and publication-ready typography.', projects: ['Design a clean executive summary infographic highlighting quarterly sales trends.'] },
            { topic: 'Statistical Plotting with Seaborn', concepts: 'Box plots, violin plots, facet grids, regression plots, and distribution overlays.', projects: ['Visualize customer churn probability distributions across demographic cohorts.'] },
            { topic: 'Interactive Dashboards with Plotly', concepts: 'Interactive hover tooltips, geographic choropleths, zoomable time series charts.', projects: ['Create an interactive financial dashboard with dynamic date range selectors.'] },
            { topic: 'Probability Theory & Inferential Statistics', concepts: 'Normal distributions, Central Limit Theorem, confidence intervals, and p-values.', projects: ['Calculate confidence intervals for conversion rates across marketing campaigns.'] },
            { topic: 'Hypothesis Testing & A/B Test Experimentation', concepts: 'Two-sample t-tests, Chi-square tests of independence, ANOVA, and power analysis.', projects: ['Analyze real A/B test split results and evaluate statistical significance for product changes.'] },
            { topic: 'Time Series Analysis & Forecasting', concepts: 'Seasonality decomposition, trend extraction, autocorrelation (ACF/PACF), and moving averages.', projects: ['Forecast product demand for the upcoming fiscal quarter with exponential smoothing.'] },
            { topic: 'Data Extraction: REST APIs & Web Scraping', concepts: 'Requests library, parsing nested JSON, rate limiting, and BeautifulSoup extraction.', projects: ['Build an automated web scraper extracting public pricing data into a structured CSV.'] },
            { topic: 'Data Warehousing Fundamentals: BigQuery & Snowflake', concepts: 'Star vs snowflake schemas, columnar storage, clustering, and data lake integration.', projects: ['Model a dimensional data warehouse schema for high-throughput retail operations.'] },
            { topic: 'Automated ETL Pipelines with Python', concepts: 'Extraction, transformation, loading, automated scheduling, and data validation.', projects: ['Develop an automated ETL pipeline that extracts daily sales and syncs to a database.'] },
            { topic: 'Business Intelligence Dashboards (Power BI / Tableau / Metabase)', concepts: 'Data modeling, DAX measures, calculated fields, and interactive slicers.', projects: ['Build a real-time executive KPI performance dashboard with drilled-down filters.'] },
            { topic: 'Customer Segmentation & RFM Analysis', concepts: 'Recency, Frequency, Monetary (RFM) scoring, and customer lifetime value (CLV).', projects: ['Segment a customer base of 50,000 users into actionable retention cohorts.'] },
            { topic: 'Cohort Analysis & Churn Modeling', concepts: 'Retention heatmaps, survival analysis curves, and identifying early churn indicators.', projects: ['Construct a monthly cohort retention matrix identifying drops in user engagement.'] },
            { topic: 'Machine Learning for Analysts: Linear & Logistic Regression', concepts: 'Feature scaling, model evaluation (R-squared, RMSE, AUC-ROC), and coefficients.', projects: ['Train a predictive model forecasting employee turnover based on survey indicators.'] },
            { topic: 'Data Governance, Ethics & Privacy (GDPR/CCPA)', concepts: 'Data anonymization, PII compliance, audit trails, and ethical reporting.', projects: ['Audit a customer database for PII compliance and implement data masking policies.'] },
            { topic: 'Capstone Business Case Study & Stakeholder Presentation', concepts: 'Synthesizing analytical findings into actionable strategic recommendations.', projects: ['Deliver a comprehensive business insight report with slides and predictive modeling.'] }
        ]
    };

    const bank = roleBanks[targetCareer] || roleBanks['Frontend Developer'];
    const roadmap = [];

    for (let w = 1; w <= totalWeeks; w++) {
        const moduleIndex = Math.min(bank.length - 1, Math.floor(((w - 1) / totalWeeks) * bank.length));
        const item = bank[moduleIndex];
        const project = Array.isArray(item.projects) 
            ? item.projects[Math.floor(Math.random() * item.projects.length)]
            : (item.projects || item.project || 'Complete technical practical milestone');

        roadmap.push({
            week: w,
            topic: item.topic,
            description: `${item.concepts} Practical Milestone: ${project}`
        });
    }

    return roadmap;
}

// ─── POST /api/generate-roadmap — Generate AI Learning Roadmap ───
app.post('/api/generate-roadmap', async (req, res) => {
    try {
        const { pace, currentSkills, targetCareer } = req.body;

        if (!targetCareer) {
            return res.status(400).json({ error: 'targetCareer is required.' });
        }

        // If GEMINI_API_KEY is present, attempt live Google Gemini generation
        if (process.env.GEMINI_API_KEY) {
            try {
                const formattedSkills = Array.isArray(currentSkills)
                    ? currentSkills.join(', ')
                    : (currentSkills || 'None declared');

                const prompt = `Act as an expert tech career coach. Create a personalized, realistic, week-by-week learning roadmap for a student with the following profile:
- Target Career Role: ${targetCareer}
- Current Skills & Competencies: ${formattedSkills}
- Target Pace / Timeline: ${pace || 'Standard (12 Weeks)'}

Design a progressive curriculum that bridges the candidate's skill gaps to become industry-ready for the target career role within the specified pace.
Return strictly a JSON array of weekly milestone objects where each object has:
- "week": the week number as an integer
- "topic": concise name of the primary topic or milestone for that week
- "description": clear summary of key concepts to master, practical tasks, or project work for that week`;

                const response = await ai.models.generateContent({
                    model: 'gemini-3.5-flash-lite',
                    contents: prompt,
                    config: {
                        systemInstruction: 'You are an elite tech career coach. Your task is to generate actionable, realistic, week-by-week learning roadmaps. You strictly output JSON matching the provided schema with no markdown formatting or extra commentary.',
                        responseMimeType: 'application/json',
                        responseJsonSchema: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    week: { type: Type.INTEGER, description: 'Week number' },
                                    topic: { type: Type.STRING, description: 'Main topic for this week' },
                                    description: { type: Type.STRING, description: 'Milestone description and project work' }
                                },
                                required: ['week', 'topic', 'description']
                            }
                        }
                    }
                });

                const rawText = response.text ? response.text.trim() : '[]';
                const cleanedText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                const roadmap = JSON.parse(cleanedText);

                if (Array.isArray(roadmap) && roadmap.length > 0) {
                    return res.json(roadmap);
                }
            } catch (aiErr) {
                console.warn('⚠️ Gemini API call failed, falling back to dynamic procedural engine:', aiErr.message);
            }
        }

        // Dynamic Procedural Fallback Engine (Pace-aware & variation-randomized on every click)
        const dynamicRoadmap = generateProceduralRoadmap(targetCareer, pace, currentSkills);
        res.json(dynamicRoadmap);
    } catch (err) {
        console.error('❌ Error generating roadmap:', err);
        res.status(500).json({
            error: 'Failed to generate learning roadmap.',
            details: err.message
        });
    }
});

// ─── Local Code Execution Sandbox Engine ───
const localBinPaths = [
    'C:\\MinGW\\bin',
    'C:\\Users\\aryan\\AppData\\Local\\Python\\bin'
];
localBinPaths.forEach((binPath) => {
    if (fs.existsSync(binPath) && !process.env.PATH.includes(binPath)) {
        process.env.PATH = `${binPath};${process.env.PATH}`;
    }
});

function getPythonPath() {
    const candidate = 'C:\\Users\\aryan\\AppData\\Local\\Python\\bin\\python.exe';
    if (fs.existsSync(candidate)) return candidate;
    return 'python';
}

function killProcess(child) {
    try {
        if (process.platform === 'win32' && child.pid) {
            execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
        } else {
            child.kill('SIGKILL');
        }
    } catch (e) {
        try { child.kill(); } catch (_) {}
    }
}

function executeProcess(cmd, args, stdin = '', timeoutMs = 7000, cwd = process.cwd()) {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let isTimedOut = false;

        const child = spawn(cmd, args, {
            cwd,
            windowsHide: true,
            env: process.env
        });

        const timer = setTimeout(() => {
            isTimedOut = true;
            killProcess(child);
        }, timeoutMs);

        if (child.stdin) {
            if (stdin) {
                child.stdin.write(stdin);
            }
            child.stdin.end();
        }

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            resolve({
                stdout,
                stderr: stderr ? `${stderr}\n${err.message}` : err.message,
                code: 1
            });
        });

        child.on('close', (code) => {
            clearTimeout(timer);
            if (isTimedOut) {
                return resolve({
                    stdout,
                    stderr: `Time Limit Exceeded (${timeoutMs / 1000}s limit exceeded)`,
                    code: 124
                });
            }
            resolve({
                stdout,
                stderr,
                code: code ?? 0
            });
        });
    });
}

// ─── C/C++ Test Harness and Execution Wrappers ───
function detectFunctionSignature(code) {
    const fnRegex = /\b([a-zA-Z0-9_*&]+)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/;
    const match = fnRegex.exec(code);
    if (!match) return null;
    return {
        returnType: match[1].trim(),
        name: match[2].trim(),
        paramStr: match[3].trim(),
        params: match[3].split(',').map(s => s.trim()).filter(Boolean)
    };
}

function wrapCCode(code) {
    if (/\bint\s+main\b|\bvoid\s+main\b|\bmain\s*\(/.test(code)) {
        return code;
    }

    const fn = detectFunctionSignature(code);
    const fnName = fn ? fn.name : '';

    if (fnName === 'reverseString' || /\breverseString\b/.test(code)) {
        return `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${code}

int main() {
    char s[256];
    if (scanf("%255s", s) != 1) {
        strcpy(s, "hello");
    }
    int n = strlen(s);
    reverseString(s, n);
    printf("[");
    for (int i = 0; i < n; i++) {
        printf("\\"%c\\"%s", s[i], (i < n - 1) ? "," : "");
    }
    printf("]\\n");
    return 0;
}
`;
    }

    if (fnName === 'hasCycle' || /\bhasCycle\b/.test(code)) {
        const hasListNode = /struct\s+ListNode\s*\{/.test(code);
        const listNodeDef = hasListNode ? '' : `
struct ListNode {
    int val;
    struct ListNode *next;
};
`;
        return `
#include <stdio.h>
#include <stdbool.h>
#include <stdlib.h>

${listNodeDef}

${code}

int main() {
    struct ListNode n1, n2, n3, n4;
    n1.val = 3; n1.next = &n2;
    n2.val = 2; n2.next = &n3;
    n3.val = 0; n3.next = &n4;
    n4.val = -4; n4.next = &n2;
    bool res = hasCycle(&n1);
    printf("%s\\n", res ? "true" : "false");
    return 0;
}
`;
    }

    if (fnName === 'allocateMatrix' || /\ballocateMatrix\b/.test(code)) {
        return `
#include <stdio.h>
#include <stdlib.h>

${code}

int main() {
    int r = 3, c = 3;
    int** mat = allocateMatrix(r, c);
    if (mat && mat[0] && mat[1] && mat[2]) {
        printf("3x3 zeroed heap matrix\\n");
    } else {
        printf("allocation failed\\n");
    }
    return 0;
}
`;
    }

    if (fnName === 'binarySearch' || fnName === 'search' || /\b(binarySearch|search)\b/.test(code)) {
        const is4Params = fn && fn.params.length === 4;
        const callName = (fnName === 'search' || /\bsearch\b/.test(code)) ? 'search' : 'binarySearch';
        return `
#include <stdio.h>
#include <stdlib.h>

${code}

int main() {
    int arr[100] = {1, 3, 5, 7, 9, 11};
    int n = 6;
    int target = 7;
    int val, count = 0;
    while (scanf("%d", &val) == 1 && count < 100) {
        arr[count++] = val;
    }
    if (count > 1) {
        target = arr[--count];
        n = count;
    }
    int res = ${is4Params ? `${callName}(arr, 0, n - 1, target)` : `${callName}(arr, n, target)`};
    printf("%d\\n", res);
    return 0;
}
`;
    }

    // Generic C function wrapper
    if (fn) {
        let callAndPrint = '';
        if (fn.params.length === 0) {
            callAndPrint = fn.returnType === 'void' ? `${fn.name}();` : `printf("%d\\n", ${fn.name}());`;
        } else if (fn.params.length === 1 && fn.params[0].includes('int')) {
            callAndPrint = `int x = 0; if (scanf("%d", &x) != 1) x = 5; ${fn.returnType === 'void' ? `${fn.name}(x);` : `printf("%d\\n", ${fn.name}(x));`}`;
        } else if (fn.params.length === 2 && fn.params[0].includes('int') && fn.params[1].includes('int')) {
            callAndPrint = `int a = 0, b = 0; if (scanf("%d %d", &a, &b) != 2) { a = 3; b = 5; } ${fn.returnType === 'void' ? `${fn.name}(a, b);` : `printf("%d\\n", ${fn.name}(a, b));`}`;
        } else {
            callAndPrint = 'return 0;';
        }

        return `
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

${code}

int main() {
    ${callAndPrint}
    return 0;
}
`;
    }

    return code + '\nint main() { return 0; }\n';
}

function wrapCppCode(code) {
    if (/\bint\s+main\b|\bvoid\s+main\b|\bmain\s*\(/.test(code)) {
        return code;
    }

    const fn = detectFunctionSignature(code);
    const fnName = fn ? fn.name : '';

    if (fnName === 'reverseList' || /\breverseList\b/.test(code)) {
        const hasListNode = /struct\s+ListNode\s*\{|class\s+ListNode\s*\{/.test(code);
        const listNodeDef = hasListNode ? '' : `
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};
`;
        return `
#include <iostream>
#include <vector>
using namespace std;

${listNodeDef}

${code}

int main() {
    vector<int> vals = {1, 2, 3, 4, 5};
    int x;
    vector<int> inputVals;
    while (cin >> x) inputVals.push_back(x);
    if (!inputVals.empty()) vals = inputVals;

    ListNode* head = nullptr;
    ListNode* tail = nullptr;
    for (size_t i = 0; i < vals.size(); i++) {
        ListNode* node = new ListNode(vals[i]);
        if (!head) head = tail = node;
        else { tail->next = node; tail = node; }
    }

    ListNode* rev = reverseList(head);
    cout << "[";
    ListNode* curr = rev;
    while (curr) {
        cout << curr->val << (curr->next ? ", " : "");
        curr = curr->next;
    }
    cout << "]" << endl;
    return 0;
}
`;
    }

    if (fnName === 'binarySearch' || fnName === 'search' || /\b(binarySearch|search)\b/.test(code)) {
        const hasVector = fn && fn.paramStr.includes('vector');
        const is4Params = fn && fn.params.length === 4;
        const callName = (fnName === 'search' || /\bsearch\b/.test(code)) ? 'search' : 'binarySearch';

        if (hasVector) {
            return `
#include <iostream>
#include <vector>
using namespace std;

${code}

int main() {
    int val;
    vector<int> nums = {1, 3, 5, 7, 9, 11};
    int target = 7;
    vector<int> inputVals;
    while (cin >> val) inputVals.push_back(val);
    if (inputVals.size() > 1) {
        target = inputVals.back();
        inputVals.pop_back();
        nums = inputVals;
    }
    int res = ${callName}(nums, target);
    cout << res << endl;
    return 0;
}
`;
        } else {
            return `
#include <iostream>
#include <vector>
using namespace std;

${code}

int main() {
    int arr[100] = {1, 3, 5, 7, 9, 11};
    int n = 6;
    int target = 7;
    int val, count = 0;
    while (cin >> val && count < 100) {
        arr[count++] = val;
    }
    if (count > 1) {
        target = arr[--count];
        n = count;
    }
    int res = ${is4Params ? `${callName}(arr, 0, n - 1, target)` : `${callName}(arr, n, target)`};
    cout << res << endl;
    return 0;
}
`;
        }
    }

    // Generic C++ function wrapper
    if (fn) {
        let callAndPrint = '';
        if (fn.params.length === 0) {
            callAndPrint = fn.returnType === 'void' ? `${fn.name}();` : `cout << ${fn.name}() << endl;`;
        } else if (fn.params.length === 1 && fn.params[0].includes('int')) {
            callAndPrint = `int x = 0; if (!(cin >> x)) x = 5; ${fn.returnType === 'void' ? `${fn.name}(x);` : `cout << ${fn.name}(x) << endl;`}`;
        } else if (fn.params.length === 2 && fn.params[0].includes('int') && fn.params[1].includes('int')) {
            callAndPrint = `int a = 0, b = 0; if (!(cin >> a >> b)) { a = 3; b = 5; } ${fn.returnType === 'void' ? `${fn.name}(a, b);` : `cout << ${fn.name}(a, b) << endl;`}`;
        } else if (fn.params.length === 1 && fn.params[0].includes('string')) {
            callAndPrint = `string s; if (!(cin >> s)) s = "test"; ${fn.returnType === 'void' ? `${fn.name}(s);` : `cout << ${fn.name}(s) << endl;`}`;
        } else {
            callAndPrint = 'return 0;';
        }

        return `
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

${code}

int main() {
    ${callAndPrint}
    return 0;
}
`;
    }

    return `#include <iostream>\nusing namespace std;\n${code}\nint main() { return 0; }\n`;
}

async function runCodeLocally(language, code, testInput = '', timeoutMs = 7000) {
    const lang = (language || '').toLowerCase().trim();

    if (lang === 'html' || lang === 'css') {
        return {
            stdout: (code || '').trim(),
            stderr: '',
            code: 0
        };
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aroha-runner-'));

    try {
        let cmd = '';
        let args = [];
        let sourceFile = '';
        let exeFile = '';

        if (lang === 'python' || lang === 'py') {
            sourceFile = path.join(tempDir, 'solution.py');
            fs.writeFileSync(sourceFile, code, 'utf8');
            cmd = getPythonPath();
            args = ['-u', sourceFile];
            return await executeProcess(cmd, args, testInput, timeoutMs, tempDir);
        }

        if (lang === 'javascript' || lang === 'js' || lang === 'node') {
            sourceFile = path.join(tempDir, 'solution.js');
            fs.writeFileSync(sourceFile, code, 'utf8');
            cmd = process.execPath;
            args = [sourceFile];
            return await executeProcess(cmd, args, testInput, timeoutMs, tempDir);
        }

        if (lang === 'c') {
            const processedCode = wrapCCode(code);
            sourceFile = path.join(tempDir, 'solution.c');
            exeFile = path.join(tempDir, 'solution.exe');
            fs.writeFileSync(sourceFile, processedCode, 'utf8');

            const compileRes = await executeProcess('gcc', [sourceFile, '-o', exeFile], '', 10000, tempDir);
            if (compileRes.code !== 0) {
                return {
                    stdout: compileRes.stdout,
                    stderr: compileRes.stderr || 'Compilation failed',
                    code: compileRes.code || 1
                };
            }
            return await executeProcess(exeFile, [], testInput, timeoutMs, tempDir);
        }

        if (lang === 'c++' || lang === 'cpp') {
            const processedCode = wrapCppCode(code);
            sourceFile = path.join(tempDir, 'solution.cpp');
            exeFile = path.join(tempDir, 'solution.exe');
            fs.writeFileSync(sourceFile, processedCode, 'utf8');

            const compileRes = await executeProcess('g++', ['-std=c++11', sourceFile, '-o', exeFile], '', 10000, tempDir);
            if (compileRes.code !== 0) {
                return {
                    stdout: compileRes.stdout,
                    stderr: compileRes.stderr || 'Compilation failed',
                    code: compileRes.code || 1
                };
            }
            return await executeProcess(exeFile, [], testInput, timeoutMs, tempDir);
        }

        if (lang === 'java') {
            return {
                stdout: '',
                stderr: 'Java compiler (javac) is not configured in local PATH. Please use Python, JavaScript, C, or C++.',
                code: 1
            };
        }

        return {
            stdout: '',
            stderr: `Unsupported language: "${language}". Supported languages are Python, JavaScript, C, C++, HTML, CSS.`,
            code: 1
        };
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (_) {}
    }
}

// ─── POST /api/run-code — Execute Code via Native Local Process Runner ───
app.post('/api/run-code', async (req, res) => {
    try {
        const { language, code, testInput, expectedOutput } = req.body;

        if (!code || !language) {
            return res.status(400).json({
                stdout: '',
                stderr: 'language and code are required.',
                code: 1,
                passed: false,
                expectedOutput: null,
                isMatch: false
            });
        }

        const runResult = await runCodeLocally(language, code, testInput);

        const langLower = (language || '').toLowerCase().trim();
        const isHtmlCss = langLower === 'html' || langLower === 'css';
        const normalizeWhitespace = (str) => (str || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

        const checkMatch = (out) => {
            if (expectedOutput === undefined || expectedOutput === null) return true;
            if (isHtmlCss) {
                const normOut = normalizeWhitespace(out);
                const normExp = normalizeWhitespace(String(expectedOutput));
                return (normOut === normExp) || (normOut.replace(/>\s+</g, '><') === normExp.replace(/>\s+</g, '><'));
            }
            return (out || '').trim() === String(expectedOutput).trim();
        };

        const stdoutTrimmed = (runResult.stdout || '').trim();
        const stderrTrimmed = (runResult.stderr || '').trim();
        const exitCode = runResult.code ?? 0;
        const isMatch = checkMatch(stdoutTrimmed);
        const passed = exitCode === 0 && !stderrTrimmed && isMatch;

        return res.json({
            stdout: stdoutTrimmed,
            stderr: stderrTrimmed,
            code: exitCode,
            passed,
            expectedOutput: expectedOutput !== undefined ? String(expectedOutput).trim() : null,
            isMatch
        });
    } catch (err) {
        console.error('❌ Error executing code locally:', err);
        return res.status(500).json({
            stdout: '',
            stderr: `Execution server error: ${err.message}`,
            code: 1,
            passed: false,
            expectedOutput: null,
            isMatch: false
        });
    }
});

// ─── Intelligent Fallback Diagnostic Engine ───
function generateDiagnosticHint(code, error, language) {
    const errLower = (error || '').toLowerCase();

    if (errLower.includes('syntaxerror') || errLower.includes('expected') || errLower.includes('parse error')) {
        return `**Syntax Check**: Check for unclosed parentheses \`()\`, braces \`{}\`, missing semicolons, or mismatched quotes near the flagged lines. Verify that all statements and function declarations are syntactically valid.`;
    }
    if (errLower.includes('indexerror') || errLower.includes('out of bounds') || errLower.includes('segmentation fault') || errLower.includes('arrayindexoutofboundsexception')) {
        return `**Index & Boundary Check**: Your program attempted to access an element outside the valid bounds of an array or string. Inspect loop boundaries (e.g. \`< length\` vs \`<= length\`) and test with empty or 1-element inputs.`;
    }
    if (errLower.includes('typeerror') || errLower.includes('nullpointerexception') || errLower.includes('undefined') || errLower.includes('cannot read propert')) {
        return `**Type & Null Check**: An operation was performed on a variable that might be \`null\`, \`undefined\`, or of an unexpected data type. Ensure variables are properly initialized before accessing their properties or invoking methods.`;
    }
    if (errLower.includes('zerodivision') || errLower.includes('division by zero') || errLower.includes('/ 0')) {
        return `**Zero Division Guard**: A division or modulo operation has a denominator that can evaluate to 0. Add a conditional check to guard against division by zero.`;
    }
    if (errLower.includes('time limit') || errLower.includes('timeout') || errLower.includes('infinite loop')) {
        return `**Termination & Loop Step**: The execution timed out, indicating an infinite loop or high time complexity. Ensure your loop counter or pointer updates toward the termination condition on every single iteration.`;
    }
    if (errLower.includes('indentationerror')) {
        return `**Indentation Consistency**: In Python, mixing tabs and spaces or using inconsistent indentation levels causes an \`IndentationError\`. Verify that all blocks use consistent 4-space indentation.`;
    }

    return `**Logic & Output Format**: Compare your program's stdout against the exact problem statement requirements. Make sure return values, print statements, and edge cases (such as empty or negative numbers) match the specification.`;
}

// ─── Conceptual Starting Hint Generator (Blank Editor) ───
function generateConceptualHint(problemTitle, problemDesc, language) {
    const combinedText = `${problemTitle || ''} ${problemDesc || ''}`.toLowerCase();

    if (combinedText.includes('binary search') || combinedText.includes('sorted array') || combinedText.includes('search insert')) {
        return `**Algorithmic Approach**: Because the collection is ordered, a **Binary Search** approach is ideal. Maintain \`left\` and \`right\` boundary pointers and examine the midpoint on each step to reduce the search interval by half ($O(\\log n)$ time complexity).`;
    }
    if (combinedText.includes('two sum') || combinedText.includes('pair') || combinedText.includes('frequency') || combinedText.includes('count') || combinedText.includes('anagram')) {
        return `**Data Structure Suggestion**: Consider using a **Hash Map / Dictionary** or Hash Set. By mapping elements or their complements as you iterate, you can achieve instant $O(1)$ lookups instead of nested $O(n^2)$ loops.`;
    }
    if (combinedText.includes('palindrome') || combinedText.includes('reverse') || combinedText.includes('reverse string')) {
        return `**Two-Pointer Strategy**: A **Two-Pointer technique** is well suited here. Place one pointer at the start and one at the end of the sequence, compare or swap elements, and increment/decrement pointers inward until they meet.`;
    }
    if (combinedText.includes('stack') || combinedText.includes('parentheses') || combinedText.includes('bracket') || combinedText.includes('valid parentheses')) {
        return `**Data Structure Suggestion**: A **LIFO Stack** is the natural choice for matching enclosing structures. Push opening symbols onto the stack and pop them when matching closing symbols appear, verifying symmetry and emptiness at the end.`;
    }
    if (combinedText.includes('sliding window') || combinedText.includes('subarray') || combinedText.includes('substring')) {
        return `**Algorithmic Technique**: Look into the **Sliding Window** technique. Expand a right-side pointer to include elements into your active window, and contract a left-side pointer when constraint conditions are violated.`;
    }
    if (combinedText.includes('html') || combinedText.includes('css') || combinedText.includes('flexbox') || combinedText.includes('layout')) {
        return `**Layout Architecture**: Start by structuring the semantic container elements. To position items cleanly, consider establishing a flex container (\`display: flex\`) or CSS Grid layout on the parent before fine-tuning margins, padding, and alignments.`;
    }
    if (combinedText.includes('tree') || combinedText.includes('graph') || combinedText.includes('traversal')) {
        return `**Traversal Strategy**: Consider whether **Depth-First Search (DFS)** (using recursion or a stack) or **Breadth-First Search (BFS)** (using a FIFO queue) best fits the exploration order needed for this problem.`;
    }

    return `**Starting Algorithmic Direction**: Start by breaking the problem into three steps: 1) Identify the expected inputs and base edge cases (e.g. empty or 1-item input). 2) Choose an appropriate data structure (like an array or hash map) to maintain state. 3) Iterate systematically while checking your termination condition.`;
}

// ─── POST /api/ai-hint — AI Debugging & Conceptual Hint powered by Google GenAI ───
app.post('/api/ai-hint', async (req, res) => {
    try {
        const { code, error, stdout, language, problemTitle, problemDesc } = req.body;
        const hasCode = typeof code === 'string' && code.trim().length > 0;
        const langStr = language || 'code';
        const problemContext = problemTitle ? `Problem: ${problemTitle}\n${problemDesc ? 'Description: ' + problemDesc : ''}` : '';

        // Case 1: Editor is blank -> Generate high-level starting conceptual hint without code spoilers
        if (!hasCode) {
            if (process.env.GEMINI_API_KEY) {
                try {
                    const conceptualPrompt = `A student is about to solve a programming exercise in ${langStr}. Their code editor is currently blank, and they are asking for a high-level conceptual hint or starting intuition to begin.

${problemContext ? problemContext + '\n\n' : ''}Task:
Provide a high-level starting algorithmic hint (e.g., which data structure, algorithmic paradigm, or logic approach to consider) to help them get started.
CRITICAL INSTRUCTIONS:
1. Do NOT write or reveal the solution code or code snippets.
2. Recommend the general approach or data structure (e.g., two-pointer technique, hash map, sliding window, binary search, recursion, queue/stack, or greedy approach).
3. Explain the problem-solving intuition in 2-4 concise, encouraging sentences.
4. Use markdown formatting with bolding or code backticks where appropriate.`;

                    const response = await ai.models.generateContent({
                        model: 'gemini-3.5-flash-lite',
                        contents: conceptualPrompt,
                        config: {
                            systemInstruction: 'You are an encouraging, expert programming mentor. When a student asks for a hint on a blank editor, you explain the high-level intuition, optimal approach, and helpful data structures without revealing the solution code or giving away code snippets. Keep your hints concise, friendly, and actionable.'
                        }
                    });

                    const hintText = response.text ? response.text.trim() : null;
                    if (hintText) {
                        return res.json({ hint: hintText, type: 'conceptual' });
                    }
                } catch (aiErr) {
                    console.warn('⚠️ Gemini AI Conceptual Hint generation failed, falling back:', aiErr.message);
                }
            }

            // Fallback conceptual hint generator
            const fallbackConceptual = generateConceptualHint(problemTitle, problemDesc, langStr);
            return res.json({ hint: fallbackConceptual, type: 'conceptual' });
        }

        // Case 2: Code exists -> Analyze student's submitted code and error output as usual
        const errorContext = error || (stdout ? `Output received:\n${stdout}` : 'Execution failed or produced incorrect output.');

        // Live Google Gemini AI generation using gemini-2.5-flash / gemini-3.5-flash-lite
        if (process.env.GEMINI_API_KEY) {
            try {
                const prompt = `A student is solving a programming exercise in ${langStr} and their code failed in the execution sandbox.

${problemContext ? problemContext + '\n\n' : ''}Student's Submitted Code:
\`\`\`${langStr.toLowerCase()}
${code}
\`\`\`

Execution Error / Output:
${errorContext}

Task:
Analyze the student's broken code and the error output. Provide a targeted, encouraging, and helpful debugging hint that guides them toward identifying and resolving the issue themselves.
CRITICAL INSTRUCTIONS:
1. Do NOT provide the complete solution or write the corrected code block for them.
2. Point out the specific line, logic flaw, data structure misuse, edge case, or syntax issue they should inspect.
3. Keep the hint concise (2-4 clear sentences).
4. Use markdown formatting with bolding or code backticks where appropriate for clarity.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-3.5-flash-lite',
                    contents: prompt,
                    config: {
                        systemInstruction: 'You are an expert, encouraging programming mentor. You analyze broken student code and error logs, providing targeted diagnostic hints without revealing the full solution code. Keep your feedback concise, actionable, and friendly.'
                    }
                });

                const hintText = response.text ? response.text.trim() : null;
                if (hintText) {
                    return res.json({ hint: hintText, type: 'diagnostic' });
                }
            } catch (aiErr) {
                console.warn('⚠️ Gemini AI Hint generation failed, falling back to diagnostic engine:', aiErr.message);
            }
        }

        // Intelligent Fallback Diagnostic Engine
        const fallbackHint = generateDiagnosticHint(code, errorContext, langStr);
        res.json({ hint: fallbackHint, type: 'diagnostic' });
    } catch (err) {
        console.error('❌ Error generating AI hint:', err);
        res.status(500).json({ error: 'Server error generating hint.' });
    }
});

// ─── POST /api/logout — Clear auth cookie ───
app.post('/api/logout', (req, res) => {
    res.clearCookie('userId');
    res.json({ message: 'Logged out successfully.' });
});

// ─── Helper: HTML Escaping ───
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ─── Helper: Candidate Initials ───
function getCandidateInitials(name) {
    if (!name || typeof name !== 'string') return 'S';
    const clean = name.trim();
    if (!clean) return 'S';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
        return parts[0][0].toUpperCase();
    }
    return 'S';
}

// ─── Render Public Read-Only Portfolio HTML ───
function renderPortfolioHtml(user, completedQuestList, languageScores, selectedSkills) {
    const level = Math.max(1, Math.floor((user.xp || 0) / 1000) + 1);
    const defaultLanguageScores = { 'C': 15, 'C++': 15, 'Python': 15, 'Java': 15, 'JavaScript': 40, 'HTML': 40, 'CSS': 40 };

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(user.name)} - Engineering Portfolio | AROHA</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #050711; color: #f1f5f9; }
    .aurora-glass-card {
      background: linear-gradient(180deg, rgba(20, 26, 48, 0.75) 0%, rgba(13, 17, 34, 0.88) 100%);
      border: 1px solid rgba(255, 255, 255, 0.09);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.6);
    }
    .btn-aurora-purple {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%);
      box-shadow: 0 4px 18px rgba(124, 58, 237, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }
  </style>
</head>
<body class="min-h-screen flex flex-col font-sans relative overflow-x-hidden">
  <!-- Unified Aurora Background Glow Nodes -->
  <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <div class="absolute top-[12%] -left-32 w-[34rem] h-[48rem] bg-gradient-to-r from-[#6d28d9] via-[#7c3aed] to-[#3b82f6] opacity-70 rounded-[45%] blur-[100px] transform rotate-12"></div>
    <div class="absolute -top-16 right-[8%] w-[38rem] h-[22rem] bg-gradient-to-r from-[#a855f7] via-[#818cf8] to-[#06b6d4] opacity-75 rounded-[50%] blur-[95px] transform -rotate-6"></div>
    <div class="absolute top-[28%] -right-24 w-[28rem] h-[34rem] bg-gradient-to-br from-[#e0f2fe] via-[#38bdf8] to-[#2dd4bf] opacity-60 rounded-[50%] blur-[90px]"></div>
    <div class="absolute bottom-[4%] -right-16 w-[26rem] h-[26rem] bg-[#06b6d4]/40 rounded-full blur-[110px]"></div>
  </div>

  <!-- Header -->
  <header class="w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-xl relative z-10 sticky top-0">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
      <a href="/" class="flex items-center space-x-2.5 group">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-400 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow">
          A
        </div>
        <span class="text-base font-black tracking-wider bg-gradient-to-r from-[#22d3ee] via-[#818cf8] to-[#c084fc] bg-clip-text text-transparent">AROHA</span>
        <span class="text-[10px] uppercase font-bold text-teal-300 bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 rounded-full ml-1 hidden sm:inline font-mono">Public Credentials</span>
      </a>

      <div class="flex items-center space-x-3">
        <a href="/login.html" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-bold transition">Log In</a>
        <a href="/signup.html" class="px-4 py-2 rounded-xl btn-aurora-purple text-white text-xs font-bold shadow transition">Build Your Roadmap</a>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6 relative z-10">
    <!-- Hero Profile Card -->
    <div class="aurora-glass-card rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-white/15 shadow-2xl">
      <div class="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">
        <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-teal-400 via-indigo-600 to-purple-600 flex items-center justify-center font-black text-3xl sm:text-4xl text-white shadow-[0_0_25px_rgba(45,212,191,0.4)] border-2 border-white/20 shrink-0">
          ${getCandidateInitials(user.name)}
        </div>
        <div class="space-y-2 flex-1 min-w-0">
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">${escapeHtml(user.name)}</h1>
            <span class="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-full">Level ${level}</span>
            <span class="text-[11px] font-bold bg-[#064e3b]/90 text-[#6ee7b7] border border-emerald-400/40 px-2.5 py-0.5 rounded-full flex items-center shadow-sm">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span> Verified Candidate
            </span>
          </div>
          <p class="text-sm font-semibold text-slate-300 flex items-center justify-center sm:justify-start">
            <i class="fa-solid fa-crosshairs text-teal-400 mr-2"></i>
            <span>Target Role: <strong class="text-white">${escapeHtml(user.target_career || 'Software Engineer')}</strong></span>
          </p>
          <p class="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Verified candidate profile, active learning benchmarks, and code execution milestones audited by the AROHA Skill Calibration Engine.
          </p>
        </div>
      </div>

      <!-- 3 Metrics Bar -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-6 mt-6 border-t border-white/10">
        <div class="bg-slate-950/60 p-4 rounded-2xl border border-white/10 space-y-1 text-center sm:text-left">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center sm:justify-start">
            <i class="fa-solid fa-trophy text-amber-400 mr-1.5"></i> Accumulated XP
          </span>
          <div class="text-2xl font-black text-amber-300 font-mono">${(user.xp || 0).toLocaleString()} <span class="text-xs font-bold text-slate-400">XP</span></div>
        </div>

        <div class="bg-slate-950/60 p-4 rounded-2xl border border-white/10 space-y-1 text-center sm:text-left">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center sm:justify-start">
            <i class="fa-solid fa-gauge-high text-teal-400 mr-1.5"></i> Readiness Score
          </span>
          <div class="text-2xl font-black text-teal-300 font-mono">${user.readiness_score || 0}% <span class="text-xs font-bold text-slate-400">Prepared</span></div>
        </div>

        <div class="bg-slate-950/60 p-4 rounded-2xl border border-white/10 space-y-1 text-center sm:text-left">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center sm:justify-start">
            <i class="fa-solid fa-code text-cyan-400 mr-1.5"></i> Solved Quests
          </span>
          <div class="text-2xl font-black text-emerald-400 font-mono">${completedQuestList.length} <span class="text-xs font-bold text-slate-400">Verified</span></div>
        </div>
      </div>
    </div>

    <!-- Technical Skills & Language Matrix (Left) + Solved Quests History (Right) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Left Column (5 Cols) -->
      <div class="lg:col-span-5 space-y-6">
        <!-- Declared & Verified Skills -->
        <div class="aurora-glass-card rounded-2xl p-5 border border-white/10 space-y-3 shadow-lg">
          <h3 class="text-xs font-bold text-white uppercase tracking-wider flex items-center">
            <i class="fa-solid fa-layer-group text-teal-400 mr-2"></i> Verified Technical Stack
          </h3>
          <div class="flex flex-wrap gap-1.5">
            ${selectedSkills.length > 0 
              ? selectedSkills.map(s => `<span class="text-xs font-medium bg-slate-950/90 text-teal-300 border border-teal-500/30 px-3 py-1 rounded-xl">${escapeHtml(s)}</span>`).join('')
              : '<span class="text-xs text-slate-500 italic">No declared skills logged yet.</span>'
            }
          </div>
        </div>

        <!-- Language Proficiency Matrix -->
        <div class="aurora-glass-card rounded-2xl p-5 border border-white/10 space-y-3.5 shadow-lg">
          <div class="flex justify-between items-center">
            <h3 class="text-xs font-bold text-white uppercase tracking-wider flex items-center">
              <i class="fa-solid fa-chart-simple text-purple-400 mr-2"></i> Verified Language Matrix
            </h3>
            <span class="text-[10px] font-mono text-slate-400">Scale 0 - 100</span>
          </div>

          <div class="space-y-3">
            ${['JavaScript', 'HTML', 'CSS', 'Python', 'Java', 'C++', 'C'].map(lang => {
              const val = Math.min(100, Math.max(0, languageScores[lang] || defaultLanguageScores[lang] || 15));
              return `
                <div class="space-y-1">
                  <div class="flex justify-between text-xs font-semibold">
                    <span class="text-slate-200">${lang}</span>
                    <span class="text-teal-300 font-mono">${val}%</span>
                  </div>
                  <div class="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-white/10 p-[1px]">
                    <div class="h-full rounded-full bg-gradient-to-r from-teal-400 to-indigo-500 transition-all duration-500" style="width: ${val}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Right Column (7 Cols): Completed Quests -->
      <div class="lg:col-span-7 space-y-6">
        <div class="aurora-glass-card rounded-2xl p-6 border border-white/10 space-y-4 shadow-lg flex flex-col justify-between">
          <div class="flex justify-between items-center border-b border-white/10 pb-3">
            <div>
              <h3 class="text-sm font-extrabold text-white flex items-center">
                <i class="fa-solid fa-check-double text-emerald-400 mr-2"></i> Verified Quest Milestones
              </h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Algorithmic arena problems compiled and verified in sandbox.</p>
            </div>
            <span class="text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl font-bold">
              ${completedQuestList.length} Solved
            </span>
          </div>

          <div class="space-y-2.5">
            ${completedQuestList.length > 0 
              ? completedQuestList.map((q) => `
                <div class="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between hover:border-teal-500/30 transition">
                  <div class="flex items-center space-x-3 min-w-0">
                    <div class="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs shrink-0 font-bold">
                      <i class="fa-solid fa-check"></i>
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-white truncate">${escapeHtml(q.name)}</div>
                      <div class="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5">
                        <span class="text-teal-300 font-semibold">${escapeHtml(q.lang)}</span>
                        <span>&bull;</span>
                        <span>Sandbox Executed</span>
                      </div>
                    </div>
                  </div>
                  <span class="font-mono text-xs font-bold text-amber-300 shrink-0 ml-3">+${q.xp} XP</span>
                </div>
              `).join('')
              : `
                <div class="py-12 text-center text-slate-400 space-y-2">
                  <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mx-auto text-lg">
                    <i class="fa-solid fa-laptop-code"></i>
                  </div>
                  <div class="text-xs font-semibold text-slate-300">Baseline Calibration Complete</div>
                  <p class="text-[11px] text-slate-500 max-w-sm mx-auto">Candidate has initialized their profile and is currently progressing through upcoming algorithmic challenges.</p>
                </div>
              `
            }
          </div>
        </div>
      </div>

    </div>
  </main>

  <footer class="w-full text-center py-6 text-xs text-slate-500 border-t border-white/5 relative z-10">
    <p>&copy; 2026 AROHA Platform &bull; Real-time AI-Powered Skill Gaps & Adaptive Roadmaps</p>
  </footer>
</body>
</html>`;
}

// ─── Render 404 Portfolio Not Found HTML ───
function renderNotFoundPortfolio(username) {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Not Found - AROHA</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #050711; color: #f1f5f9; }
    .aurora-glass-card {
      background: linear-gradient(180deg, rgba(20, 26, 48, 0.72) 0%, rgba(13, 17, 34, 0.85) 100%);
      border: 1px solid rgba(255, 255, 255, 0.09);
      backdrop-filter: blur(24px);
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.6);
    }
    .btn-aurora-purple {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%);
    }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-x-hidden">
  <div class="max-w-md w-full aurora-glass-card rounded-3xl p-8 text-center space-y-5 border border-white/15 shadow-2xl relative z-10">
    <div class="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 text-2xl mx-auto shadow-inner">
      <i class="fa-solid fa-user-xmark"></i>
    </div>
    <div class="space-y-1.5">
      <h2 class="text-2xl font-black text-white">Portfolio Not Found</h2>
      <p class="text-xs text-slate-400 leading-relaxed">
        No candidate profile matching <strong class="text-teal-300 font-mono">@${escapeHtml(username)}</strong> exists on the AROHA platform.
      </p>
    </div>
    <div class="pt-2">
      <a href="/" class="inline-block px-6 py-3 rounded-xl btn-aurora-purple text-white text-xs font-bold transition shadow-lg">
        <i class="fa-solid fa-house mr-1.5"></i> Return to AROHA
      </a>
    </div>
  </div>
</body>
</html>`;
}

// ─── GET /p/:username — Public Read-Only Student Portfolio ───
app.get('/p/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            return res.status(404).send(renderNotFoundPortfolio('unknown'));
        }

        const cleanUsername = username.trim().toLowerCase();
        const cookieUserId = req.cookies.userId ? parseInt(req.cookies.userId, 10) : null;

        // Match user by numeric ID, name slug, or fallback to current logged-in user if 'student'
        let query;
        let params;

        if (cleanUsername === 'student' && cookieUserId) {
            query = `
                SELECT id, name, target_career, readiness_score, xp, completed_quests, language_scores, selected_skills
                FROM users
                WHERE id = $1
                LIMIT 1;
            `;
            params = [cookieUserId];
        } else {
            query = `
                SELECT id, name, target_career, readiness_score, xp, completed_quests, language_scores, selected_skills
                FROM users
                WHERE CAST(id AS TEXT) = $1
                   OR LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) = LOWER(REGEXP_REPLACE($1, '[^a-zA-Z0-9]', '', 'g'))
                   OR LOWER(name) = LOWER($1)
                   OR ($1 = 'student' AND id IN (SELECT id FROM users ORDER BY xp DESC LIMIT 1))
                ORDER BY id ASC
                LIMIT 1;
            `;
            params = [cleanUsername];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).send(renderNotFoundPortfolio(username));
        }

        const user = result.rows[0];

        // Parse completed quests & language scores
        let completedQuests = user.completed_quests;
        if (typeof completedQuests === 'string') {
            try { completedQuests = JSON.parse(completedQuests); } catch(e) { completedQuests = []; }
        }
        if (!Array.isArray(completedQuests)) completedQuests = [];

        let languageScores = user.language_scores;
        if (typeof languageScores === 'string') {
            try { languageScores = JSON.parse(languageScores); } catch(e) { languageScores = {}; }
        }
        if (!languageScores || typeof languageScores !== 'object') languageScores = {};

        let selectedSkills = user.selected_skills;
        if (typeof selectedSkills === 'string') {
            try { selectedSkills = JSON.parse(selectedSkills); } catch(e) { selectedSkills = []; }
        }
        if (!Array.isArray(selectedSkills)) selectedSkills = [];

        // Load quest names from questions.json to display completed quest titles
        let arenasMap = {};
        try {
            const qData = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
            if (Array.isArray(qData.arenas)) {
                qData.arenas.forEach(a => { arenasMap[a.id] = a; });
            }
        } catch (_) {}

        const completedQuestList = completedQuests.map((q) => {
            const qId = typeof q === 'object' ? (q.id || q.quest_id) : Number(q);
            const arena = arenasMap[qId];
            return {
                name: arena ? arena.title : (typeof q === 'object' ? (q.quest_name || q.title) : `Quest #${q}`),
                lang: arena ? arena.lang : 'General',
                xp: arena ? arena.xp : 100
            };
        });

        const html = renderPortfolioHtml(user, completedQuestList, languageScores, selectedSkills);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (err) {
        console.error('❌ Error rendering public portfolio:', err);
        res.status(500).send('Internal server error loading portfolio');
    }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running live at http://localhost:${PORT}`);
    });
}

module.exports = app;