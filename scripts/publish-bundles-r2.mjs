#!/usr/bin/env node
/**
 * Publishes built app bundles to Cloudflare R2 and flips them live.
 *
 * Layout, and why:
 *
 *   minigames/<slug>/<version>/**            the bundle, immutable for a year
 *   meta/minigames/<slug>/latest.json        the pointer, 60s
 *   catalog/minigames.json                   meta + logo for the launcher, 60s
 *
 * Putting the version in the path makes every bundle object immutable: a new
 * build is a new URL, so nothing ever needs cache-busting and a rollback is a
 * pointer rewrite instead of a re-upload. The platform reads only the pointer
 * and the catalog, and never has to know how an app was built.
 *
 * Auth uses the R2 S3 API with a Cloudflare API token: access key id is the
 * token id, secret is the sha256 of the token value. That avoids minting a
 * separate pair of R2 access keys.
 *
 * Usage:
 *   node scripts/publish-bundles-r2.mjs [--dry-run] [slug ...]
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const KIND = "minigames";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appsRoot = path.join(repoRoot, "apps");
const NON_APP_DIRS = new Set(["tests"]);

const dryRun = process.argv.includes("--dry-run");
const selected = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const POINTER_CACHE = "public, max-age=60, stale-while-revalidate=300";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function requireEnv(name, fallback) {
  const value = String(process.env[name] || fallback || "").trim();
  if (!value) {
    console.error(`publish-bundles-r2: ${name} is required`);
    process.exit(2);
  }
  return value;
}

const accountId = dryRun ? String(process.env.CLOUDFLARE_ACCOUNT_ID || "dry-run") : requireEnv("CLOUDFLARE_ACCOUNT_ID");
const bucket = String(process.env.MINIAPP_R2_BUCKET || "miniapps").trim();
const cdnBase = String(process.env.MINIAPP_CDN_BASE_URL || "https://meshmini.app").trim().replace(/\/+$/, "");
const apiToken = dryRun ? String(process.env.CLOUDFLARE_API_TOKEN || "") : requireEnv("CLOUDFLARE_API_TOKEN");
const tokenId = dryRun ? String(process.env.CF_API_TOKEN_ID || "") : requireEnv("CF_API_TOKEN_ID");

const accessKeyId = tokenId;
const secretAccessKey = apiToken ? crypto.createHash("sha256").update(apiToken, "utf8").digest("hex") : "";
const s3Host = `${accountId}.r2.cloudflarestorage.com`;
const AWS_REGION = "auto";
const AWS_SERVICE = "s3";

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function putObject(key, body, cacheControl) {
  const contentType = contentTypeFor(key);
  if (dryRun) return { key, bytes: body.length, contentType, cacheControl, uploaded: false };

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body);
  const canonicalUri = `/${[bucket, ...key.split("/")].map(encodeRfc3986).join("/")}`;
  const headers = {
    "cache-control": cacheControl,
    "content-type": contentType,
    host: s3Host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${String(headers[name]).trim()}\n`)
    .join("");
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), AWS_REGION), AWS_SERVICE), "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const response = await fetch(`https://${s3Host}${canonicalUri}`, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`PUT ${key} failed: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
  return { key, bytes: body.length, contentType, cacheControl, uploaded: true };
}

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function asString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}

/**
 * OneGate wants a stable numeric dapp id. Manifests may pin one; otherwise
 * derive it from the app id with FNV-1a so it never moves between releases.
 */
function stableOneGateId(appId) {
  let hash = 2166136261;
  for (let index = 0; index < appId.length; index += 1) {
    hash ^= appId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 1) || 1;
}

function resolveOneGateId(manifest, appId) {
  const onegate = manifest.onegate && typeof manifest.onegate === "object" ? manifest.onegate : {};
  const raw = asString(onegate.id || onegate.app_id || onegate.dapp_id);
  if (/^[1-9][0-9]{0,9}$/.test(raw)) return Number(raw);
  return stableOneGateId(appId);
}

function localizedJson(en, zh, ja) {
  const localized = { en: asString(en) };
  if (asString(zh) && asString(zh) !== asString(en)) localized.zh = asString(zh);
  if (asString(ja)) localized.ja = asString(ja);
  return JSON.stringify(localized);
}

