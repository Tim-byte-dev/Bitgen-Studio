<?php
/* the top of every page. Before including: $title (the page's name, '' = the home page), $desc (one sentence),
 * $here (this page's file name, for the menu). */
require_once __DIR__ . '/site.php';
$title = $title ?? '';
$desc = $desc ?? 'bitGen Studio: a free, local AI film and design studio. Write, render, edit and score on your own computer.';
$here = $here ?? '';
$full = $title === '' ? 'bitGen Studio - make films on your own computer' : $title . ' - bitGen Studio';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($full) ?></title>
<meta name="description" content="<?= h($desc) ?>">
<meta property="og:title" content="<?= h($full) ?>">
<meta property="og:description" content="<?= h($desc) ?>">
<meta property="og:image" content="https://<?= h(preg_replace('/[^A-Za-z0-9.:-]/', '', $_SERVER['HTTP_HOST'] ?? 'tigerart.com.au')) ?><?= u('assets/img/og.jpg') ?>">
<meta property="og:type" content="website">
<meta name="theme-color" content="#16120e">
<link rel="icon" href="<?= u('assets/img/logo.png') ?>">
<link rel="preload" href="<?= u('assets/fonts/big-shoulders-display-latin-800-normal.woff2') ?>" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= u('assets/site.css') ?>?v=<?= h(site()['version']) ?>">
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<header class="top">
  <div class="wrap">
    <a class="brand" href="<?= u() ?>"><img src="<?= u('assets/img/logo.png') ?>" alt="" width="34" height="34">bitGen Studio</a>
    <button class="menu" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Main">
<?php foreach (NAV as $file => $label): ?>
      <a href="<?= u($file) ?>"<?= $here === $file ? ' aria-current="page"' : '' ?>><?= h($label) ?></a>
<?php endforeach; ?>
      <a class="gh" href="<?= h(GITHUB) ?>" rel="noopener"><?= gh_icon() ?>GitHub</a>
    </nav>
  </div>
</header>
<main id="main">
