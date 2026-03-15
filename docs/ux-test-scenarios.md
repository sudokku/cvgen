# cvgen — Manual Browser UX Test Scenarios

30 scenarios covering editor interactions, PDF export, print page metadata, import flow, style/theme switching, and photo upload.

---

## Meta Editor

### 1. Basic field entry reflects in preview
**Steps:**
1. Open http://localhost:3000
2. Click the "Meta" tab in the left sidebar
3. Type a name, title, and email

**Expected:** Preview updates in real time — name in header, title beneath it, email in contact line.

---

### 2. Add and remove a link
**Steps:**
1. Open the "Meta" tab
2. Click "+ add" next to the Links heading
3. Type `GitHub` in Label and `https://github.com/testuser` in URL
4. Confirm link appears in preview
5. Click × next to the link row

**Expected:** Link appears in preview after entry. Clicking × removes it immediately; preview no longer shows it.

---

### 3. Legacy field migration prompt
**Steps:**
1. Open DevTools → Application → Local Storage
2. Inject `"github": "testuser"` into the `cv.meta` object in the Zustand store key
3. Reload the page and open the "Meta" tab

**Expected:** Yellow warning box: "Legacy GitHub / LinkedIn / Website fields detected." with a "Migrate to links list" button. Clicking converts old fields into a proper link row and removes the warning.

---

## Section List

### 4. Add a new section
**Steps:**
1. Click the "Sections" tab
2. Click "[exp] Experience" in the "Add section" grid

**Expected:** New "Experience" section appears in list with `[exp]` icon. Preview adds an empty Experience heading.

---

### 5. Delete a section
**Steps:**
1. Add a section if none exists
2. Hover over a section row
3. Click the ✕ button that appears on hover

**Expected:** Section removed from list immediately. Preview no longer shows it.

---

### 6. Drag to reorder
**Steps:**
1. Ensure at least two sections exist
2. Grab the ⠿ drag handle on a section row and drag above/below another row
3. Release

**Expected:** Section order changes in list and preview. Cursor changes to grabbing hand while dragging.

---

## Section Editor

### 7. Edit section title
**Steps:**
1. Click any section in the sidebar
2. Change the Title field in the center editor panel

**Expected:** Section heading in preview updates instantly.

---

### 8. Timeline layout switching
**Steps:**
1. Add or select an Experience section
2. Paste: `### Senior Engineer @ ACME Corp | 2022–2024\nBuilt systems.`
3. Click "vertical", then "horizontal", then "list" in the Layout row

**Expected:**
- Vertical: ASCII tree connectors (├─, └─, │)
- Horizontal: `[period]─────[period]` style
- List: flat text without connectors

---

### 9. Per-section color override
**Steps:**
1. Select any section
2. Expand the "Colors" panel in SectionEditor
3. Change the heading color swatch to bright red
4. Click the × reset button next to heading color

**Expected:** After step 3, only that section's heading turns red. After step 4, color reverts to global theme; blue dot indicator disappears.

---

### 10. Render mode toggle (per-section)
**Steps:**
1. Open "Style" tab → set Render Mode to "per-section"
2. Select a section
3. Toggle the Render button between "md" and "json"

**Expected:** Render row only visible in per-section mode. "json" renders syntax-highlighted JSON; "md" restores markdown.

---

## Style Editor

### 11. Apply a preset
**Steps:**
1. Click the "Style" tab
2. Click "github-light" preset button
3. Click "dracula" preset button

**Expected:** Each click immediately repaints preview colors. Color hex inputs update to reflect new values.

---

### 12. Font size slider
**Steps:**
1. Open the "Style" tab
2. Drag the Size slider to the far right (18 px) then far left (10 px)

**Expected:** Preview text scales accordingly. Label reads "Size — 18px" / "Size — 10px".

---

### 13. Font family picker
**Steps:**
1. Open the "Style" tab
2. Change the Font dropdown to "Courier New"

**Expected:** Preview re-renders in selected font immediately.

---

### 14. Render mode — md / json / per-section
**Steps:**
1. Click "json" in the Render Mode row
2. Click "md"
3. Click "per-section"

**Expected:** "json" shows all content as syntax-colored JSON. "md" restores normal preview. "per-section" enables per-section render toggles inside SectionEditor.

---

## Photo Upload

### 15. Photo upload happy path
**Steps:**
1. Open the "Meta" tab
2. Click the dashed photo drop zone and select a JPG, PNG, or WebP file
3. Wait for "Generating..." → "ASCII ready"
4. Toggle "ascii" and "image" mode buttons

**Expected:** Thumbnail shown after upload. "ASCII ready" after generation. "ascii" mode shows character art; "image" mode shows actual photo inline.

