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

Renaming is optional. By default SORT keeps every filename exactly as the camera wrote it.

When you do rename, you compose a pattern from tokens. SORT fills each token from the
metadata it read, and always keeps the file extension.

### Tokens

| Token | Means | Example |
|---|---|---|
| `{orig}` | the original name, without extension | `IMG_9497` |
| `{year}` | year of capture | `2025` |
| `{mm}` | month, two digits | `03` |
| `{dd}` | day, two digits | `31` |
| `{HH}` | hour, 24-hour clock | `14` |
| `{MI}` | minute | `22` |
| `{SS}` | second | `05` |
| `{device}` | camera model, spaces removed | `iPhone16ProMax` |
| `{city}` | nearest city from GPS | `Bucharest` |
| `{n}` | counter, four digits | `0001` |

### Example patterns

All of these show the same photo — `IMG_9497.HEIC`, taken on an iPhone 16 Pro Max in
Bucharest on 31 March 2025 at 14:22:05.

| Pattern | Result |
|---|---|
| `{orig}` | `IMG_9497.HEIC` |
| `{dd}_{mm}_{year}` | `31_03_2025.HEIC` |
| `{year}-{mm}-{dd}` | `2025-03-31.HEIC` |
| `{year}-{mm}-{dd}_{HH}-{MI}-{SS}` | `2025-03-31_14-22-05.HEIC` |
| `{year}{mm}{dd}_{orig}` | `20250331_IMG_9497.HEIC` |
| `{device}_{year}-{mm}-{dd}` | `iPhone16ProMax_2025-03-31.HEIC` |
| `{city}_{year}-{mm}-{dd}_{n}` | `Bucharest_2025-03-31_0001.HEIC` |
| `{orig}_{city}` | `IMG_9497_Bucharest.HEIC` |

You can type any text between tokens:

| Pattern | Result |
|---|---|
| `Holiday_{year}_{n}` | `Holiday_2025_0001.HEIC` |
| `{city} - {dd}.{mm}.{year}` | `Bucharest - 31.03.2025.HEIC` |

### Rules

**The extension is never changed.** `IMG_3323.JPG` keeps `.JPG` in capitals;
`photo.jpeg` keeps `.jpeg`. SORT does not normalise it.

**Keeping the original name returns it byte for byte.** Choose `{orig}` and the file
arrives with precisely the name it had, including its capitalisation.

**Duplicates are numbered.** If two files would end up with the same name in the same
folder, the second becomes `_2`, the third `_3`, and so on. Nothing is ever overwritten.

**Missing data falls back to a visible placeholder**, so you can spot those files
immediately rather than having them silently blend in:

| Missing | Token | Becomes |
|---|---|---|
| no capture date | `{year}` `{mm}` `{dd}` | `0000` `00` `00` |
| no GPS | `{city}` | `NoLoc` |
| no camera model | `{device}` | `UnknownDevice` |

If you would rather not see placeholders in your filenames, keep `{orig}` and let the
folder structure carry the sorting instead — a missing folder level simply disappears,
while a missing token in a filename has to be filled with something.

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

## The desktop app

`electron/` wraps the same `index.html` in a native window — no browser, its own
icon, its own Dock/Start-menu entry.

It does **not** use Chromium's File System Access API. Iterating a directory picked
with `showDirectoryPicker` hangs in Electron ([electron#45225][e]), and that is
SORT's main loop. Instead `electron/shim.js` reimplements the handful of File
System Access calls SORT makes on top of Node `fs` in the main process, so the app
code runs unchanged. Copying is `fs.copyFile` and moving is `fs.rename`, which are
both faster than pushing bytes through JavaScript.

[e]: https://github.com/electron/electron/issues/45225

```
cd electron
npm install
npm start            # run it locally
npm run build:mac    # .dmg   (needs macOS)
npm run build:win    # .exe   (needs Windows)
```

You do not need either machine: push a tag and GitHub builds both.

```
git tag v1.0.0 && git push origin v1.0.0
```

`.github/workflows/build-apps.yml` runs on GitHub's own macOS and Windows runners
and attaches the installers to the release.

The builds are **unsigned** — no Apple or Windows certificate is configured. macOS
refuses a plain double-click on first run (right-click → Open instead) and Windows
SmartScreen warns that the publisher is unknown. Signing costs about $99/year for
Apple and $200/year for a Windows certificate.

---

## Running it offline

The page carries everything it needs — fonts included — so it makes **no network request at
all**, not even on first load. Download it once and it keeps working with the internet off.

On the site, **Keep SORT on your computer** saves the page as `SORT.html`. That file is the
whole app.

| | How to open it |
|---|---|
| macOS | right-click → Open With → Google Chrome (Safari cannot open folders) |
| Windows | double-click — Edge and Chrome both work |

It is the same file on both. Opened from `file://`, Chrome still counts as a secure context,
so folder access keeps working exactly as it does on the site.

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

**To just use SORT**, you do not need any of this. Download `index.html` and open it.
That is the whole program.

This section is for working on the code.

### Get a copy and open it

**Mac — Terminal**

```bash
cd ~/Documents
git clone https://github.com/CDAVIO/Sort.git
cd Sort
open -a "Google Chrome" index.html
```

**Windows — PowerShell**

The git commands are identical everywhere. Only the paths are written differently:

```powershell
cd $HOME\Documents
git clone https://github.com/CDAVIO/Sort.git
cd Sort
start chrome index.html
```

The last line is the one that opens SORT. `cd Sort` only moves you into the folder.

Use Chrome, Edge or Brave. Safari cannot write to folders, so the folder picker does nothing there.

**If it says `destination path 'Sort' already exists`**

A folder of that name is already there, probably from an earlier attempt. Git refuses to
clone over it on purpose. Delete it first:

```bash
rm -rf ~/Documents/Sort          # Mac
```

```powershell
Remove-Item -Recurse -Force $HOME\Documents\Sort      # Windows
```

Then run the commands again.

### After you change something

Same on both systems:

```bash
git add .
git commit -m "what changed"
git push
```

### Signing in

Git will ask for a username and a password:

```
Username: your GitHub username
Password: a personal access token
```

**Your GitHub password does not work here.** It only works for logging into the website.
Git has needed a token since 2021 — the field is still labelled *Password*, which is the
confusing part.

Make a token at **github.com/settings/tokens** → *Tokens (classic)* → *Generate new token*:

- Tick only **repo**
- Set an expiration, for example 90 days
- Copy it immediately — GitHub shows it once and never again

Nothing appears on screen while you paste it. That is normal. Press Enter.

Save it so you only do this once:

```bash
git config --global credential.helper osxkeychain      # Mac
git config --global credential.helper manager          # Windows
```

Treat a token like a password. Never paste it into a chat, a file, or your code.

### Chain commands with `&&`

```bash
cd ~/Documents/Sort && git add . && git commit -m "update" && git push
```

With `&&`, a failed step stops the rest. Without it, a failed `cd` leaves you in the wrong
folder and every following command runs there anyway — which is how people accidentally turn
their home folder into a git repository.

---

## Privacy

Nothing is uploaded. Nothing is installed. There is no account, no analytics, no server,
no API key, and no network request of any kind after the page loads.

Your photos and their GPS coordinates never leave your computer.

---

Built by [CDAV.IO](https://cdav.io)
