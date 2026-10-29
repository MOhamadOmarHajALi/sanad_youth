# 🌟 Sanad Youth Platform - Backend API

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma">
</p>

Backend API متكامل وعالي الأداء لمنصة **"سَنَد الشبابية" (Sanad Youth)**. تم بناء النظام بمعايير هندسية متقدمة لضمان الأمان، الموثوقية، والقدرة على التعامل مع الضغط العالي وإدارة المقاعد بدقة تامة دون حدوث تضارب في البيانات.

---

## 🚀 أبرز الميزات التقنية (Key Features)

- **🔐 نظام مصادقة وجلسات متطور (Auth & Sessions):**
  - اعتماد JWT مع فصل الـ `Access Token` (قصير المدى - 15 دقيقة) عن الـ `Refresh Token` (طويل المدى - 7 أيام).
  - جدول تتبع الجلسات (`Session Table`) في قاعدة البيانات مع دعم الإبطال الفوري لجلسة المستخدم عند تسجيل الخروج (`ActiveSessionGuard`).
- **🛡️ التحكم في الصلاحيات (RBAC):**
  - حراس أمان مخصصين (`Guards`) للتحقق من الأدوار والمستويات (`ADMIN`, `INSTRUCTOR`, `YOUTH`).
- **⚡ معالجة التزامن لحجز المقاعد (Concurrency & Race Condition Control):**
  - استخدام **Prisma Transactions** مع قفل الصفوف (`FOR UPDATE`) لضمان عدم حجز "المقعد الأخير" من قِبل أكثر من مستخدم في نفس الميلي ثانية.
- **📂 هندسة معيارية (Modular Architecture):**
  - مقسم بوضوح إلى موديولات مستقلة وقابلة للتوسع (Auth, Programs, Applications, Materials, Announcements).
- **✅ التحقق من البيانات (Validation):**
  - استخدام `class-validator` و `class-transformer` لفلترة وحماية كافة البيانات القادمة من الـ Request.

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

- **Framework:** [NestJS](https://nestjs.com/) (Node.js progressive framework)
- **Language:** TypeScript
- **Database ORM:** [Prisma ORM](https://www.prisma.io/)
- **Database:** PostgreSQL
- **Security:** Passport.js, JWT, bcrypt, class-validator

---

## 📁 هيكلية المشروع (Project Structure)

```text
src/
├── auth/             # المصادقة، تسجيل الدخول، الجلسات، واستراتيجيات JWT
├── programs/         # إدارة البرامج التدريبية وتفاصيلها
├── applications/     # نظام التقديم وحجز المقاعد (مع حماية Race Condition)
├── materials/        # إدارة المواد التعليمية والصلاحيات المرتبطة بها
├── announcements/    # نظام الإعلانات العامة والخاصة بالبرامج
├── prisma/           # خدمة الاتصال بقاعدة البيانات المشتركة
└── main.ts           # نقطة الإقلاع وتفعيل ValidationPipe