async function main() {
  const entries = await fs.readdir(appsRoot, { withFileTypes: true });
  const published = [];
  const skipped = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || NON_APP_DIRS.has(entry.name)) continue;
    const slug = entry.name;
    if (selected.size > 0 && !selected.has(slug)) continue;

    const appDir = path.join(appsRoot, slug);
    const manifestPath = path.join(appDir, "neo-manifest.json");
    const distDir = path.join(appDir, "dist");
    if (!(await exists(manifestPath))) continue;
    if (!(await exists(path.join(distDir, "index.html")))) {
      skipped.push({ slug, reason: "missing dist/index.html - run npm run build first" });
      continue;
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const appId = asString(manifest.id, `miniapp-${slug}`);
    const version = asString(manifest.version, "1.0.0");
    const prefix = `${KIND}/${slug}/${version}`;

    const files = await walk(distDir);
    let bytes = 0;
    for (const rel of files) {
      const body = await fs.readFile(path.join(distDir, rel));
      bytes += body.length;
      await putObject(`${prefix}/${rel}`, body, IMMUTABLE_CACHE);
    }
    // The manifest travels with the bundle so the platform can read an app's
    // declared contracts and permissions straight off the CDN.
    const manifestBody = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await putObject(`${prefix}/neo-manifest.json`, manifestBody, IMMUTABLE_CACHE);

    const entryUrl = `${cdnBase}/${prefix}/index.html`;
    const pointer = {
      app_id: appId,
      slug,
      kind: KIND,
      version,
      entry_url: entryUrl,
      base_url: `${cdnBase}/${prefix}`,
      manifest_url: `${cdnBase}/${prefix}/neo-manifest.json`,
      file_count: files.length + 1,
      bytes,
      published_at: new Date().toISOString(),
    };
    await putObject(
      `meta/${KIND}/${slug}/latest.json`,
      Buffer.from(`${JSON.stringify(pointer, null, 2)}\n`, "utf8"),
      POINTER_CACHE,
    );

    published.push({ manifest, pointer });
    process.stdout.write(`[publish] ${slug}@${version} ${files.length + 1} files ${(bytes / 1024).toFixed(0)}KB\n`);
  }

  // The catalog is what the launcher renders before anything is loaded, so it
  // carries meta and artwork only - never a bundle URL the grid would fetch.
  const catalogApps = published.map(({ manifest, pointer }) => {
    const urls = manifest.urls && typeof manifest.urls === "object" ? manifest.urls : {};
    const developer = manifest.developer && typeof manifest.developer === "object" ? manifest.developer : {};
    const iconUrl = `${pointer.base_url}/${asString(urls.icon, "logo.webp").replace(/^\.?\//, "")}`;
    const bannerUrl = `${pointer.base_url}/${asString(urls.banner, "banner.webp").replace(/^\.?\//, "")}`;
    const onegateId = resolveOneGateId(manifest, pointer.app_id);
    return {
      app_id: pointer.app_id,
      slug: pointer.slug,
      kind: KIND,
      name: asString(manifest.name, pointer.slug),
      name_zh: asString(manifest.name_zh) || undefined,
      name_ja: asString(manifest.name_ja) || undefined,
      description: asString(manifest.description),
      description_zh: asString(manifest.description_zh) || undefined,
      description_ja: asString(manifest.description_ja) || undefined,
      category: asString(manifest.category, "utility"),
      tags: Array.from(new Set(asArray(manifest.tags))),
      version: pointer.version,
      icon_url: iconUrl,
      banner_url: bannerUrl,
      entry_url: pointer.entry_url,
      manifest_url: pointer.manifest_url,
      supported_networks: asArray(manifest.supported_networks),
      default_network: asString(manifest.default_network),
      contracts: manifest.contracts && typeof manifest.contracts === "object" ? manifest.contracts : {},
      onegate: {
        id: onegateId,
        isActive: true,
        name: localizedJson(manifest.name, manifest.name_zh, manifest.name_ja),
        iconUrl,
        tags: Array.from(new Set(asArray(manifest.tags))),
        developer: asString(developer.name, "R3E Network").slice(0, 32),
        previews: [bannerUrl],
      },
    };
  });

  if (selected.size === 0 && catalogApps.length > 0) {
    const catalog = {
      generated_at: new Date().toISOString(),
      source: `neo-${KIND}`,
      kind: KIND,
      cdn_base_url: cdnBase,
      count: catalogApps.length,
      apps: catalogApps,
    };
    await putObject(
      `catalog/${KIND}.json`,
      Buffer.from(`${JSON.stringify(catalog, null, 2)}\n`, "utf8"),
      POINTER_CACHE,
    );
  }

  console.log(
    JSON.stringify(
      {
        kind: KIND,
        dry_run: dryRun,
        cdn_base_url: cdnBase,
        bucket,
        published: published.length,
        catalog_written: selected.size === 0 && catalogApps.length > 0,
        skipped,
      },
      null,
      2,
    ),
  );

  if (skipped.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
