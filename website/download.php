<?php
/* tigerart.com.au — Download: the one-file installer for each system, what it does, what it runs on. */
$title = 'Download'; $here = 'download.php';
$desc = 'Download bitGen Studio for Windows, Linux or macOS. One file installs the app, ComfyUI, the node packs and the models for your graphics card.';
require __DIR__ . '/inc/header.php';
$S = site();
$sz = [];
foreach ($S['installers'] ?? [] as $i) $sz[$i['file']] = $i['kb'];
$kb = fn(string $f) => isset($sz[$f]) ? ' (' . $sz[$f] . ' KB)' : '';
?>
<header class="head">
  <div class="wrap">
    <h1>Download</h1>
    <p class="lede">bitGen Studio is free. One small file installs everything it needs and opens the studio when it is done. Version <?= h($S['version']) ?>, a public beta.</p>
  </div>
</header>
<div class="page">
  <div class="wrap get pickpage">
    <div class="grid">
      <div>
        <h2>Pick your system</h2>
        <ul class="pick">
          <li><a class="btn go" href="<?= u('assets/get/install_all.bat') ?>" download><?= dl_icon() ?>Windows 10 / 11</a><span class="quiet">install_all.bat<?= h($kb('install_all.bat')) ?> - double-click it</span></li>
          <li><a class="btn go" href="<?= u('assets/get/install_all.sh') ?>" download><?= dl_icon() ?>Linux</a><span class="quiet">install_all.sh<?= h($kb('install_all.sh')) ?> - run <code>sh install_all.sh</code></span></li>
          <li><a class="btn go" href="<?= u('assets/get/install_all.command') ?>" download><?= dl_icon() ?>macOS</a><span class="quiet">install_all.command<?= h($kb('install_all.command')) ?> - double-click it; if macOS blocks it, right-click ▸ Open</span></li>
        </ul>
        <p class="small quiet" style="margin-top:14px">Prefer the source? <a href="<?= h(GITHUB) ?>" rel="noopener">Clone it from GitHub</a> or <a href="<?= h(GITHUB_ZIP) ?>">download the zip</a> - the <a href="<?= h(GITHUB) ?>/blob/main/docs/INSTALL.md" rel="noopener">install guide</a> has the manual steps.</p>
      </div>
      <div>
        <h2>What it runs on</h2>
        <table>
          <tr><th scope="row">System</th><td>Windows 10 or 11, Linux, macOS</td></tr>
          <tr><th scope="row">Graphics card</th><td>NVIDIA with a current driver (RTX 50-series cards need a CUDA 13 driver)</td></tr>
          <tr><th scope="row">Editor only</th><td>Any card - the editors, the timeline and Sketcher need no AI</td></tr>
          <tr><th scope="row">Small AI</th><td>A 6-12 GB card</td></tr>
          <tr><th scope="row">Mid-size AI</th><td>A 12-20 GB card; MiniMax H3 runs in 16 GB mode on a 16 GB card</td></tr>
          <tr><th scope="row">Everything</th><td>A card with 20 GB or more</td></tr>
          <tr><th scope="row">Disk</th><td>100 GB free for the full set of models (ComfyUI is several GB, the MiniMax H3 models about 70 GB)</td></tr>
        </table>
      </div>
    </div>

    <h2 style="margin-top:2em">How it installs</h2>
    <ol class="steps">
      <li><strong>Put the file in a folder of its own</strong>Choose a drive with room for the models. bitGen Studio installs into a <code>Bitgen-Studio</code> folder beside the file.</li>
      <li><strong>Run it</strong>It adds Git and Node.js when they are missing (on Windows also Python), then fetches bitGen Studio from GitHub. On Windows it needs no administrator rights; on Linux it may ask for your password to add Git.</li>
      <li><strong>Pick an edition in the setup window</strong>Editor, Editor + small AI, Editor + mid-size AI or Everything. The setup checks your card first and recommends one.</li>
      <li><strong>Let the downloads finish</strong>ComfyUI, PyTorch, the node packs and the models: plan for an hour or two, almost all of it downloads. The setup shows each step and keeps going if a window is closed.</li>
      <li><strong>Make something</strong>The studio opens when it is done. Start with the <a href="<?= u('guide.php') ?>">guide</a>, or ask in the <a href="<?= u('community.php') ?>">Community</a>.</li>
    </ol>

    <h2 style="margin-top:1.4em">Updating</h2>
    <p>Settings ▸ General ▸ Updates checks GitHub for a new version and installs it (it can check each time the studio starts). What is new in each version is in the <a href="<?= h(GITHUB) ?>/blob/main/misc/CHANGELOG.md" rel="noopener">changelog</a>.</p>

    <h2 style="margin-top:1.4em">A public beta</h2>
    <p>The model manager, image and video generation, music, the local language model and the installer are tested on real hardware. The editors and Sketcher are built and covered by automated tests but need more use on real projects, and the Unreal Engine and Daz Studio links are experimental. Found something wrong? <a href="<?= h(GITHUB_ISSUES) ?>" rel="noopener">Open an issue on GitHub</a> - reports on those parts help the most.</p>
  </div>
</div>
<?php require __DIR__ . '/inc/footer.php'; ?>
