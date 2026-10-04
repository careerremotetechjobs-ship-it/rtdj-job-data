/*
 * Remote Tech & Design Jobs — static data client for Blogger.
 * No framework, no database, no provider API calls from the browser.
 *
 * Cache strategy:
 * - Revalidate the manifest on each page load so new published data is discovered.
 * - Pin data-chunk URLs to manifest.generatedAt so CDN/browser caches cannot mix
 *   an older chunk with a newer manifest.
 */
(function (global) {
  'use strict';

  const memory = new Map();
  const pending = new Map();
  const manifestPromises = new Map();

  function normalizeBase(baseUrl) {
    return String(baseUrl || '').replace(/\\/+$/, '');
  }

  async function fetchJson(url, options) {
    if (memory.has(url)) return memory.get(url);
    if (pending.has(url)) return pending.get(url);

    const request = fetch(url, options || { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('Job data request failed: ' + response.status);
        return response.json();
      })
      .then(function (data) {
        memory.set(url, data);
        return data;
      })
      .finally(function () {
        pending.delete(url);
      });

    pending.set(url, request);
    return request;
  }

  function versionedUrl(baseUrl, path, version) {
    const url = normalizeBase(baseUrl) + '/' + String(path || '').replace(/^\\/+/, '');
    if (!version) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(String(version));
  }

  async function getManifest(baseUrl) {
    const base = normalizeBase(baseUrl);
    if (!manifestPromises.has(base)) {
      // Unique query string plus no-store bypasses old browser/CDN manifest entries.
      const url = base + '/manifest.json?refresh=' + Date.now();
      const request = fetchJson(url, { cache: 'no-store' });
      manifestPromises.set(base, request);
      request.catch(function () { manifestPromises.delete(base); });
    }
    return manifestPromises.get(base);
  }

  async function getChunks(baseUrl, paths, version) {
    const unique = Array.from(new Set(paths || []));
    return (await Promise.all(unique.map(function (path) {
      return fetchJson(versionedUrl(baseUrl, path, version));
    }))).flat();
  }

  async function loadSearchIndex(baseUrl) {
    const manifest = await getManifest(baseUrl);
    return getChunks(baseUrl, manifest.searchChunks || [], manifest.generatedAt);
  }

  async function loadCategory(baseUrl, category) {
    const manifest = await getManifest(baseUrl);
    const paths = (manifest.categoryChunks || {})[category] || [];
    return getChunks(baseUrl, paths, manifest.generatedAt);
  }

  async function getBySlug(baseUrl, slug) {
    const manifest = await getManifest(baseUrl);
    const search = await getChunks(baseUrl, manifest.searchChunks || [], manifest.generatedAt);
    const meta = search.find(function (job) { return job.slug === slug; });
    if (!meta) return null;
    const paths = (manifest.fullJobChunks || {})[meta.category] || [];
    for (const path of paths) {
      const url = versionedUrl(baseUrl, path, manifest.generatedAt);
      try {
        // Detail payloads are fetched independently so a failed/stale chunk cannot
        // silently turn a complete job into a metadata-only page.
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;
        const payload = await response.json();
        const jobs = Array.isArray(payload) ? payload
          : Array.isArray(payload.jobs) ? payload.jobs
          : Array.isArray(payload.items) ? payload.items : [];
        const match = jobs.find(function (job) { return job.slug === slug || job.id === meta.id; });
        if (match) return match;
      } catch (error) {
        // Continue through remaining full-detail chunks.
      }
    }
    return null;
  }

  function score(job, query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return 0;
    const fields = [
      ['title', 8], ['company', 5], ['category', 4], ['tags', 3],
      ['region', 2], ['workplaceType', 2], ['type', 1]
    ];
    let total = 0;
    for (const [field, weight] of fields) {
      const value = Array.isArray(job[field]) ? job[field].join(' ') : String(job[field] || '');
      const haystack = value.toLowerCase();
      if (!haystack) continue;
      if (haystack === q) total += weight * 4;
      else if (haystack.includes(q)) total += weight;
      for (const token of q.split(/\\s+/).filter(Boolean)) {
        if (haystack.includes(token)) total += weight * 0.25;
      }
    }
    return total;
  }

  async function search(baseUrl, query, options) {
    const opts = options || {};
    const index = await loadSearchIndex(baseUrl);
    const q = String(query || '').trim();
    let rows = index;
    if (opts.category) rows = rows.filter(function (job) { return job.category === opts.category; });
    if (opts.remoteOnly) rows = rows.filter(function (job) { return job.workplaceType === 'remote' || job.verifiedRemote; });
    if (opts.region) rows = rows.filter(function (job) { return String(job.region || '').toLowerCase().includes(String(opts.region).toLowerCase()); });
    if (q) rows = rows.map(function (job) { return { job: job, score: score(job, q) }; }).filter(function (item) { return item.score > 0; }).sort(function (a, b) { return b.score - a.score; }).map(function (item) { return item.job; });
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  }

  global.RTDJJobs = {
    getManifest,
    loadSearchIndex,
    loadCategory,
    getBySlug,
    search,
  };
})(window);
