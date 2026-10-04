const fs = require("node:fs");
const path = require("node:path");

const FEEDS = [
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", fallback: "tech" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", fallback: "tech" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss", fallback: "crypto" },
];
const OUT = path.join(process.cwd(), "static-data", "live-news.json");

function decode(s = "") {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function tag(block, name) {
  const re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i");
  const m = block.match(re);
  return m ? decode(m[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}
function classify(text, fallback) {
  const s = text.toLowerCase();
  if (/layoff|laid off|redundan|job cuts/.test(s)) return "layoff";
  if (/salary|pay rise|compensation|wage|earnings/.test(s)) return "salary";
  if (/remote work|work from home|distributed team/.test(s)) return "remote";
  if (/bitcoin|ethereum|crypto|blockchain|web3|token/.test(s)) return "crypto";
  if (/artificial intelligence|\\bai\\b|llm|openai|chatgpt|robot|machine learning/.test(s)) return "ai";
  return fallback === "crypto" ? "crypto" : "ai";
}
function parseFeed(xml, feed) {
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  return blocks.map((block) => {
    const title = tag(block, "title");
    let url = tag(block, "link");
    if (!url) {
      const m = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (m) url = decode(m[1]);
    }
    const description = tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded");
    const published = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");
    if (!title || !/^https?:\/\//i.test(url)) return null;
    const excerpt = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    const date = published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : new Date().toISOString();
    return { id: feed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Buffer.from(url).toString("base64url").slice(0, 18), title, url, excerpt, date, source: feed.name, tagType: classify(title + " " + excerpt, feed.fallback), tag: feed.name };
  }).filter(Boolean);
}
async function main() {
  const all = [];
  const failures = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { "user-agent": "RTDJ-NewsWire/1.0 (+https://remotetechdesignjobs.blogspot.com)" }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      all.push(...parseFeed(await res.text(), feed));
    } catch (e) {
      failures.push({ source: feed.name, error: String(e.message || e) });
    }
  }
  const seen = new Set();
  const items = all.filter((item) => {
    const key = item.url.toLowerCase().replace(/[?#].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 60);
  if (items.length === 0) {
    if (fs.existsSync(OUT)) {
      const old = JSON.parse(fs.readFileSync(OUT, "utf8"));
      if (Array.isArray(old.items) && old.items.length) {
        console.warn("All feeds failed or returned no items; preserving previous live-news snapshot.");
        return;
      }
    }
    if (failures.length === FEEDS.length) throw new Error("Every live news feed failed: " + JSON.stringify(failures));
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), itemCount: items.length, failedSources: failures, items }, null, 2) + "\\n");
  console.log("Wrote " + items.length + " live headlines; failed sources: " + failures.length);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
