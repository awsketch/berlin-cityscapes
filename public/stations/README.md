# Station content

This folder holds the editable content for each station on the hunt. The code
never hardcodes station names or descriptions — it loads them from these files
at runtime. Edit a file, save, refresh the app, and the new text appears.

## Folder structure

```
stations/
├── station-1/
│   ├── title.txt         ← shown as the heading in the popup and the stations panel
│   ├── description.txt   ← the longer paragraph shown above the clue
│   ├── clue.txt          ← the short riddle-style text
│   └── images/           ← drop .jpg/.png files here (wiring comes next)
├── station-2/
│   └── ...
└── station-6/
    └── ...
```

## Why the folder names are generic

The folders are named `station-1` … `station-6` so that if you swap the
content of a slot for a completely different place later, the folder name
and its reference in the code stay the same. The *content* changes; the
*slot* doesn't.

## How slots map to the real world

The mapping between slot (`station-1`) and physical place (coords, category,
QR-code token, audio filename) lives in the `STATIONS` array inside
`src/treasure-hunt-app.jsx`. That's where you go to:

- move a station to different coordinates
- change its category (historic / modern / secret)
- regenerate an unlock token (only do this before printing new QR codes)
- wire up its audio file

Everything *writerly* — title, description, clue — lives here in `.txt`
files and never requires editing code.

## Editing tips

- Keep each `.txt` file as plain UTF-8 text, no markdown.
- Paragraph breaks inside a single file aren't rendered yet — the app shows
  each file as one paragraph. If you need multi-paragraph descriptions,
  ask and I'll extend the renderer.
- Trailing whitespace and blank lines are trimmed, so you can end files with
  a newline (most editors do this automatically).

## Images

Each `images/` subfolder is empty for now. In the next step we'll design how
photos appear in the popup and define the expected filenames.
