# cvgen

> A developer-focused CV builder. Write your CV like a README, export it as a PDF.

```
# Your Name
Software Engineer

you@example.com · github.com/you · City, Country
════════════════════════════════════════════════════════════

## Experience
────────────────────────────────────────────────────────────
├─ 2022–present
│  Senior Engineer @ Acme Corp
│
│  Led distributed caching project with Go and Redis.
│  Owned backend infrastructure team.
│
└─ 2019–2022
   Engineer @ Beta Ltd

   Full-stack development with React and Node.js.
```

## Features

- **Live preview** — dark monospace aesthetic, styled like a GitHub README
- **ASCII timelines** — vertical tree (`├─ / └─`) or horizontal for experience & education
- **JSON render mode** — render the whole CV or individual sections as a syntax-highlighted `.json` file
- **Per-section color overrides** — collapsible Colors panel per section, each token resettable to global
- **Semantic color tokens** — heading, subtitle, period, role, company, category, project title — separate from base palette
- **Style presets** — GitHub Dark, GitHub Light, Dracula, Nord; fully customisable
- **Photo → ASCII art** — upload a JPG/PNG/WebP, get ASCII art in the header or a dedicated section
- **Drag-and-drop** section reordering
- **Section types** — experience, education, skills, projects, photo, personal, custom
- **Projects section** — parses `Stack: item1, item2` into a structured array in JSON mode
- **EuroPass import** — drop a EuroPass SkillsPassport XML or PDF; all sections, photo, and links extracted automatically
- **Dynamic links** — `meta.links[]` replaces the old GitHub / LinkedIn / Website fields; unlimited labelled links in the header
- **Mobile-responsive** — bottom tab navigation (Edit / Meta / Preview) on small screens
- **Scaled preview** — preview zooms to fit any screen width while preserving the exact PDF layout
- **PDF export** — prints with correct per-page margins, preserving background color
- **No account, no backend** — state persisted to `localStorage`

## Stack

