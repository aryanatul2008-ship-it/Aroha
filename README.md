# AROHA — AI-Powered Skill-Gap & Learning Platform

<p align="center">
  <b>Pinpoint exact technical deficiencies, bridge skill gaps, and master software engineering with AI-driven adaptive roadmaps and live algorithmic arenas.</b>
</p>

---

## 🌟 Key Features

- **🧭 Career Compass & Dynamic Roadmaps**: Custom week-by-week learning curricula dynamically generated for your target career role (Frontend, Backend, Embedded Systems, Data Analysis, DevOps) powered by Google Gemini AI.
- **⚡ Algorithmic Arenas & Micro-Quests**: 21 hands-on coding challenges across 7 core programming languages (**C++**, **C**, **Python**, **Java**, **JavaScript**, **HTML**, and **CSS**).
- **🧪 Multi-Language Code Sandbox**: Run and test solutions in isolated environments with stdout, stderr, and strict whitespace normalization verification.
- **🤖 Dual-Mode AI Mentor**:
  - **Conceptual Guidance**: High-level starting intuitions, data structures, and algorithmic strategies when your editor is blank without giving away code spoilers.
  - **Targeted Diagnostics**: Pinpoints logic flaws, edge cases, and runtime exceptions in student submissions.
- **💼 Live Industry Job Matching**: Real-time compatibility matching against active software engineering roles stored in PostgreSQL.
- **🏆 Global Peer Leaderboard**: Live student rankings based on accumulated XP, quest completions, and verified skill competencies.
- **🌐 Public Shareable Portfolios**: Unique read-only student portfolio showcase (`/p/:username`) highlighting role readiness, completed arenas, and verified languages.
- **🎨 Cyber-Aurora Design System**: High-saturation obsidian canvas (`#050711`), frosted glassmorphism, circular telemetry gauges, and Chart.js vertical gradients.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express 5, Google GenAI SDK (`@google/genai`)
- **Database**: PostgreSQL with connection pooling (`pg`)
- **Security & Auth**: Bcrypt password hashing, HTTP-only cookie sessions
- **Frontend**: Modern Vanilla JS, Tailwind CSS, Chart.js, FontAwesome
- **Code Execution**: Local sandbox execution engine supporting multi-compiler toolchains

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/aryanatul2008-ship-it/Aroha.git
cd Aroha
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your PostgreSQL database credentials and Google Gemini API key:
```env
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=Arohaengine_db
DB_PASSWORD=your_password
DB_PORT=5432
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Run the application
```bash
npm run dev
# or: node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📄 License
ISC License &copy; 2026 AROHA Platform.