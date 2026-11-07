<?php /* the bottom of every page */ ?>
</main>
<footer class="foot">
  <div class="wrap">
    <div>
      <a class="brand" href="<?= u() ?>"><img src="<?= u('assets/img/logo.png') ?>" alt="" width="30" height="30">bitGen Studio</a>
      <p>A free, local AI film and design studio by Tiger Art, Australia. Version <?= h(site()['version']) ?> - a public beta.</p>
      <p>Free and open source under the <a href="<?= h(GITHUB_RAW) ?>LICENSE">MIT licence</a>. Each model and engine it uses keeps its own licence.</p>
    </div>
    <nav aria-label="The site">
<?php foreach (NAV as $file => $label): ?>
      <a href="<?= u($file) ?>"><?= h($label) ?></a>
<?php endforeach; ?>
      <a href="<?= u('privacy.php') ?>">Privacy</a>
    </nav>
    <nav aria-label="On GitHub">
      <a href="<?= h(GITHUB) ?>" rel="noopener">Source code</a>
      <a href="<?= h(GITHUB_ISSUES) ?>" rel="noopener">Report a bug</a>
      <a href="<?= h(GITHUB) ?>/blob/main/misc/CHANGELOG.md" rel="noopener">What's new</a>
      <a href="<?= h(GITHUB_ZIP) ?>">Download (zip)</a>
    </nav>
  </div>
</footer>
<script src="<?= u('assets/site.js') ?>?v=<?= h(site()['version']) ?>" defer></script>
</body>
</html>