| Package | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) | Framework + API routes |
| [React 19](https://react.dev/) | UI |
| [Zustand 5](https://github.com/pmndrs/zustand) | Persisted state |
| [dnd-kit](https://dndkit.com/) | Drag-and-drop section reordering |
| [Sharp](https://sharp.pixelplumbing.com/) | Server-side image processing for ASCII art |
| [Tailwind CSS v4](https://tailwindcss.com/) | Editor UI styling |
| [@vercel/analytics](https://vercel.com/analytics) | Usage analytics |

PDF export uses the browser's native print API (`window.print()`). No Puppeteer required.

## Getting started

**Requirements:** Node.js 18+, npm

```bash
git clone https://github.com/sudokku/cvgen.git
cd cvgen
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional fonts

The style panel includes Monaspace Neon, Fira Code, JetBrains Mono, and Cascadia Code.
These must be installed on your system to render.

```bash
# macOS (Homebrew)
brew install font-monaspace font-fira-code font-jetbrains-mono font-cascadia-code
```

## Layout

The app has three panels on desktop, and a tabbed layout on mobile.

| Area | Purpose |
|---|---|
| **Left sidebar — Sections tab** | Add, delete, reorder sections via drag-and-drop |
| **Left sidebar — Meta tab** | Name, title, email, phone, location, links, profile photo |
| **Left sidebar — Style tab** | Preset, font, font size, base colors, semantic colors, JSON colors, render mode |
| **Left sidebar — Import tab** | EuroPass XML or PDF import |
| **Center — Editor** | Edit the selected section's content, layout, render mode, and per-section color overrides |
| **Right — Preview** | Live CV preview, Export PDF button |

## Content formats

### Timeline (experience / education)

Set the section layout to `vertical` or `horizontal` in the Editor panel.

```
### Role @ Company | Period
Description of what you did.
Second line of description.

### Another Role @ Company | Period
More description here.
```

Each entry renders as an ASCII tree in the preview:

```
├─ 2022–present
│  Senior Engineer @ Acme Corp
│
│  Led distributed caching project.
│
└─ 2019–2022
   Engineer @ Beta Ltd

   Full-stack development.
```

Set layout to `list` to render as plain markdown instead.

### Skills

```
Languages:   TypeScript · Go · Python · Rust
Frameworks:  Next.js · React · Gin · FastAPI
Infra:       Docker · Kubernetes · AWS · Terraform
```

Category labels (`Languages:`, `Frameworks:`, etc.) are coloured with the `category` semantic token.
In JSON render mode, each category becomes a key with an array of values.

### Personal Information

A `personal` section type renders key-value pairs (date of birth, nationality, gender, etc.).
It is automatically created when importing a EuroPass document that includes demographics.

```
Date of birth: 15 Jun 1990
Nationality:   German
Gender:        Male
```

### Projects

```
### Project Name
Brief description of what you built. Stack: TypeScript, React, Node.js
```

In JSON render mode, `Stack:` is parsed out and rendered as a separate array:

```json
{
  "name": "Project Name",
  "description": "Brief description of what you built.",
  "stack": ["TypeScript", "React", "Node.js"]
}
```

### Inline markdown

Plain content sections support `**bold**` and `` `code` `` inline formatting.
`### ` headings, `## ` headings, and `# ` headings are also rendered with appropriate weight.

## Render mode

Set document-wide in the **Style tab**:

| Mode | Behaviour |
|---|---|
| `md` | All sections rendered as markdown-style plain text |
| `json` | Entire CV rendered as a syntax-highlighted JSON document |
| `per-section` | Each section independently toggles between `md` and `json` in the Editor |

## EuroPass import

Drop a EuroPass SkillsPassport file onto the **Import** tab (desktop sidebar) or the **Import** sub-tab under Meta (mobile).

| Format | How it works |
|---|---|
| `.xml` | Parsed entirely in the browser — no server round-trip |
| `.pdf` | Sent to `/api/import` (Node.js route); embedded XML is extracted from the PDF binary and returned to the client, then parsed the same way as a plain XML upload |

What is imported:

| EuroPass field | Maps to |
|---|---|
| Name, headline, email, phone, address | `meta` fields |
| WebsiteList | `meta.links[]` — labelled links (GitHub, LinkedIn, etc. auto-detected) |
| Photo (base64) | `meta.photoUrl`, displayed in the CV header |
| ProfileSummary | `custom` section — "Summary" |
| Demographics (birthdate, nationality, gender) | `personal` section — "Personal Information" |
| WorkExperienceList | `experience` section, vertical timeline layout |
| EducationList | `education` section, vertical timeline layout |
| Languages + ComputerSkills | `skills` section |
| Communication / Organisational / JobRelated skills | `custom` section — "Soft Skills" |
| AchievementList | one section per achievement code; `projects` type if code is "Projects", otherwise `custom` |

Your current theme and color settings are preserved on import.

Imported HTML in description fields (lists, bold, italic) is converted to Markdown.

## Links

`meta.links[]` is an array of `{ label: string; url: string }` objects. They appear in the CV header after the email address.

The **Meta** tab has a dynamic links editor: click **+ add** to add a new entry, edit the label and URL inline, and click **×** to remove.

CVs created before this feature was added may have the old `github`, `linkedin`, and `website` fields. The Meta tab detects these and shows a one-click **Migrate to links list** button.

## Style system

### Presets

Four built-in presets (GitHub Dark, GitHub Light, Dracula, Nord). Selecting a preset sets all color tokens at once.

### Base colors

`background`, `text`, `muted`, `accent / link`, `border`, `code bg`

### Semantic colors

Applied to specific content elements in both `md` and `json` render modes:

| Token | Applied to |
|---|---|
| `heading` | `## Section Title` headings |
| `subtitle` | Section subtitle line |
| `period` | Timeline period tokens (e.g. `2022–present`) |
| `role / degree` | Job titles, degree names |
| `company` | Company and institution names |
| `category` | Skills category labels |
| `project title` | Project names |

### JSON colors

`key`, `string`, `number`, `punctuation` — only shown when render mode includes JSON.

### Per-section color overrides

Each section has a collapsible **Colors** panel in the Editor. Any of the semantic tokens plus `text`, `muted`, and `accent` can be overridden per section. Overridden labels appear in blue; click `×` to reset an individual token or `reset all to global` to clear all overrides.

## Photo / ASCII art

- Upload a JPG/PNG/WebP in the **Meta** tab — appears top-right of the CV header
- Or add a **Photo** section for a full-width ASCII block
- Use the width/height sliders to control ASCII art dimensions
- The aspect ratio is preserved automatically
- Toggle between `ascii` and `image` render mode per photo

## PDF export

Two export options are available from the preview panel:

### Quick Print (browser native)

Click **Quick Print**. The browser print dialog opens with:

- `@page { margin: 0 }` — no browser-added headers or footers
- `box-decoration-break: clone` — the CV's padding is repeated at every page break, giving consistent gutters on multipage CVs
- Background color is preserved via `-webkit-print-color-adjust: exact`

### Export PDF (puppeteer pipeline)

Click **Export PDF**. This sends the CV to the server, which generates the PDF server-side and embeds rich metadata:

1. CV JSON is `POST`ed to `/api/pdf`
2. The route caches the CV and launches a headless Puppeteer browser
3. Puppeteer navigates to the internal `/print` page (not indexed by robots), which renders the full CV with JSON-LD and Open Graph metadata tags
4. Puppeteer captures an A4 PDF with background colors preserved
5. [`pdf-lib`](https://pdf-lib.js.org/) post-processes the PDF:
   - Sets standard PDF document info (title, author, subject, keywords)
   - Injects an XMP metadata stream with Dublin Core + a custom `cvgen:` namespace
   - Attaches `cv-metadata.json` as an embedded file — a [schema.org/Person](https://schema.org/Person) JSON-LD document mapping experience → `hasOccupation`, education → `alumniOf`, skills → `knowsAbout`
6. The enriched PDF is returned as a file download

The exported PDF is machine-readable: any tool that can extract PDF attachments or XMP will find structured CV data inside it.

**Requirements:** `puppeteer` must be installed (`npm install puppeteer`). If it is not available the route returns a 500 with a hint to fall back to Quick Print.

## Testing

```bash
npm test
# or
npx vitest run
```

Tests use [Vitest](https://vitest.dev/) + jsdom. Config is in `vitest.config.ts`; test files live under `src/__tests__/`.

## License

MIT
