<?php
/* tigerart.com.au — Community: what the bitGen Community is, how to join (inside the app), the rules, the live member
 * count (from ../bitgen-community/api.php?a=info, cached 5 minutes). */
$title = 'Community'; $here = 'community.php';
$desc = 'Join the bitGen Community from inside the app: ask for help in the Help room and chat with friends.';
require __DIR__ . '/inc/header.php';
$info = community_info();
$users = $info ? (int) ($info['users'] ?? 0) : null;
?>
<header class="head">
  <div class="wrap">
    <h1>The Community</h1>
    <p class="lede">Ask a question, answer one, and make friends with other people making films in bitGen Studio.</p>
<?php if ($users !== null): ?>
    <p class="live"><?= $users === 1 ? '1 member' : number_format($users) . ' members' ?></p>
<?php else: ?>
    <p class="live off">Opening soon</p>
<?php endif; ?>
  </div>
</header>
<div class="page">
  <div class="wrap">
    <h2>Join from inside the app</h2>
    <ol class="steps">
      <li><strong>Open 💬 Community</strong>It is on the status bar along the bottom of the studio.</li>
      <li><strong>Choose a user ID and a password</strong>3 to 24 letters, numbers, _ . or -. Add a display name if you like, then Join. On another computer, Sign in with the same ID.</li>
      <li><strong>Ask in the Help room</strong>Everyone who joins is in it. Click a name to find that person.</li>
      <li><strong>Add friends</strong>Find someone by their ID and press + Add friend. When they accept, you are friends and can chat in private.</li>
    </ol>

    <h2>The rules</h2>
<?php if ($info && !empty($info['rules'])): ?>
    <p style="white-space:pre-line"><?= h((string) $info['rules']) ?></p>
<?php else: ?>
    <p>Be kind. Help each other. No spam, no hate, nothing illegal. Admins may delete messages and ban accounts. Report a message with ⚑ and the admins will look at it.</p>
<?php endif; ?>

    <h2>What it keeps about you</h2>
    <p>Your user ID, display name, a scrambled form of your password (never the password itself), your friends, and what you write. You can leave at any time from ⋯ ▸ Leave the community, which deletes your ID, your password and your friendships; what you already wrote stays, shown as from "(left)". The <a href="<?= u('privacy.php') ?>">privacy page</a> has the details.</p>
  </div>
</div>
<?php require __DIR__ . '/inc/footer.php'; ?>
