# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

| Purpose | Command |
|---------|---------|
| Install dependencies | `npm i` |
| Start development server (Vite + React) | `npm run dev` |
| Build production bundle | `npm run build` |
| Lint & type‑check | `npm run lint` |
| Run all tests | `npm test` |
| Run a single Jest test file | `npm test -- <path/to/file.test.tsx>` |

> **Tip:** The repository uses Vite with TypeScript, React, Tailwind CSS, and shadcn‑ui. All scripts are defined in `package.json`.

## High‑Level Architecture

1. **Entry Point**
   - `src/index.tsx` renders the root `<App />` component into `#root`.
   - Styles are loaded from `index.css`, which imports Tailwind utilities.

2. **Core UI Components**
   - `src/components/ui/` contains a collection of shadcn‑ui primitives (button, card, modal, etc.).
   - These components provide consistent styling and accessibility across the app.

3. **Feature Components**
   - Located in `src/components/`.
   - Examples:
     * `AppSidebar.tsx` – navigation sidebar.
     * `ChatBar.tsx` – input area for chat messages.
     * `Dashboard.tsx`, `HITLDrawer.tsx` – main content areas.

4. **Hooks & Utilities**
   - Custom hooks in `src/hooks/` (e.g., `use-mobile.tsx`, `use-toast.ts`).
   - Utility functions in `src/lib/utils.ts`.

5. **Routing & Navigation**
   - The app uses React Router (implicitly via shadcn‑ui’s navigation menu).
   - `NavLink.tsx` wraps router links for consistent styling.

6. **State Management**
   - Global state is handled with React Context and the `useToast` hook; no external store like Redux is used.

7. **Testing**
   - Tests are written with Jest and React Testing Library under the same component directories (`*.test.tsx`).
   - The repository follows standard testing conventions for shadcn‑ui components.

## Key Files to Understand Early
- `package.json` – scripts, dependencies, devDependencies.
- `vite.config.js` – Vite configuration (aliases, plugins).
- `src/index.tsx`, `src/App.tsx` – bootstrapping and top‑level layout.
- `src/components/ui/*` – foundational UI primitives.
- `src/components/AppSidebar.tsx` – main navigation logic.

These files give a concise view of how the app is structured, how components are composed, and where to find shared utilities.

---

*This CLAUDE.md was generated based on the current repository layout and README information. If you discover new scripts or architectural changes, update this file accordingly.*