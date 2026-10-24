add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' https:; connect-src 'self' blob: https://supabase-staging.maucore.cl wss://supabase-staging.maucore.cl https://kcfuixvrwbnizspgtmtr.supabase.co wss://kcfuixvrwbnizspgtmtr.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' mailto: https://wa.me; upgrade-insecure-requests" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
