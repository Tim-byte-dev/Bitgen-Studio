# Contact and map (bg-contact)
File: js/bg-contact.js + css/bg-contact.css, contact.php (PHP + the CRM's database: the messages table). Markup:
<div class="bg-contact"> with .bg-contact-info (address, phone, email, hours - real ones) and a map <div data-bg-map data-lat data-lon
data-zoom="15" data-label="…"></div> (OpenStreetMap, © OpenStreetMap contributors shown; the coordinates: openstreetmap.org ▸ right-click the
place ▸ Show address), and <form class="bg-contact-form" data-bg-contact> with inputs name, email, subject, message and the hidden
<div class="bg-hp"><input name="website"></div> (a trap for robots - keep it). Sent messages land in the CRM's ✉ Messages; when inc/config.php
defines CONTACT_EMAIL the site also emails it there. Pages: contact.html.
