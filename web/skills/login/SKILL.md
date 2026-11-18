# Member login (bg-auth)
Files: inc/bg-db.php (PDO from inc/config.php), inc/bg-auth.php (bg_user(), bg_require_login(), bg_csrf(), bg_csrf_ok(), bg_login(),
bg_register(), bg_page(), bg_h()), login.php, register.php, account.php (?me=1 = JSON for the page), logout.php (POST + csrf), js/bg-auth.js.
A members-only PHP page: <?php require 'inc/bg-auth.php'; $u = bg_require_login(); ?>. A link with data-bg-account shows the member's name.
The table bg_site_users is made in the site's database on first use. Passwords: password_hash / password_verify.
