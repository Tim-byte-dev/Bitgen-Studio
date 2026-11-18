# Layout (bg-layout)
Files: css/bg-layout.css, js/bg-layout.js. Structure:
- header.bg-header > .bg-wrap > a.bg-brand + button.bg-menu-btn (☰ on phones) + nav.bg-nav (links; this page's link gets .on)
- section.bg-hero (big centred headline; background-image inline for a photo), section.bg-section (.soft = tinted)
- .bg-wrap = centred content at --bg-max; .bg-grid = auto-fill card grid (--bg-min sets the card width); .bg-cols = two columns, one on phones
- footer.bg-footer. Combine with the theme skill's .bg-btn / .bg-card.
