# cvgen

> A developer-focused CV builder. Write your CV like a README, export it as a PDF.

```
# Your Name
Software Engineer

you@example.com
github.com/you
════════════════════════════════════════════════════════════

## Experience
────────────────────────────────────────────────────────
├─ 2022–present  Senior Engineer @ Acme Corp
│                Led distributed caching project (Go, Redis).
│
└─ 2019–2022     Engineer @ Beta Ltd
                 Full-stack dev. Owned CI/CD migration.
```

## Features

- Live preview — dark, monospace, GitHub README aesthetic
- Vertical and horizontal ASCII timelines for experience/education
- Photo → ASCII art conversion (JPG/JPEG only)
- Drag-and-drop section reordering
- Add/delete sections (experience, education, skills, projects, photo, custom)
- Style panel — swap presets (GitHub Dark, GitHub Light, Dracula, Nord), change font, size, colors
- Export to PDF — preserves your exact style and dark background
- State persisted to localStorage — no account, no backend

## Stack

- [Next.js 16](https://nextjs.org/) — framework + API routes
- [Zustand](https://github.com/pmndrs/zustand) — state management
- [dnd-kit](https://dndkit.com/) — drag and drop
- [Puppeteer](https://pptr.dev/) — PDF export
- [Sharp](https://sharp.pixelplumbing.com/) — image processing for ASCII art
- [Tailwind CSS v4](https://tailwindcss.com/) — editor UI

## Getting started

**Requirements:** Node.js 18+, npm

```bash
git clone https://github.com/YOUR_USERNAME/cvgen.git
cd cvgen
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional fonts

The style panel includes options for Monaspace Neon, Fira Code, JetBrains Mono, and Cascadia Code.
These must be installed on your system to take effect.

```bash
# macOS
brew install font-monaspace font-fira-code font-jetbrains-mono
```

## Usage

| Panel | What it does |
|---|---|
| **Sections** tab | Add, delete, reorder sections via drag-and-drop |
| **Meta** tab | Edit name, title, links, upload profile photo |
| **Style** tab | Change preset, font, font size, colors |
| **Editor** (center) | Edit selected section content in markdown-like format |
| **Preview** (right) | Live CV preview |
| **Export PDF** | Downloads a PDF matching the current style |

### Timeline format

For `vertical` and `horizontal` layouts in experience/education sections:

```
### Role @ Company | Period
Description of what you did.

### Another Role @ Company | Period
More description.
```

### Photo

Upload a JPG/JPEG in the **Meta** tab (appears top-right of the CV header) or add a **Photo** section.
Use the width/height sliders to control the ASCII art size.

## License

MIT
