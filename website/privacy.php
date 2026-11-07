<?php
/* tigerart.com.au — Privacy: what this site, the app and the Community keep. */
$title = 'Privacy'; $here = '';
$desc = 'What bitGen Studio, this website and the bitGen Community keep about you.';
require __DIR__ . '/inc/header.php';
?>
<header class="head">
  <div class="wrap">
    <h1>Privacy</h1>
    <p class="lede">bitGen Studio runs on your computer, and what you make stays there. Only the Community, if you join it, goes online.</p>
  </div>
</header>
<div class="page">
  <div class="wrap">
    <h2>This website</h2>
    <p>No cookies, no tracking and no analytics. The fonts and pictures load from this site, not from anyone else's. Like every web server, ours writes a short access log (the page asked for, the time and your network address) that the host keeps for a limited time to keep the site running.</p>

    <h2>The app</h2>
    <p>Your projects, pictures, films, voices and settings stay in folders on your own disk. The models run on your own graphics card. bitGen Studio sends nothing about you anywhere. It goes online only when you ask it to: to download models and node packs, to check GitHub for a new version, or to use a service you set up yourself (a remote GPU, a Hugging Face token).</p>

    <h2>The Community</h2>
    <p>Joining is your choice. When you join, the Community server on this site keeps:</p>
    <ul>
      <li>your user ID and display name</li>
      <li>your password, scrambled so that it cannot be read back (never the password itself)</li>
      <li>your friends, friend requests and the people you block</li>
      <li>what you write in the Help room and in private chats, and any message you report with the reason you gave</li>
      <li>when you were last online, and a network address for a short while to stop abuse</li>
    </ul>
    <p>Private chats are seen by you and your friend, and by the admins only if one of you reports a message. Leaving the community (in the app: 💬 Community ▸ ⋯ ▸ Leave the community) deletes your ID, password, friends, requests and blocks; messages you already wrote stay, shown as from "(left)". To have those removed as well, <a href="<?= h(GITHUB_ISSUES) ?>" rel="noopener">ask on GitHub</a>.</p>
    <p>Nothing is sold or shared. The Community runs on this site's own server.</p>
  </div>
</div>
<?php require __DIR__ . '/inc/footer.php'; ?>
