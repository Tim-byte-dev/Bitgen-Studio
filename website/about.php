<?php
/* tigerart.com.au — About: Tiger Art, who makes bitGen Studio, the licence, and the credits (data/site.json, from the
 * app's own lib/credits.json - the same list as the app's About box). */
$title = 'About'; $here = 'about.php';
$desc = 'bitGen Studio is made by Tiger Art in Australia. Free and open source, built on the work of many people.';
require __DIR__ . '/inc/header.php';
$C = site()['credits'];
?>
<header class="head">
  <div class="wrap">
    <h1>About</h1>
    <p class="lede"><?= h($C['about'] ?? 'bitGen Studio - a local AI video, image, music and editing studio.') ?></p>
  </div>
</header>
<div class="page">
  <div class="wrap">
    <h2>Tiger Art</h2>
    <p>Tiger Art is an independent software studio in Australia. bitGen Studio is what we make: a whole film studio that runs on the computer in front of you, so the work, the files and the choices stay yours.</p>
    <p>It is free and open source under the MIT licence. Every line is on <a href="<?= h(GITHUB) ?>" rel="noopener">GitHub</a> - read it, change it, and send improvements back.</p>

    <h2>Made by</h2>
    <ul class="links">
<?php foreach ($C['credits'] ?? [] as $c): ?>
      <li><span class="quiet"><?= h($c['role'] ?? '') ?></span><b><?= h($c['name'] ?? '') ?></b></li>
<?php endforeach; ?>
    </ul>

    <h2>Thank you</h2>
<?php if (!empty($C['thanks'])): ?>    <p><?= h($C['thanks']) ?></p>
<?php endif; ?>
    <div class="cols">
<?php foreach ($C['sections'] ?? [] as $sec): ?>
      <div class="credit">
        <h3><?= h($sec['title'] ?? '') ?></h3>
        <ul>
<?php foreach ($sec['items'] ?? [] as $it):
        $name = is_array($it) ? ($it['name'] ?? '') : (string) $it;
        $url = is_array($it) ? ($it['url'] ?? '') : '';
        $what = is_array($it) ? ($it['what'] ?? ($it['note'] ?? '')) : '';
        $by = is_array($it) ? ($it['by'] ?? '') : ''; ?>
          <li><?= $url && preg_match('#^https?://#', $url) ? '<a href="' . h($url) . '" rel="noopener">' . h($name) . '</a>' : h($name) ?><?= $by ? ' <span class="quiet">by ' . h($by) . '</span>' : '' ?><?= $what ? ' <span class="quiet">- ' . h($what) . '</span>' : '' ?></li>
<?php endforeach; ?>
        </ul>
      </div>
<?php endforeach; ?>
    </div>
  </div>
</div>
<?php require __DIR__ . '/inc/footer.php'; ?>
