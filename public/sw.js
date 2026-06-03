// Embergo service worker. Handles incoming Web Push events and forwards
// clicks back to the app. Intentionally no caching — keep the worker simple.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Embergo", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Embergo";
  const options = {
    body: data.body || "",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag: data.tag || "embergo",
    data: { url: data.url || "/app/home" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // If an app tab is already open, focus it and navigate.
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      // Otherwise open fresh.
      await clients.openWindow(url);
    })(),
  );
});

// Take control of pages as soon as installed/activated.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
