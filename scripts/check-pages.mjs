#!/usr/bin/env node
/**
 * Build with the GitHub Pages prefix and check that the gallery, hashed
 * assets, and all nine fixtures return 200 when dist/ is mounted at
 * /ui-break-cases/. Uses only Node built-ins.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX = "/ui-break-cases";
const PORT = 4176;
const HOST = "127.0.0.1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".xml": "application/xml; charset=utf-8",
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
      }
    });
  });
}

function resolveUrlPath(urlPath) {
  const bare = urlPath.split("?")[0].split("#")[0];
  if (bare !== PREFIX && !bare.startsWith(`${PREFIX}/`)) {
    return null;
  }
  const relative = bare === PREFIX ? "/" : bare.slice(PREFIX.length);
  const decoded = decodeURIComponent(relative);
  const joined = path.normalize(path.join(DIST, decoded));
  if (joined !== DIST && !joined.startsWith(`${DIST}${path.sep}`)) {
    return null;
  }
  return joined;
}

async function fileFor(urlPath) {
  const target = resolveUrlPath(urlPath);
  if (!target) {
    return null;
  }
  let candidate = target;
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      candidate = path.join(candidate, "index.html");
    }
  } catch {
    return null;
  }
  try {
    const info = await stat(candidate);
    if (!info.isFile()) {
      return null;
    }
  } catch {
    return null;
  }
  return candidate;
}

function startServer() {
  const server = createServer((request, response) => {
    const urlPath = request.url ?? "/";
    fileFor(urlPath)
      .then(async (filePath) => {
        if (!filePath) {
          response.writeHead(404, { "content-type": "text/plain" });
          response.end("not found");
          return;
        }
        const body = await readFile(filePath);
        const type = MIME[path.extname(filePath)] ?? "application/octet-stream";
        response.writeHead(200, { "content-type": type });
        response.end(body);
      })
      .catch(() => {
        response.writeHead(500, { "content-type": "text/plain" });
        response.end("error");
      });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, () => resolve(server));
  });
}

async function listFixtures() {
  const fixturesRoot = path.join(DIST, "fixtures");
  const cases = await readdir(fixturesRoot);
  const files = [];
  for (const id of cases.sort()) {
    const dir = path.join(fixturesRoot, id);
    const info = await stat(dir);
    if (!info.isDirectory()) {
      continue;
    }
    const names = await readdir(dir);
    for (const name of names.sort()) {
      if (name.endsWith(".html")) {
        files.push(`/fixtures/${id}/${name}`);
      }
    }
  }
  return files;
}

async function get(pathname) {
  const response = await fetch(`http://${HOST}:${PORT}${PREFIX}${pathname}`);
  return { status: response.status, url: `${PREFIX}${pathname}` };
}

async function main() {
  await run("npm", ["run", "build:pages"]);

  const indexHtml = await readFile(path.join(DIST, "index.html"), "utf8");
  const requiredMeta = [
    'rel="canonical"',
    "og:title",
    "og:image",
    "twitter:card",
    "twitter:image",
    "https://estebanindiveri.github.io/ui-break-cases/social-preview.png",
  ];
  for (const needle of requiredMeta) {
    if (!indexHtml.includes(needle)) {
      throw new Error(`dist/index.html is missing ${needle}`);
    }
  }

  const assetPaths = [
    ...indexHtml.matchAll(/(?:src|href)="(\/ui-break-cases\/assets\/[^"]+)"/g),
  ].map((match) => match[1].slice(PREFIX.length));
  if (assetPaths.length === 0) {
    throw new Error("no hashed /ui-break-cases/assets/ URLs in dist/index.html");
  }

  const fixtures = await listFixtures();
  if (fixtures.length !== 9) {
    throw new Error(`expected 9 fixtures, found ${fixtures.length}: ${fixtures.join(", ")}`);
  }

  const server = await startServer();
  const failures = [];
  try {
    const checks = [
      "/",
      "/index.html",
      "/social-preview.png",
      "/sitemap.xml",
      ...assetPaths,
      ...fixtures,
    ];
    for (const pathname of checks) {
      const result = await get(pathname);
      const label = result.url;
      if (result.status !== 200) {
        failures.push(`${label} → ${result.status}`);
        console.error(`FAIL ${label} ${result.status}`);
      } else {
        console.log(`OK   ${label}`);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  if (failures.length > 0) {
    throw new Error(`GitHub Pages path check failed:\n${failures.join("\n")}`);
  }
  console.log(`Checked gallery, ${assetPaths.length} hashed asset(s), and ${fixtures.length} fixtures under ${PREFIX}/`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
