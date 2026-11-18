/* bitGen web skill: 🔐 member login - [data-bg-account] says "Log in" or the member's name (account.php?me=1) */
(function () {
  var links = document.querySelectorAll("[data-bg-account]"); if (!links.length) return;
  fetch("account.php?me=1", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    links.forEach(function (a) { if (j && j.ok) { a.textContent = "👤 " + (j.name || j.email); a.href = "account.php"; } });
  }).catch(function () {});
})();
