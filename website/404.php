<?php
/* tigerart.com.au — a page that is not here (the old Tiger Art marketplace's links land here too) */
http_response_code(404);
$title = 'Not here'; $here = '';
require __DIR__ . '/inc/header.php';
?>
<header class="head">
  <div class="wrap">
    <h1>That page is not here</h1>
    <p class="lede">Tiger Art's site is now the home of bitGen Studio, so an old link may land here. Try the <a href="<?= u() ?>">home page</a>, <a href="<?= u('download.php') ?>">Download</a> or <a href="<?= u('features.php') ?>">every feature</a>.</p>
  </div>
</header>
<?php require __DIR__ . '/inc/footer.php'; ?>
