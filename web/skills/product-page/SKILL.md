# Product page (bg-shop)
File: js/bg-shop.js + css/bg-shop.css (window.BGShop). The products are data/content.json's "products" (the Web editor's 🗂 CRM ▸ 🛍 Products):
{name, slug, category, price, sale, stock, image, description, published}. Markup hooks: [data-bg-catalog] (catalogue: chips + search;
shop.html?c=<category> opens one category), [data-bg-product] (product.html?p=<slug>), [data-bg-cart], [data-bg-cart-count],
form[data-bg-checkout][action=checkout.php], [data-bg-add="<slug>"] on any button. <body data-bg-currency="$">.
Pages: product.html (?p=<slug>); data-bg-product="<slug>" shows one product anywhere.
