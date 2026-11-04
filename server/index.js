require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(express.static(PUBLIC_DIR));

const clean = (value, max = 120) => String(value || "").trim().slice(0, max);
const safeUrl = value => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch (_) { return ""; }
};

function normalize(item, provider, defaults = {}) {
  return {
    id: String(item.id || item.uuid || `${provider}-${Math.random().toString(36).slice(2)}`),
    title: clean(item.title || item.name || "Untitled resource", 180),
    creator: clean(item.creator || item.user || item.username || provider, 100),
    provider,
    category: defaults.category || "other",
    preview: safeUrl(item.preview || item.thumbnail || item.image || ""),
    sourceUrl: safeUrl(item.sourceUrl || item.pageURL || item.url || ""),
    license: clean(item.license || "License information not provided", 300),
    licenseStatus: item.licenseStatus || "unknown",
    duration: item.duration || null
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

async function searchPexels(query, type) {
  if (!process.env.PEXELS_API_KEY || !["images", "videos"].includes(type)) return [];
  const endpoint = type === "videos"
    ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=12`
    : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`;
  const data = await fetchJson(endpoint, { headers: { Authorization: process.env.PEXELS_API_KEY } });
  if (type === "videos") return (data.videos || []).map(video => normalize({
    id: video.id, title: "Pexels video", creator: video.user?.name,
    preview: video.image, sourceUrl: video.url, license: "See Pexels license"
  }, "Pexels", { category: "videos" }));
  return (data.photos || []).map(photo => normalize({
    id: photo.id, title: photo.alt || "Photo", creator: photo.photographer,
    preview: photo.src?.medium, sourceUrl: photo.url,
    license: "See Pexels license", licenseStatus: "permitted"
  }, "Pexels", { category: "images" }));
}

async function searchPixabay(query, type) {
  if (!process.env.PIXABAY_API_KEY || !["images", "videos"].includes(type)) return [];
  const video = type === "videos";
  const endpoint = video ? "videos/" : "";
  const url = `https://pixabay.com/api/${endpoint}?key=${encodeURIComponent(process.env.PIXABAY_API_KEY)}&q=${encodeURIComponent(query)}&per_page=12`;
  const data = await fetchJson(url);
  return (data.hits || []).map(hit => normalize({
    id: hit.id, title: hit.tags || "Pixabay resource", creator: hit.user,
    preview: video ? hit.videos?.tiny?.thumbnail : hit.webformatURL,
    sourceUrl: hit.pageURL, license: "See Pixabay license",
    licenseStatus: "permitted"
  }, "Pixabay", { category: type }));
}

async function searchGiphy(query) {
  if (!process.env.GIPHY_API_KEY) return [];
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(process.env.GIPHY_API_KEY)}&q=${encodeURIComponent(query)}&limit=12&rating=pg`;
  const data = await fetchJson(url);
  return (data.data || []).map(gif => normalize({
    id: gif.id, title: gif.title, creator: gif.username || "GIPHY",
    preview: gif.images?.fixed_width_small?.url, sourceUrl: gif.url,
    license: "Review GIPHY terms and rights", licenseStatus: "unknown"
  }, "GIPHY", { category: "gifs" }));
}

async function searchFreesound(query) {
  if (!process.env.FREESOUND_API_KEY) return [];
  const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&page_size=12&fields=id,name,username,previews,license,url,duration&token=${encodeURIComponent(process.env.FREESOUND_API_KEY)}`;
  const data = await fetchJson(url);
  return (data.results || []).map(sound => normalize({
    id: sound.id, title: sound.name, creator: sound.username,
    preview: sound.previews?.["preview-hq-mp3"], sourceUrl: sound.url,
    license: sound.license || "License not provided", duration: sound.duration,
    licenseStatus: "unknown"
  }, "Freesound", { category: "sfx" }));
}

async function searchJamendo(query) {
  if (!process.env.JAMENDO_CLIENT_ID) return [];
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(process.env.JAMENDO_CLIENT_ID)}&format=json&limit=12&search=${encodeURIComponent(query)}&include=licenses`;
  const data = await fetchJson(url);
  return (data.results || []).map(track => normalize({
    id: track.id, title: track.name, creator: track.artist_name,
    preview: track.audio, sourceUrl: track.shareurl,
    license: track.license_ccurl || "Check track license",
    licenseStatus: "unknown", duration: track.duration
  }, "Jamendo", { category: "music" }));
}

function sourceSearchResults(query, category) {
  const sites = {
    overlays: ["mixkit.co", "productioncrate.com"],
    luts: ["filtergrade.com", "iwltbap.com"],
    templates: ["mixkit.co", "motionarray.com"],
    fonts: ["fonts.google.com", "fontesk.com"]
  }[category] || [];
  return sites.map(site => normalize({
    id: `${category}-${site}`, title: `Search ${site} for “${query}”`,
    creator: site, sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${query}`)}`,
    license: "Check the individual asset license", licenseStatus: "unknown"
  }, "Web search", { category }));
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "EDITVAULT API" }));

app.get("/api/search", async (req, res) => {
  const query = clean(req.query.q, 100);
  const category = clean(req.query.category || "all", 20);
  const allowed = ["all", "music", "sfx", "images", "gifs", "overlays", "luts", "templates", "fonts"];
  if (query.length < 2) return res.status(400).json({ error: "Enter at least 2 characters." });
  if (!allowed.includes(category)) return res.status(400).json({ error: "Unknown resource category." });

  if (["overlays", "luts", "templates", "fonts"].includes(category)) {
    return res.json({ results: sourceSearchResults(query, category) });
  }

  const tasks = [];
  if (category === "all" || category === "images") tasks.push(searchPexels(query, "images"), searchPixabay(query, "images"));
  if (category === "all") tasks.push(searchPexels(query, "videos"), searchPixabay(query, "videos"));
  if (category === "all" || category === "gifs") tasks.push(searchGiphy(query));
  if (category === "all" || category === "sfx") tasks.push(searchFreesound(query));
  if (category === "all" || category === "music") tasks.push(searchJamendo(query));

  const settled = await Promise.allSettled(tasks);
  const results = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const failures = settled.filter(result => result.status === "rejected").length;
  res.json({
    results,
    partialProviderFailures: failures,
    configuredProviders: {
      pexels: Boolean(process.env.PEXELS_API_KEY),
      pixabay: Boolean(process.env.PIXABAY_API_KEY),
      giphy: Boolean(process.env.GIPHY_API_KEY),
      freesound: Boolean(process.env.FREESOUND_API_KEY),
      jamendo: Boolean(process.env.JAMENDO_CLIENT_ID)
    }
  });
});

app.get("*", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.listen(PORT, () => console.log(`EDITVAULT API listening on port ${PORT}`));
    
