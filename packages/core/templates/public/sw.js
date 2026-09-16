// Empty service worker to prevent 404 errors
// This file exists only to stop browsers from requesting a non-existent service worker

self.addEventListener('install', function() {
  // No caching or special behavior
});

self.addEventListener('fetch', function() {
  // No fetch interception
});
