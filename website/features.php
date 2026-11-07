<?php
/* tigerart.com.au — Features: every feature of bitGen Studio (data/site.json, from docs/FEATURES.md), grouped as the
 * Feature Reference groups them, with a filter. */
$title = 'Features'; $here = 'features.php';
$desc = 'Every feature of bitGen Studio - video, images, music, the timeline, the image editor, Sketcher and more - with where to find it.';
require __DIR__ . '/inc/header.php';
$S = site();
$slug = fn(string $t) => trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($t)), '-');
$pdf = null;
foreach ($S['pdfs'] as $p) if ($p['file'] === 'bitGen-Studio-Features.pdf') $pdf = $p;
?>
<header class="head">
  <div class="wrap">
    <h1>Every feature</h1>
    <p class="lede"><?= (int) $S['featureCount'] ?> features, each with where to find it in the studio and the version it arrived in.<?php if ($pdf): ?> Also as a <a href="<?= h($pdf['url']) ?>" rel="noopener">PDF (<?= h((string) $pdf['mb']) ?> MB)</a>.<?php endif; ?></p>
  </div>
</header>
<div class="page">
  <div class="wrap">
    <div class="filter">
      <label for="featFilter" class="quiet">Find a feature</label>
      <input id="featFilter" type="search" placeholder="Try: lip sync, keyframes, LoRA, karaoke" autocomplete="off">
      <span id="featCount" class="quiet small" aria-live="polite"><?= (int) $S['featureCount'] ?> features</span>
    </div>
    <ul class="toc">
<?php foreach ($S['features'] as $sec): ?>
      <li><a href="#<?= h($slug($sec['title'])) ?>"><?= h($sec['title']) ?></a></li>
<?php endforeach; ?>
    </ul>
    <p id="featNone" class="none" hidden>No feature matches that. Try a shorter word, or ask in the <a href="<?= u('community.php') ?>">Community</a>.</p>
<?php foreach ($S['features'] as $sec): ?>
    <section class="sec" id="<?= h($slug($sec['title'])) ?>">
      <h2><?= h($sec['title']) ?></h2>
<?php if ($sec['intro']): ?>      <p><?= h($sec['intro']) ?></p>
<?php endif; ?>
<?php foreach ($sec['groups'] as $g): ?>
      <div class="grp">
        <h3><?= h($g['title']) ?></h3>
<?php foreach ($g['items'] as $it): ?>
        <div class="feat"><b><?= h($it['name']) ?></b><div><div class="d"><?= h(ucfirst($it['text'])) ?>.</div><?php if ($it['where'] || $it['since']): ?><div class="w quiet"><?= $it['where'] ? 'In ' . h($it['where']) : '' ?><?= $it['where'] && $it['since'] ? '. ' : '' ?><?= $it['since'] ? '<span class="v">Since ' . h($it['since']) . '</span>' : '' ?></div><?php endif; ?></div></div>
<?php endforeach; ?>
      </div>
<?php endforeach; ?>
    </section>
<?php endforeach; ?>
  </div>
</div>
<?php require __DIR__ . '/inc/footer.php'; ?>
