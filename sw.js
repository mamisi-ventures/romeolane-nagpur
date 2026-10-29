/* Romeo Lane Nagpur — offline support for the installed app.
   Pages: network first, falling back to the saved copy when offline.
   Images, styles and scripts on this site: served from the saved copy, refreshed in the background.
   Bookings and the Lane Club (Supabase) always go to the network and are never saved here. */
var VERSION = "rl-2026-10-30";
var SHELL = [
  "/", "/index.html", "/app.js", "/config.js", "/manifest.webmanifest",
  "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/favicon.png",
  "/word-gold.png", "/logo-gold.png", "/leaves-gold.png", "/leaves-crimson.png",
  "/venue-dining.webp", "/venue-terrace-night.webp", "/venue-hall.webp", "/venue-backbar.webp"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // database, fonts and maps go straight to the network

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put("/index.html", copy); });
      return res;
    }).catch(function () { return caches.match("/index.html"); }));
    return;
  }

  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
