import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
const root = resolve("dist");
const html = await readFile(resolve(root, "index.html"), "utf8");
const failures = [];
for (const [name, regex] of Object.entries({
  title: /<title>[^<]+<\/title>/,
  description: /name="description"/,
  favicon: /rel="icon"/,
  "og:title": /property="og:title"/,
  "og:image": /property="og:image"/,
}))
  if (!regex.test(html)) failures.push(`Missing ${name}`);
const allFiles = [];
async function walk(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const full = resolve(path, item.name);
    if (item.isDirectory()) await walk(full);
    else allFiles.push(full);
  }
}
await walk(root);
for (const path of allFiles) {
  if (
    path.includes("node_modules") ||
    path.endsWith(".tgz") ||
    path.endsWith(".map")
  )
    failures.push(`Unnecessary export asset: ${path}`);
  if (![".html", ".css"].includes(extname(path))) continue;
  const content = await readFile(path, "utf8");
  const refs =
    extname(path) === ".html"
      ? [...content.matchAll(/(?:src|href)="([^"<>]+)"/g)].map((x) => x[1])
      : [...content.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((x) => x[1]);
  if (extname(path) === ".html") {
    const image = content.match(/property="og:image" content="([^"]+)"/);
    if (image) refs.push(image[1]);
  }
  for (const ref of refs) {
    if (/^(?:https?:|data:|#)/.test(ref) || !ref.includes(".")) continue;
    if (ref.startsWith("/")) {
      failures.push(`Root-absolute asset URL: ${ref}`);
      continue;
    }
    const target = resolve(dirname(path), ref);
    try {
      await stat(target);
    } catch {
      failures.push(`Missing asset: ${ref} from ${path}`);
    }
  }
}
const bytes = (await Promise.all(allFiles.map((path) => stat(path)))).reduce(
  (sum, s) => sum + s.size,
  0,
);
console.log(
  JSON.stringify(
    {
      exportFiles: allFiles.length,
      exportBytes: bytes,
      relativeAssets: failures.length === 0,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
