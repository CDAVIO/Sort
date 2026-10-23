# Security

## Reporting a vulnerability

Report privately, not in a public issue:

- GitHub: [open a private advisory](https://github.com/CDAVIO/Sort/security/advisories/new)
- LinkedIn: [linkedin.com/in/cristea-david](https://www.linkedin.com/in/cristea-david)

Please include what you did, what happened, and the operating system and SORT
version. A proof of concept helps. You will get a reply within seven days.

Nothing is paid for a report. This is a free tool with no revenue behind it,
and pretending otherwise would waste your time.

## Supported versions

Only the newest release is fixed. SORT checks GitHub on launch and tells you
when a newer build exists.

| Version | Supported |
|---|---|
| latest release | yes |
| anything older | no, update first |

## What SORT does with your files

Worth knowing before you look for a vulnerability, because it rules most
classes of them out:

- **No network.** After it is installed, SORT makes no request of any kind.
  The only exception is the version check on launch, which asks GitHub for the
  latest release number and sends nothing about you or your files.
- **No server, no account, no telemetry.** There is nowhere for your data to go.
- **Photos are read, not sent.** Only each file's header is parsed, for camera
  model, capture time and GPS.
- **GPS stays local.** Coordinates are matched against a city list built into
  the app. No geocoding service is contacted.
- **Writes are confined** to the destination folder you pick. Copy never
  touches your originals. Move removes an original only after the copy is
  written and its size verified.

## Where a real problem could be

The parsers are the interesting surface. SORT reads EXIF, HEIC and ISO-BMFF
boxes, PNG chunks and QuickTime atoms from files it has no control over. A
malformed file that causes a crash, a hang or out-of-bounds reading is a valid
report, and the most useful kind.

The desktop app exposes Node file operations to the page over a
context-isolated bridge with a fixed set of operations. Anything that escapes
that set is a valid report.

## Builds are not signed

The macOS and Windows builds carry no paid code-signing certificate, so both
systems warn on first launch. This is a known and deliberate trade-off for a
free tool, not a vulnerability. It does mean you should download only from
[the releases page](https://github.com/CDAVIO/Sort/releases) and nowhere else.
