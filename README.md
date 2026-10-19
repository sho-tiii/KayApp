# 📚 KayApp — Smart Student Planner & Learning Path

> *“Kaya mo ’yan. May plano ka na.”*

KayApp is a modern, student-centric web application designed to help learners organize their academic workload, manage subjects and topics, track study sessions, and discover optimal, prerequisite-aware learning paths. 

Built with performance, accessibility, and a calm, encouraging aesthetic in mind.

---

## 🚀 Tech Stack & Architecture

- **Frontend:** React, Vite, Tailwind CSS
- **Icons:** `lucide-react`
- **Routing:** React Router DOM
- **Backend & Database:** Supabase Auth & PostgreSQL with Row Level Security (RLS)

---

## ✨ Core Features

- **🎯 Smart Landing Page & Interactive Previews:** Fully responsive public-facing presentation with an interactive learning path simulator and task tracker mock.
- **🔐 Secure Authentication:** Seamless Supabase Auth integration supporting secure sign-up, login, password recovery via OTP, and protected workspace routing.
- **🛡️ Row Level Security (RLS):** Database-level security policies ensuring students' tasks, subjects, and topics are strictly isolated and private to their accounts
- **📅 Study Planner & Subject Tracker:** Organize daily tasks, track completion percentages, and manage subjects with structured sub-topics
- **🧠 Core Graph Algorithms:** 
  1. **Topological Sort** — Order study topics correctly based on prerequisites
  2. **Dijkstra's Algorithm** — Find the lowest-cost learning path using non-negative edge weights (time/effort)
  3. **Breadth-First Search (BFS)** — Explore connected and reachable topics level-by-level
- **🌗 Dynamic Appearance Toggle:** Smooth light and dark mode switching conforming to strict brand hues (Navy `#173761` and Gold `#F5B82E`)

---

## 🎨 Design System Highlights

KayApp follows a strict design blueprint (`DESIGN.md`)[cite: 16]:
* **Brand Hues:** Deep Navy (`#173761`) for stability/trust, and Warm Gold (`#F5B82E`) for energy/progress accents
* **Neutrals:** Cream background (`#FAFAF7`) paired with clean slate typography
* **Accessibility:** High-contrast text configurations, visible focus rings, full keyboard accessibility, and `prefers-reduced-motion` compliance

---