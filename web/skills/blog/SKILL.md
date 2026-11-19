# Blog and news (bg-blog)
File: js/bg-blog.js + css/bg-blog.css (no PHP). The posts are data/content.json's "posts" (the Web editor's 🗂 CRM ▸ 📰 Posts):
{title, date YYYY-MM-DD, slug, image, body, published}. Markup: <div data-bg-blog data-per="6"></div> = the news list (newest first, pages of
data-per; blog.html?p=<slug> shows one post, ?page=2 the next page). <div data-bg-blog-latest data-n="3" data-href="blog.html"></div> = the
latest few as cards (for the home page). A post's text: a blank line starts a new paragraph, web addresses become links.
Pages: blog.html.
