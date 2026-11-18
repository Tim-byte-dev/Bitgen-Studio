/* bitGen web skill: 🛍 shop - the products of data/content.json (the Web editor's 🛍 Products):
   [data-bg-catalog]  the catalogue: category chips + search, product cards (→ product.html?p=<slug>), ＋ Add
   [data-bg-product]  one product (product.html?p=<slug>): picture, price, stock, quantity, Add to cart
   [data-bg-cart]     the cart (quantities, remove, the total)      [data-bg-cart-count]  how many in the cart
   form[data-bg-checkout]  the order -> checkout.php (the server prices it again from content.json and saves it in the site's database)
   The cart lives in this browser (localStorage "bg-cart"). Currency: <body data-bg-currency="$">. */
(function () {
  var DATA = "data/content.json", KEY = "bg-cart";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cur() { return (document.body && document.body.getAttribute("data-bg-currency")) || "$"; }
  function money(n) { return cur() + (Math.round((+n || 0) * 100) / 100).toFixed(2); }
  var prodP = null;
  function products() { if (!prodP) prodP = fetch(DATA, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) { return (d.products || []).filter(function (p) { return p.published !== false; }); }); return prodP; }
  function priceOf(p) { return p.sale != null && p.sale !== "" && +p.sale < +p.price ? +p.sale : +p.price; }
  function priceHtml(p) { return '<span class="bg-price">' + (priceOf(p) < +p.price ? "<s>" + money(p.price) + "</s>" : "") + money(priceOf(p)) + "</span>"; }
  function cart() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function setCart(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} paintCount(); document.dispatchEvent(new CustomEvent("bg-cart")); }
  function add(slug, qty) { var c = cart(), it = c.find(function (x) { return x.slug === slug; }); if (it) it.qty += qty || 1; else c.push({ slug: slug, qty: qty || 1 }); setCart(c); }
  function paintCount() { var n = cart().reduce(function (a, x) { return a + x.qty; }, 0); document.querySelectorAll("[data-bg-cart-count]").forEach(function (e) { e.textContent = n; e.hidden = !n; }); }
  function card(p) {
    var url = "product.html?p=" + encodeURIComponent(p.slug);
    return '<div class="bg-product-card"><a class="pic" href="' + url + '">' + (p.image ? '<img loading="lazy" src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : "") + '</a><div class="body"><a href="' + url + '">' + esc(p.name) + "</a>" + priceHtml(p)
      + '<button class="bg-btn" type="button" data-bg-add="' + esc(p.slug) + '"' + (p.stock === 0 ? " disabled" : "") + ">" + (p.stock === 0 ? "Sold out" : "＋ Add to cart") + "</button></div></div>";
  }
  function catalogue(box) {
    products().then(function (list) {
      var cats = []; list.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); }); cats.sort(function (a, b) { return a.localeCompare(b); });
      var want = new URLSearchParams(location.search).get("c") || "";
      box.innerHTML = '<div class="bg-shop-tools"><input class="bg-input" type="search" placeholder="Search" aria-label="Search"></div>' + (cats.length ? '<div class="bg-chips"><button type="button" data-c="" class="on">All</button>' + cats.map(function (c) { return '<button type="button" data-c="' + esc(c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" : "") + '<div class="bg-products"></div>';
      var grid = box.querySelector(".bg-products"), q = box.querySelector("input"), cat = want;
      function paint() { var w = q.value.trim().toLowerCase(), shown = list.filter(function (p) { return (!cat || p.category === cat) && (!w || (p.name + " " + p.description + " " + p.category).toLowerCase().indexOf(w) >= 0); }); grid.innerHTML = shown.map(card).join("") || '<p class="bg-dim">No products found.</p>'; box.querySelectorAll(".bg-chips button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-c") === cat); }); }
      q.oninput = paint; box.addEventListener("click", function (e) { var b = e.target.closest(".bg-chips button"); if (b) { cat = b.getAttribute("data-c"); paint(); } });
      paint();
    }).catch(function () { box.innerHTML = '<p class="bg-note err">The products could not be read (data/content.json).</p>'; });
  }
  function product(box) {
    var slug = new URLSearchParams(location.search).get("p") || box.getAttribute("data-bg-product");
    products().then(function (list) {
      var p = list.find(function (x) { return x.slug === slug; }); if (!p) { box.innerHTML = '<p class="bg-note err">That product is not here. <a href="shop.html">Back to the shop</a></p>'; return; }
      document.title = p.name + " - " + document.title;
      box.innerHTML = '<div class="bg-product"><div>' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : "") + "</div><div><p class=\"bg-dim\">" + esc(p.category) + "</p><h1>" + esc(p.name) + "</h1><p>" + priceHtml(p) + "</p>"
        + "<p>" + esc(p.description).replace(/\n/g, "<br>") + "</p>" + (p.stock === 0 ? '<p class="bg-note err">Sold out</p>' : '<p><label>Quantity <input class="bg-input bg-qty" type="number" min="1" max="' + (p.stock || 99) + '" value="1"></label></p><button class="bg-btn" type="button" data-bg-add="' + esc(p.slug) + '">＋ Add to cart</button> <a class="bg-btn ghost" href="cart.html">View the cart</a>') + "</div></div>";
    });
  }
  function cartBox(box) {
    products().then(function (list) {
      function paint() {
        var c = cart(), total = 0, rows = c.map(function (it) { var p = list.find(function (x) { return x.slug === it.slug; }); if (!p) return ""; var line = priceOf(p) * it.qty; total += line; return '<tr data-s="' + esc(p.slug) + '"><td>' + esc(p.name) + "</td><td>" + money(priceOf(p)) + '</td><td><input class="bg-input" type="number" min="0" value="' + it.qty + '"></td><td>' + money(line) + '</td><td><button class="bg-btn ghost" type="button" data-rm>✕</button></td></tr>'; }).join("");
        box.innerHTML = c.length ? '<table class="bg-cart-table"><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr>' + rows + '</table><div class="bg-cart-total">Total ' + money(total) + '</div><p style="text-align:right"><a class="bg-btn" href="checkout.html">Checkout →</a></p>' : '<p class="bg-dim">Your cart is empty. <a href="shop.html">Go shopping</a></p>';
      }
      box.addEventListener("change", function (e) { var tr = e.target.closest("tr[data-s]"); if (!tr) return; var c = cart(), it = c.find(function (x) { return x.slug === tr.getAttribute("data-s"); }); if (it) it.qty = Math.max(0, Math.round(+e.target.value || 0)); setCart(c.filter(function (x) { return x.qty > 0; })); paint(); });
      box.addEventListener("click", function (e) { if (!e.target.closest("[data-rm]")) return; var s = e.target.closest("tr").getAttribute("data-s"); setCart(cart().filter(function (x) { return x.slug !== s; })); paint(); });
      paint();
    });
  }
  function checkout(f) {
    var out = f.querySelector("[data-bg-result]") || f.appendChild(Object.assign(document.createElement("div"), {}));
    f.addEventListener("submit", function (e) {
      e.preventDefault(); var c = cart(); if (!c.length) { out.className = "bg-note err"; out.textContent = "Your cart is empty."; return; }
      var data = {}; new FormData(f).forEach(function (v, k) { data[k] = v; }); var btn = f.querySelector("[type=submit]"); if (btn) btn.disabled = true;
      out.className = "bg-note"; out.textContent = "Placing the order…";
      fetch(f.getAttribute("action") || "checkout.php", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ items: c, customer: data }) })
        .then(function (r) { if (r.status === 404) throw new Error("Orders need the site's PHP (checkout.php) on a host with PHP and the database."); return r.json(); })
        .then(function (j) { if (!j.ok) throw new Error(j.message || "The order was not taken."); setCart([]); f.innerHTML = '<div class="bg-note"><b>Thank you!</b> Your order number is ' + esc(j.number) + ". " + esc(j.message || "") + "</div>"; })
        .catch(function (er) { out.className = "bg-note err"; out.textContent = er.message; if (btn) btn.disabled = false; });
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-bg-add]"); if (!b) return;
    var q = b.parentNode.querySelector(".bg-qty"); add(b.getAttribute("data-bg-add"), q ? Math.max(1, Math.round(+q.value || 1)) : 1);
    var t = b.textContent; b.textContent = "✓ Added"; setTimeout(function () { b.textContent = t; }, 1200);
  });
  function boot() {
    paintCount();
    document.querySelectorAll("[data-bg-catalog]").forEach(catalogue); document.querySelectorAll("[data-bg-product]").forEach(product);
    document.querySelectorAll("[data-bg-cart]").forEach(cartBox); document.querySelectorAll("form[data-bg-checkout]").forEach(checkout);
  }
  window.BGShop = { products: products, cart: cart, setCart: setCart, add: add, money: money, priceOf: priceOf };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
