# SORT

Organize photos and videos by **device, date and place** — entirely in your browser.

No server. No upload. No install. No account.

---

## What it does

SORT reads the metadata inside each photo and video — camera model, capture time, GPS —
then files everything into the folder structure you choose.

```
iPhone 16 Pro Max / 2025 / March / IMG_9497.HEIC
Screenshots       / 2025 / March / screen.PNG
Bucharest / 2025 / March / 31 March / IMG_9497.HEIC
DJI Osmo Pocket 2 / 2026 / February / DJI_0035.MP4
2025 / March / whatsapp.jpg          ← no device, no GPS
```

Everything happens on your own computer. The files are read and written by the browser,
directly on your disk. Nothing is ever sent anywhere.

---

## How to use it

1. **Open `index.html`** — double-click it, or put it on a web address
2. **Choose a folder** — your browser asks permission once
3. **Build the structure** — pick a preset or compose your own from tokens
4. **Rename** (optional) — keep the camera's names or rebuild them from the date
5. **Choose destination and mode** — Copy, Move or Preview
6. **Sort** — watch the tree fill up

---

## Folder structure

Click tokens together to build any structure:

| Token | Example | Token | Example |
|---|---|---|---|
| `{device}` | iPhone 16 Pro Max | `{year}` | 2025 |
| `{brand}` | Apple | `{month}` | March |
| `{type}` | Photos / Videos / Screenshots | `{mm}` | 03 |
| `{city}` | Bucharest | `{day}` | 31 March |
| `{country}` | RO | `{dd}` | 31 |
| `{ext}` | HEIC | `{date}` | 2025-03-31 |

**Missing data disappears.** No GPS means no location folder. No date means only what is
known is used. You can switch to `No date` / `Unknown` labels instead.

Month names: English, Romanian (Martie) or numeric.

---

## Renaming

`IMG_0001.HEIC` becomes `01_03_2025.HEIC`, `2025-03-31_14-22-05.HEIC`, or whatever you build.

Tokens: `{orig} {year} {mm} {dd} {HH} {MI} {SS} {device} {city} {n}`

Keeping the original name returns it **byte for byte** — `IMG_3323.JPG` stays `IMG_3323.JPG`,
not `IMG_3323.jpg`. Duplicates get `_2`, `_3` and so on.

---

## Copy, Move, Preview

- **Copy** — every file is written to the new folder, originals untouched. Nothing can be lost.
- **Move** — on the same drive the file is renamed in place, so nothing is rewritten and a
  100 GB library moves in seconds. Across drives it copies, verifies the size, then deletes
  the original. If a write fails, that original stays put.
- **Preview** — builds the whole tree and shows it. Writes nothing, deletes nothing. Run this first.

---

## What it reads

| Format | Where the metadata lives |
|---|---|
| JPEG, TIFF, DNG, WebP | EXIF (APP1 / TIFF IFD) |
| HEIC, HEIF, AVIF | ISO-BMFF `meta` / `iinf` / `iloc` → Exif item |
| PNG | `eXIf` chunk |
| MOV, MP4, M4V | QuickTime `moov` — `mvhd`, `keys`+`ilst`, `udta` |
| anything else | filename date, then file modified date |

GPS coordinates are matched to a city **offline**, against a built-in list of ~220 cities
within 75 km. No request ever leaves the page, so your locations stay private and there is
no API key to manage.

---

## Browser support

| | Folder to folder (Copy / Move) | Metadata + ZIP download |
|---|---|---|
| Chrome, Edge, Brave, Opera (desktop) | yes | yes |
| Safari, Firefox | no | yes |

Writing directly to folders uses the **File System Access API**, which needs Chrome, Edge or
Brave on a desktop, served over **HTTPS** (or opened as a local file).

Elsewhere SORT still reads everything and hands you the organized library as a ZIP download.
A ZIP cannot exceed 4 GB — for a large library, use Chrome.

---

## Large libraries

100 GB works. Files are **streamed**, never loaded into memory, so 100 GB uses about as much
RAM as 100 MB. Scanning reads only the header of each file — 256 KB for a photo, about a
megabyte for a video.

Expect roughly 2–4 minutes to scan a 100 GB library, then the copy runs at your disk's speed.
With **Move** on the same drive it finishes in seconds, because nothing is rewritten.

Keep the tab open and the computer awake while it runs.

---

## Hosting

It is one file. Put `index.html` anywhere that serves HTTPS:

- Drag it into **Netlify** or **Cloudflare Pages**
- **GitHub Pages** — Settings → Pages → Branch `main`, folder `/ (root)`
- Your own server — upload `index.html`

Opening it straight from disk also works, but the browser asks permission on every open,
because a local file has no stable identity to remember.

---


## Working with this repo

### Mac — Terminal

Get it the first time:

```bash
cd ~/Documents
git clone https://github.com/CDAVIO/Sort.git
cd Sort
```

After you change something:

```bash
cd ~/Documents/Sort
git add .
git commit -m "what changed"
git push
```

### Windows — PowerShell

The git commands are identical. Only the folder path is written differently:

```powershell
cd $HOME\Documents
git clone https://github.com/CDAVIO/Sort.git
cd Sort
```

After you change something:

```powershell
cd $HOME\Documents\Sort
git add .
git commit -m "what changed"
git push
```

### Signing in

GitHub does not accept your account password for git. It needs a **personal access token**.

```
Username: CDAVIO
Password: <the token, not your GitHub password>
```

Make one at **github.com/settings/tokens** → *Tokens (classic)* → *Generate new token*.
Tick only **repo**, set an expiration, and copy it immediately — it is shown once.

Nothing appears on screen while you paste the token. That is normal. Press Enter.

Save it so you only do this once:

```bash
git config --global credential.helper osxkeychain      # Mac
git config --global credential.helper manager          # Windows
```

### If a command fails

Chain commands with `&&` so a failure stops the rest:

```bash
cd ~/Documents/Sort && git add . && git commit -m "update" && git push
```

Without `&&`, a failed `cd` leaves you in the wrong folder and the following commands run
there anyway — which is how you end up accidentally turning your home folder into a repo.

---

## Privacy

Nothing is uploaded. Nothing is installed. There is no account, no analytics, no server,
no API key, and no network request of any kind after the page loads.

Your photos and their GPS coordinates never leave your computer.

---

Built by [CDAV.IO](https://cdav.io)
