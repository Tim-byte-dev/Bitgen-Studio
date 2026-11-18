# AJAX (bg-ajax)
File: js/bg-ajax.js (window.BG: json(url), post(url, data|FormData), esc, fill, lists()).
- [data-bg-list="data/content.json#posts"] (or #products) with a <template> inside: one copy per item, {{key}} replaced (escaped);
  data-bg-limit, data-bg-empty. Items with published false are left out.
- form[data-bg-ajax][action] is posted with fetch; the server answers JSON {ok, message}; the message goes into [data-bg-result].