---

### 16. Unsupported format rejected
**Steps:**
1. Open the "Meta" tab
2. Attempt to select a `.gif` or `.svg` file via drag and drop

**Expected:** Alert: "Supported formats: JPG, PNG, WebP." Drop zone resets to empty state.

---

### 17. ASCII sliders regenerate art
**Steps:**
1. Upload a photo
2. After "ASCII ready", drag the max-width slider from 50 to 80 cols
3. Drag the max-height slider from 25 to 40 rows

**Expected:** Each change triggers "Generating..." then updated ASCII at new dimensions.

---

## Import Tab

### 18. EuroPass PDF — happy path
**Steps:**
1. Click the "Import" tab
2. Drop or browse to a valid EuroPass PDF
3. Wait for spinner
4. Review extracted name, title, email, sections
5. Click "Import"

**Expected:** Spinner with filename. Review screen shows meta fields, section count with type badges, optional warnings. Clicking "Import" replaces CV data and shows "Import complete." Theme and colors preserved.

---

### 19. Non-PDF file rejected immediately
**Steps:**
1. Click the "Import" tab
2. Drag a `.txt` or `.jpg` file onto the drop zone

**Expected:** Immediate error: "Please select a EuroPass PDF file (.pdf)." No network request made.

---

### 20. Oversized file rejected
**Steps:**
1. Click the "Import" tab
2. Select or drop a PDF file larger than 10 MB

**Expected:** Error: "PDF file must be 10 MB or smaller." No network call.

---

### 21. Cancel at review screen
**Steps:**
1. Upload a valid EuroPass PDF to reach the review screen
2. Click "Cancel"

**Expected:** Returns to idle drop zone. Existing CV data unchanged.

---

## PDF Export

### 22. Export PDF button
**Steps:**
1. Fill in a name (e.g. "Ada Lovelace") and at least one section with content
2. Click "Export PDF" in the preview header

**Expected:** Button shows "Exporting…" and disables. File downloads as `Ada_Lovelace.pdf`. Button resets.

---

### 23. Filename sanitisation
**Steps:**
1. Set name to `Ada Lovelace & Co. <Test>`
2. Click "Export PDF"

**Expected:** Downloaded file is `Ada_Lovelace___Co___Test_.pdf`.

---

### 24. Export error surfaced
**Steps:**
1. Stop the dev server or kill puppeteer
2. Click "Export PDF"

**Expected:** Alert starting "PDF export failed:" with a hint suggesting "Use the Quick Print button as a fallback". Button resets after dismissal.

---

### 25. Print button
**Steps:**
1. Click the "Print" button in the preview header

**Expected:** Browser native print dialog opens. Print preview reflects current theme colors (preserved via `-webkit-print-color-adjust: exact`).

---

## Print Page

### 26. Metadata injection via DevTools
**Steps:**
1. Trigger "Export PDF" (server opens `/print?id=<nanoid>`)
2. Intercept the id from DevTools Network tab and open `/print?id=<id>` in a new tab
3. Inspect `<head>` in Elements panel

**Expected:** `<head>` contains:
- `<meta name="description">` — CV title
- `<meta name="author">` — name
- `<meta name="keywords">` — comma-separated skills/roles
- `<meta property="og:title">`, `og:description`, `og:type="profile"`
- `<script type="application/ld+json">` with `@type: "Person"`

---

### 27. Missing `?id` shows error
**Steps:**
1. Navigate directly to `http://localhost:3000/print` (no query string)

**Expected:** Red monospace error: "No CV id provided".

---

## Mobile Layout

### 28. Bottom tab navigation
**Steps:**
1. Narrow window below 768 px (or DevTools device emulation)
2. Tap "Edit" → select a section → tap ← back arrow
3. Tap "Meta" → cycle through meta / style / import sub-tabs
4. Tap "Preview"

**Expected:** Correct panel shown at each step. ← arrow returns to section list from editor. Sub-tabs visible in Meta. Export + Print buttons accessible in Preview.

---

## Persistence

### 29. State persists across reload
**Steps:**
1. Add a section, give it a custom title, change a style color
2. Hard-reload (Cmd+Shift+R / Ctrl+Shift+R)

**Expected:** Section, title, and custom color all restored from localStorage.

---

## Photo Section Type

### 30. Standalone photo section
**Steps:**
1. Click "[img] Photo" in the "Add section" grid
2. Select the section and upload an image in SectionEditor
3. Toggle "ascii" and "image" mode buttons
4. Adjust max-width and max-height sliders

**Expected:** Thumbnail shown after upload. Toggling render mode changes preview. Slider changes trigger "Generating ASCII art…" then updated result.
