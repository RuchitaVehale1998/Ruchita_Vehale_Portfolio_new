# Ruchita Vehale — Portfolio (Hugo)

Editorial-minimal dark portfolio. All content lives in Markdown and `hugo.yaml`.
Push to GitHub → GitHub Actions builds automatically. No Netlify required.

---

## GitHub Pages deploy (recommended)

```bash
# 1. Create a repo at github.com, then:
git init && git add . && git commit -m "init"
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main

# 2. In GitHub: Settings → Pages → Source → GitHub Actions
# 3. The .github/workflows/hugo.yml file handles everything automatically.
```

Your site will be at `https://YOUR_USERNAME.github.io/YOUR_REPO/`
Update `baseURL` in hugo.yaml to match.

For a custom domain (free via GitHub Student Pack → Namecheap):
- Claim at education.github.com/pack
- Add CNAME in repo Settings → Pages → Custom domain

---

## Run locally

```bash
brew install hugo    # macOS — needs Hugo extended ≥ 0.110
hugo server          # → http://localhost:1313
```

---

## How to update

### Personal info, impact numbers, expertise, skills
Edit **`hugo.yaml`** — everything under `params:`. No HTML needed.

### Add or edit a job
`content/experience/yourjob.md`:
```markdown
---
title: "Senior ML Engineer"
company: "Wayve"
location: "London, UK"
date: "2026-01-01"
enddate: "Present"
weight: 1
problem: "One sentence: what did you actually solve?"
tags: ["Python", "PyTorch", "ROS"]
impact:
  - value: "3×"
    label: "Speedup"
---

Each paragraph here becomes one bullet automatically.

Use **bold** for key terms.
```

### Add or edit a project
`content/projects/myproject.md`:
```markdown
---
title: "My Project"
summary: "One line for the card."
category: "Machine Learning"
filter: ["ml", "cv"]
featured: true          # spans 2 columns
weight: 1
result: "Key metric"
problem: "What real problem did this solve?"
approach: "How did you design the system?"
tags: ["YOLOv8", "ROS"]
impact:
  - value: "98%"
    label: "Accuracy"
---
```

### Add a publication
`content/publications/p7-newpaper.md`:
```markdown
---
title: "Paper Title"
journal: "Journal Name · Year"
year: 2026
type: "journal"       # journal | preprint | conference
paperurl: "https://doi.org/..."
weight: 7
---
```

### Replace resume
Drop your PDF at `static/files/Ruchita_Vehale_Resume.pdf`

### Change accent colour
`themes/rkv/static/css/main.css` line ~22:
```css
--a: #c8a96e;
```

---

## Easter eggs (3 hidden)
1. **Konami code** — ↑↑↓↓←→←→BA
2. **Triple-click** the RV monogram in the nav
3. **Type "slam"** anywhere on the page

---

## File structure
```
hugo.yaml                     ← all personal data (edit here)
content/
  experience/                 ← one .md per role
  projects/                   ← one .md per project
  publications/               ← one .md per paper
static/files/
  Ruchita_Vehale_Resume.pdf   ← replace with your CV
themes/rkv/
  static/css/main.css         ← styles (change --a to recolour)
  static/js/main.js           ← interactions + easter eggs
  layouts/index.html          ← homepage template
  layouts/_default/baseof.html← nav + footer
.github/workflows/hugo.yml    ← GitHub Actions auto-deploy
netlify.toml                  ← if you prefer Netlify instead
```
