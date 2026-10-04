/*
 * Remote Tech & Design Jobs — static data client for Blogger.
 * No framework, no database, no provider API calls from the browser.
 *
 * Usage:
 *   const jobs = await RTDJJobs.loadCategory('dev');
 *   const results = await RTDJJobs.search('motion designer');
 *   const job = await RTDJJobs.getBySlug('example-job-slug');
 */
(function (global) {
  'use strict';

  const memory = new Map();
  const pending = new Map();
  const manifestPromises = new Map();

  function normalizeBase(baseUrl) {
    return String(baseUrl || '').replace(/\/+$/, '');
  }

  function cacheKey(url) {
    return 'rtdj:v1:' + url;
  }

  async function fetchJson(url) {
    if (memory.has(url)) return memory.get(url);
    if (pending.has(url)) return pending.get(url);

    const request = fetch(url, { cache: 'force-cache' })
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

  async function getManifest(baseUrl) {
    const base = normalizeBase(baseUrl);
    if (!manifestPromises.has(base)) manifestPromises.set(base, fetchJson(base + '/manifest.json'));
    return manifestPromises.get(base);
  }

  async function getChunks(baseUrl, paths) {
    const base = normalizeBase(baseUrl);
    const unique = Array.from(new Set(paths || []));
    return (await Promise.all(unique.map(function (path) {
      return fetchJson(base + '/' + path);
    }))).flat();
  }

  async function loadSearchIndex(baseUrl) {
    const manifest = await getManifest(baseUrl);
    return getChunks(baseUrl, manifest.searchChunks || []);
  }

  async function loadCategory(baseUrl, category) {
    const manifest = await getManifest(baseUrl);
    const paths = (manifest.categoryChunks || {})[category] || [];
    return getChunks(baseUrl, paths);
  }

  async function getBySlug(baseUrl, slug) {
    const manifest = await getManifest(baseUrl);
    const search = await getChunks(baseUrl, manifest.searchChunks || []);
    const meta = search.find(function (job) { return job.slug === slug; });
    if (!meta) return null;
    const paths = (manifest.fullJobChunks || {})[meta.category] || [];
    const results = await Promise.allSettled(paths.map(function (path) { return fetchJson(normalizeBase(baseUrl) + '/' + path); }));
    const jobs = results.filter(function (result) { return result.status === 'fulfilled' && Array.isArray(result.value); }).flatMap(function (result) { return result.value; });
    return jobs.find(function (job) { return job.slug === slug; }) || null;
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
      for (const token of q.split(/\s+/).filter(Boolean)) {
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
