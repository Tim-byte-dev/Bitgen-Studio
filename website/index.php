<?php
/* tigerart.com.au — the home page: bitGen Studio, the only product. */
$title = ''; $here = '';
require __DIR__ . '/inc/header.php';
$S = site();
$n = (int) $S['featureCount'];
$rows = [
    ['video-docker', 'From one sentence to a whole film', 'A local language model writes the screenplay. The StoryBoard turns each scene into a shot, and the characters keep their faces and their own cloned voices from scene to scene.', [
        'Films with dialogue, or music videos cut to the beats of a song',
        'MiniMax H3, LTX and Wan video models through ComfyUI',
        'Character swap, lip sync, VR footage and SeedVR2 upscaling'], 'A StoryBoard of scenes, each with its picture, prompt and shot'],
    ['timeline', 'Cut it on a real timeline', 'Layers, keyframes, effects and adjustment layers on a preview canvas, with the tools you expect from an editor.', [
        'Colour grading, masks and tracking, multicam and nesting',
        'Captions, karaoke with a bouncing ball, transitions and a track mixer',
        'Proxies for big footage; export when it is right'], 'The timeline with its layers and keyframes'],
    ['image-editor', 'Paint, comp and design', 'An image editor with layers, masks, smart objects and adjustment layers - and the AI in it, for generating, refining and filling.', [
        'Selections, painting, retouching, puppet warp and liquify',
        'Type with OpenType features, vector shapes and the pen',
        'CAD sketch layers with real dimensions and a parametric 3D body'], 'The image editor'],
    ['sketcher', 'Build the set', 'Sketcher is quick 3D modelling: draw, push and pull, then whole rooms and houses with shared walls, doors, windows, roofs and stairs.', [
        'Floor plans, sections and printable sheets',
        'Lights and cameras, then render the room as a shot',
        'Blender, Daz Studio and Unreal Engine links for the heavy lifting'], 'A house in Sketcher'],
    ['music', 'Score it and give it a voice', 'Songs, stems and sound effects made on your own card, and voices cloned from a few seconds of speech.', [
        'Music with MiniMax Music3 and YuE2, and split stems',
        'Text to speech in your characters\' voices, speech to text',
        'A sound effects docker that fills a scene with sound'], 'The music docker'],
];
?>
<section class="hero" aria-label="bitGen Studio">
  <div class="wrap">
  <div class="film"><video muted playsinline autoplay preload="metadata" poster="<?= u('assets/img/intro-poster.jpg') ?>" aria-hidden="true">
    <source src="<?= u('assets/media/intro.mp4') ?>" type="video/mp4">
  </video></div>
    <div class="say">
      <span class="beta">Public beta - free</span>
      <h1>Make films on your own computer</h1>
      <p class="lede">bitGen Studio writes the screenplay, renders the scenes, scores the music and cuts it together. It runs on your own graphics card, with no accounts and no cloud.</p>
      <div class="acts">
        <a class="btn go" href="<?= u('download.php') ?>"><?= dl_icon() ?>Download bitGen Studio</a>
        <a class="btn alt" href="<?= h(GITHUB) ?>" rel="noopener"><?= gh_icon() ?>See it on GitHub</a>
      </div>
    </div>
  </div>
</section>

<div class="wrap screen">
  <figure>
    <img src="<?= u('assets/img/overview.jpg') ?>" width="1600" height="900" alt="The bitGen Studio window: references on the left, the preview in the middle, the prompt below it and the gallery on the right" loading="lazy">
    <figcaption>The whole studio in one window. Every panel is a docker you can float, dock or tuck away.</figcaption>
  </figure>
</div>

<section class="does" aria-labelledby="does-h">
  <div class="wrap">
    <h2 id="does-h">One studio for the whole film</h2>
<?php foreach ($rows as [$img, $h3, $p, $li, $alt]): ?>
    <div class="row">
      <div>
        <h3><?= h($h3) ?></h3>
        <p><?= h($p) ?></p>
        <ul>
<?php foreach ($li as $x): ?>
          <li><?= h($x) ?></li>
<?php endforeach; ?>
        </ul>
      </div>
      <div class="pic"><img src="<?= u('assets/img/' . $img . '.jpg') ?>" alt="<?= h($alt) ?>" loading="lazy"></div>
    </div>
<?php endforeach; ?>
    <p class="small quiet">That is the short version. <a href="<?= u('features.php') ?>">Every feature</a> - <?= $n ?: '900+' ?> of them - is listed with where to find it.</p>
  </div>
</section>

<hr class="stroke">

<section class="yours" aria-labelledby="yours-h">
  <div class="wrap">
    <h2 id="yours-h">Your computer, your files</h2>
    <dl>
      <div><dt>Nothing leaves your machine</dt><dd>The models run on your graphics card. Projects, pictures and films stay in folders on your own disk.</dd></div>
      <div><dt>No accounts</dt><dd>No sign-up, no subscription and no credits to buy. The Community is the only part that goes online, and only if you join it.</dd></div>
      <div><dt>Fits the card you have</dt><dd>Pick an edition for your card, from the editor alone to everything. 16 GB mode runs MiniMax H3 on a 16 GB card.</dd></div>
      <div><dt>In four languages</dt><dd>The app and its guide in English, 简体中文, 繁體中文 and 日本語. Change it from the menu bar at any time.</dd></div>
      <div><dt>Open source</dt><dd>Every line is on GitHub under the MIT licence. Read it, change it, and send improvements back.</dd></div>
      <div><dt>Help from people</dt><dd>Stuck? Ask in the Community's Help room, right inside the app, or open an issue on GitHub.</dd></div>
    </dl>
  </div>
</section>

<section class="get" aria-labelledby="get-h">
  <div class="wrap grid">
    <div>
      <h2 id="get-h">Get bitGen Studio</h2>
      <p class="lede">One small installer sets up everything: the app, ComfyUI, the node packs and the models for your card.</p>
      <div class="acts">
        <a class="btn go" href="<?= u('download.php') ?>"><?= dl_icon() ?>Download and install</a>
        <a class="btn alt" href="<?= u('guide.php') ?>">Read the guide</a>
      </div>
    </div>
    <table>
      <caption class="quiet small" style="text-align:left;caption-side:top;padding-bottom:6px">What it runs on</caption>
      <tr><th scope="row">System</th><td>Windows 10 or 11, Linux, macOS</td></tr>
      <tr><th scope="row">Graphics card</th><td>NVIDIA with a current driver. 6-12 GB for the small AI, 16 GB for MiniMax H3 in 16 GB mode, 20 GB or more for everything. The editors need no AI at all.</td></tr>
      <tr><th scope="row">Disk</th><td>100 GB free for the full set of models</td></tr>
      <tr><th scope="row">Price</th><td>Free</td></tr>
    </table>
  </div>
</section>
<?php require __DIR__ . '/inc/footer.php'; ?>
