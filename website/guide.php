<?php
/* tigerart.com.au — Guide: the user guide and the shortcut keys in four languages, the feature reference, the install
 * guide - read on GitHub or as PDFs (always the newest: linked from the repo). */
$title = 'Guide'; $here = 'guide.php';
$desc = 'The bitGen Studio user guide in English, Simplified Chinese, Traditional Chinese and Japanese, with the shortcut keys and the feature reference.';
require __DIR__ . '/inc/header.php';
$S = site();
$pdf = [];
foreach ($S['pdfs'] as $p) $pdf[$p['file']] = $p;
$guides = [
    ['English', 'en', 'docs/USAGE.md', 'bitGen-Studio-Guide.pdf'],
    ['简体中文', 'zh-CN', 'docs/i18n/zh-CN/USAGE.md', 'bitGen-Studio-Guide-zh-CN.pdf'],
    ['繁體中文', 'zh-TW', 'docs/i18n/zh-TW/USAGE.md', 'bitGen-Studio-Guide-zh-TW.pdf'],
    ['日本語', 'ja', 'docs/i18n/ja/USAGE.md', 'bitGen-Studio-Guide-ja.pdf'],
];
?>
<header class="head">
  <div class="wrap">
    <h1>The guide</h1>
    <p class="lede">How to use every part of the studio, step by step. The same guide is inside the app: press <kbd>Ctrl</kbd>+<kbd>K</kbd> and type what you are looking for, or click ❔ on a docker.</p>
  </div>
</header>
<div class="page">
  <div class="wrap">
    <h2>User guide and shortcut keys</h2>
    <ul class="links">
<?php foreach ($guides as [$name, $lang, $md, $file]): ?>
      <li lang="<?= h($lang) ?>"><a href="<?= h(GITHUB) ?>/blob/main/<?= h($md) ?>" rel="noopener"><?= h($name) ?></a>
<?php if (isset($pdf[$file])): ?>        <span class="quiet"><a href="<?= h($pdf[$file]['url']) ?>" rel="noopener">PDF</a> with the shortcut keys, <?= h((string) $pdf[$file]['mb']) ?> MB</span>
<?php endif; ?>
      </li>
<?php endforeach; ?>
    </ul>

    <h2>More to read</h2>
    <ul class="links">
      <li><a href="<?= u('features.php') ?>">Every feature</a><span class="quiet">searchable here<?php if (isset($pdf['bitGen-Studio-Features.pdf'])): ?>, or as a <a href="<?= h($pdf['bitGen-Studio-Features.pdf']['url']) ?>" rel="noopener">PDF</a><?php endif; ?></span></li>
<?php if (isset($pdf['bitGen-Studio-Brochure.pdf'])): ?>      <li><a href="<?= h($pdf['bitGen-Studio-Brochure.pdf']['url']) ?>" rel="noopener">The brochure</a><span class="quiet">bitGen Studio in a few pages, PDF</span></li>
<?php endif; ?>
      <li><a href="<?= h(GITHUB) ?>/blob/main/docs/INSTALL.md" rel="noopener">Installing</a><span class="quiet">the installer, the manual steps, troubleshooting</span></li>
      <li><a href="<?= h(GITHUB) ?>/blob/main/misc/CHANGELOG.md" rel="noopener">What's new</a><span class="quiet">every version</span></li>
      <li><a href="<?= h(GITHUB) ?>/blob/main/docs/REFERENCE.md" rel="noopener">Technical reference</a><span class="quiet">for developers</span></li>
    </ul>

    <h2>Still stuck?</h2>
    <p>Ask in the <a href="<?= u('community.php') ?>">Community's Help room</a> - it is inside the app, under 💬 Community on the status bar. Something broken? <a href="<?= h(GITHUB_ISSUES) ?>" rel="noopener">Report it on GitHub</a>.</p>
  </div>
</div>
<?php require __DIR__ . '/inc/footer.php'; ?>
