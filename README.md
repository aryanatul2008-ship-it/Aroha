# AROHA — AI-Powered Skill-Gap & Learning Platform

Pinpoint exact technical deficiencies, bridge skill gaps, and master software engineering with AI-driven adaptive roadmaps and live algorithmic arenas.

<details>
<summary><b>📑 Table of Contents (Click to Expand)</b></summary>

- [🌟 Key Features](#-key-features)
- [🏗️ System Architecture](#️-system-architecture)
  - [Visual Block Diagram](#visual-block-diagram)
  - [Interactive Mermaid Flowchart](#interactive-mermaid-flowchart)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Getting Started](#-getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Run the Application](#4-run-the-application)
- [📄 License](#-license)

</details>

---

## 🌟 Key Features

* **🧭 Career Compass & Dynamic Roadmaps:** Custom week-by-week learning curricula dynamically generated for your target career role (Frontend, Backend, Embedded Systems, Data Analysis, DevOps) powered by Google Gemini AI.
* **⚡ Algorithmic Arenas & Micro-Quests:** 21 hands-on coding challenges across 7 core programming languages (C++, C, Python, Java, JavaScript, HTML, and CSS).
* **🧪 Multi-Language Code Sandbox:** Run and test solutions in isolated environments with `stdout`, `stderr`, and strict whitespace normalization verification.
* **🤖 Dual-Mode AI Mentor:**
  * *Conceptual Guidance:* High-level starting intuitions, data structures, and algorithmic strategies when your editor is blank without giving away code spoilers.
  * *Targeted Diagnostics:* Pinpoints logic flaws, edge cases, and runtime exceptions in student submissions.
* **💼 Live Industry Job Matching:** Real-time compatibility matching against active software engineering roles stored in PostgreSQL.
* **🏆 Global Peer Leaderboard:** Live student rankings based on accumulated XP, quest completions, and verified skill competencies.
* **🌐 Public Shareable Portfolios:** Unique read-only student portfolio showcase (`/p/:username`) highlighting role readiness, completed arenas, and verified languages.
* **🎨 Cyber-Aurora Design System:** High-saturation obsidian canvas (`#050711`), frosted glassmorphism, circular telemetry gauges, and Chart.js vertical gradients.

---

## 🏗️ System Architecture

### Visual Block Diagram

```text
+-------------------------------------------------------------------------+
|                        CLIENT LAYER (Frontend)                          |
|  HTML5 / Vanilla JS / Tailwind CSS (#050711) / Chart.js / FontAwesome   |
|  [Dashboard]  [Coding Arena]  [Career Compass]  [Public Portfolio /p/*] |
+------------------------------------+------------------------------------+
                                     |
                        HTTP / REST API (JSON)
                        Cookie-Based Auth Session
                                     |
                                     v
+-------------------------------------------------------------------------+
|                      APPLICATION LAYER (Backend)                        |
|                    Node.js + Express 5 (server.js)                      |
|   [Auth & Bcrypt OTP]   [Roadmap & Hint Controller]   [Sandbox Runner]  |
+----------+---------------------------+---------------------------+------+
           |                           |                           |
           | SQL Pool (pg)             | @google/genai SDK         | child_process
           v                           v                           v
+---------------------+     +---------------------+     +-----------------+
|   DATA PERSISTENCE  |     |   AI INTELLIGENCE   |     |  LOCAL SANDBOX  |
|     PostgreSQL      |     |  Gemini 2.5 Flash   |     | Multi-Compiler  |
| (Arohaengine_db)    |     |  - Custom Roadmaps  |     | - Python / Node |
| - Users & XP        |     |  - Dual AI Mentor   |     | - GCC / G++     |
| - JSONB Matrices    |     |    (Hints & Debug)  |     | - HTML/CSS Norm |
| - Job Listings      |     +---------------------+     +-----------------+
+---------------------+
