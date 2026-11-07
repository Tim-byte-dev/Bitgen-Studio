# tigerart.com.au - the bitGen Studio website (2.712.0)

The whole tigerart.com.au site, with bitGen Studio as its only product: a home page, every feature, the download,
the guide, the Community, About (with every credit) and a privacy page. Plain PHP 8.1 or newer, **no database**, no
libraries and nothing loaded from other sites (the fonts are in `assets/fonts/`, under the SIL Open Font Licence).
The links to the source, the zip, the guide PDFs, the changelog and bug reports all go to
[GitHub](https://github.com/Tim-byte-dev/Bitgen-Studio).

```
website/
  index.php           the home page: the intro film, what it does, your computer / your files, get it
  features.php        every feature from docs/FEATURES.md, with a filter
  download.php        the one-file installer for Windows / Linux / macOS, what it runs on, how it installs
  guide.php           the user guide PDFs (4 languages), the other documents, where to ask
  community.php       how to join from inside the app, the rules, members (asks ../bitgen-community/)
  about.php           Tiger Art, the licence, the credits (the app's own lib/credits.json)
  privacy.php         what the site and the app keep (almost nothing)
  404.php             a page that is not there
  .htaccess           https only, inc/ and data/ hidden, installers download, caching
  inc/                the parts every page shares (site.php, header.php, footer.php)
  data/site.json      made by scripts/website-sync.py - the version, the features, the credits, the PDFs
  assets/             site.css, site.js, fonts/, img/ (screenshots), media/ (the intro film), get/ (installers)
```

## Bring it up to date

Before each upload, from the top of the repo:

```
python3 scripts/website-sync.py
```

It copies the screenshots (resized), the intro film and its poster, the three installers and the app's version,
features and credits into `website/`. It needs Python 3 with Pillow, and ffmpeg. `scripts/test-website712.js` checks
every page and every link (it needs php; the browser half needs Playwright).

## Put it on the hosting (cPanel)

**This replaces the site that is there now.** Back it up first: cPanel ▸ *File Manager* ▸ select everything in
`public_html` ▸ *Compress* ▸ download the zip. Leave `public_html/bitgen-community/` where it is - that is the
Community server (`community/` in the repo, see its README), and the site sits beside it.

1. Make a zip of the **contents** of `website/` (not the folder itself), including the hidden `.htaccess`.
2. cPanel ▸ *File Manager* ▸ `public_html` ▸ delete the old site's files - **not** `bitgen-community/`,
   `.well-known/` or `cgi-bin/`.
3. *Upload* the zip, then *Extract* it in `public_html`. Turn on *Settings ▸ Show Hidden Files* and check that
   `.htaccess` is there.
4. cPanel ▸ *MultiPHP Manager*: PHP 8.1 or newer for the domain.
5. cPanel ▸ *SSL/TLS Status*: the certificate is on (AutoSSL). The site sends everyone to `https://`.
6. Open https://tigerart.com.au/ - then the Community page: once the Community server answers, it shows how many
   people have joined (it asks at most every 5 minutes).

In a folder instead of the top of the domain (e.g. `public_html/bitgen/`)? It works there too - every link starts
from the folder the pages are in. Change `ErrorDocument 404 /404.php` in `.htaccess` to `/bitgen/404.php`.

## Change something

- Words: the page files. The menu is `NAV` in `inc/site.php`; the GitHub address is `GITHUB` there too.
- Colours and type: the tokens at the top of `assets/site.css`.
- The features, credits and version come from the app - change them there and run the sync again.
