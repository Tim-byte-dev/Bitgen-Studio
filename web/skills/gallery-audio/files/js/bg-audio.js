/* bitGen web skill: 🎵 audio playlist - .bg-playlist > ol > li[data-src] (+ data-title); one player, ▶ / ⏸, a seek bar, the next plays itself */
(function () {
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  document.querySelectorAll(".bg-playlist").forEach(function (pl) {
    var li = Array.prototype.slice.call(pl.querySelectorAll("li[data-src]")); if (!li.length) return;
    var now = document.createElement("div"); now.className = "bg-pl-now";
    now.innerHTML = '<button class="bg-pl-play" type="button" aria-label="Play">▶</button><div style="flex:1;min-width:0"><div class="bg-pl-title"></div><div class="bg-pl-bar"><i></i></div></div><span class="bg-pl-time">0:00</span>';
    pl.insertBefore(now, pl.firstChild);
    var au = new Audio(), at = 0, btn = now.querySelector(".bg-pl-play"), bar = now.querySelector(".bg-pl-bar"), fill = bar.querySelector("i");
    function pick(i, play) { at = i; au.src = li[i].getAttribute("data-src"); now.querySelector(".bg-pl-title").textContent = li[i].getAttribute("data-title") || li[i].textContent.trim(); li.forEach(function (x, k) { x.classList.toggle("on", k === i); }); if (play) au.play(); }
    btn.onclick = function () { if (au.paused) au.play(); else au.pause(); };
    au.onplay = function () { btn.textContent = "⏸"; }; au.onpause = function () { btn.textContent = "▶"; };
    au.ontimeupdate = function () { fill.style.width = (au.duration ? au.currentTime / au.duration * 100 : 0) + "%"; now.querySelector(".bg-pl-time").textContent = fmt(au.currentTime) + " / " + fmt(au.duration); };
    au.onended = function () { if (at + 1 < li.length) pick(at + 1, true); };
    bar.onclick = function (e) { var r = bar.getBoundingClientRect(); if (au.duration) au.currentTime = (e.clientX - r.left) / r.width * au.duration; };
    li.forEach(function (x, i) { x.onclick = function () { pick(i, true); }; });
    pick(0, false);
  });
})();
