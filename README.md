# 📚 KayApp — Smart Student Planner & Learning Path

> *“Kaya mo ’yan. May plano ka na.”*

KayApp is a modern, student-centric web application designed to help learners organize their academic workload, manage subjects and topics, track study sessions, and discover optimal, prerequisite-aware learning paths. 

Built with performance, accessibility, and a calm, encouraging aesthetic in mind.

---

## 🚀 Tech Stack & Architecture

- **Frontend:** React, Vite, Tailwind CSS
- **Icons:** `lucide-react`
- **Routing:** React Router DOM
- **Backend & Database:** Supabase Auth & PostgreSQL with Row Level Security (RLS)[cite: 14]

---

## ✨ Core Features

- **🎯 Smart Landing Page & Interactive Previews:** Fully responsive public-facing presentation with an interactive learning path simulator and task tracker mock.
- **🔐 Secure Authentication:** Seamless Supabase Auth integration supporting secure sign-up, login, password recovery via OTP, and protected workspace routing.
- **🛡️ Row Level Security (RLS):** Database-level security policies ensuring students' tasks, subjects, and topics are strictly isolated and private to their accounts[cite: 14].
- **📅 Study Planner & Subject Tracker:** Organize daily tasks, track completion percentages, and manage subjects with structured sub-topics[cite: 14].
- **🧠 Core Graph Algorithms:** 
  1. **Topological Sort** — Order study topics correctly based on prerequisites[cite: 14].
  2. **Dijkstra's Algorithm** — Find the lowest-cost learning path using non-negative edge weights (time/effort)[cite: 14].
  3. **Breadth-First Search (BFS)** — Explore connected and reachable topics level-by-level[cite: 14].
- **🌗 Dynamic Appearance Toggle:** Smooth light and dark mode switching conforming to strict brand hues (Navy `#173761` and Gold `#F5B82E`)[cite: 14].

---

## 🎨 Design System Highlights

KayApp follows a strict design blueprint (`DESIGN.md`)[cite: 16]:
* **Brand Hues:** Deep Navy (`#173761`) for stability/trust, and Warm Gold (`#F5B82E`) for energy/progress accents[cite: 16].
* **Neutrals:** Cream background (`#FAFAF7`) paired with clean slate typography[cite: 16].
* **Accessibility:** High-contrast text configurations, visible focus rings, full keyboard accessibility, and `prefers-reduced-motion` compliance[cite: 16].

---

## 🛠️ Local Development Setup

Follow these steps to run KayApp locally on your machine:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/sho-tiii/KayApp.git](https://github.com/sho-tiii/KayApp.git)
   cd kayapp