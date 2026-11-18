/* bitGen web skill: 🧊 3D models - .bg-model[data-src="media/model.glb"] (.glb / .gltf / .obj): drag to turn, wheel / pinch to zoom,
   data-rotate="0" stops it turning by itself, data-caption. Uses js/vendor/three-m3d.min.js (three.js, MIT - LICENSE-three.txt). */
(function () {
  function view(box) {
    var T = window.H3THREE; if (!T) { box.innerHTML = '<div class="bg-model-msg">js/vendor/three-m3d.min.js is missing</div>'; return; }
    var src = box.getAttribute("data-src"), r = new T.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); box.appendChild(r.domElement);
    var sc = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 0.01, 1000);
    sc.add(new T.HemisphereLight(0xffffff, 0x777788, 1.4)); var d = new T.DirectionalLight(0xffffff, 1.6); d.position.set(3, 5, 4); sc.add(d);
    var c = new T.OrbitControls(cam, r.domElement); c.enableDamping = true; c.autoRotate = box.getAttribute("data-rotate") !== "0"; c.autoRotateSpeed = 1.2;
    if (box.getAttribute("data-caption")) { var cp = document.createElement("div"); cp.className = "bg-model-cap"; cp.textContent = box.getAttribute("data-caption"); box.appendChild(cp); }
    function fit(o) { var b = new T.Box3().setFromObject(o), s = b.getSize(new T.Vector3()).length() || 1, ctr = b.getCenter(new T.Vector3()); o.position.sub(ctr); cam.position.set(s * 0.6, s * 0.4, s * 0.9); cam.near = s / 100; cam.far = s * 100; cam.updateProjectionMatrix(); c.target.set(0, 0, 0); c.update(); }
    var done = function (o) { sc.add(o); fit(o); }, fail = function () { box.insertAdjacentHTML("beforeend", '<div class="bg-model-msg">the model did not load: ' + src + "</div>"); };
    if (/\.obj$/i.test(src)) new T.OBJLoader().load(src, done, undefined, fail); else new T.GLTFLoader().load(src, function (g) { done(g.scene); }, undefined, fail);
    function size() { var w = box.clientWidth, h = box.clientHeight || w * 0.75; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    size(); if (window.ResizeObserver) new ResizeObserver(size).observe(box);
    (function loop() { requestAnimationFrame(loop); c.update(); r.render(sc, cam); })();
  }
  var boxes = document.querySelectorAll(".bg-model[data-src]");
  if (!("IntersectionObserver" in window)) { boxes.forEach(view); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); view(e.target); } }); }, { rootMargin: "200px" });
  boxes.forEach(function (b) { io.observe(b); });
})();
