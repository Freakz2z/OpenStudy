import fs from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();
const packageJsonPath = path.join(cwd, 'package.json');
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

const version = packageJson.version;
const productName = packageJson.build?.productName ?? 'OpenStudy';
const sourceDir = process.env.OPENSTUDY_RELEASE_DIR ?? path.join(cwd, 'release', version);
const outputDir = process.env.OPENSTUDY_ARTIFACT_DIR ?? path.join(cwd, 'dist-artifacts');

const targetNames = {
  '.exe': `${productName}-${version}-windows-x64-installer.exe`,
  '.dmg': `${productName}-${version}-macos-arm64.dmg`,
  '.AppImage': `${productName}-${version}-linux-x64.AppImage`,
  '.deb': `${productName}-${version}-linux-x64.deb`
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

function findExtension(fileName) {
  return Object.keys(targetNames).find((extension) => fileName.endsWith(extension));
}

await fs.rm(outputDir, { recursive: true, force: true });
await ensureDir(outputDir);

const files = await listFiles(sourceDir);
const copied = [];

for (const fileName of files) {
  const extension = findExtension(fileName);
  if (!extension) continue;

  const targetName = targetNames[extension];
  const sourcePath = path.join(sourceDir, fileName);
  const targetPath = path.join(outputDir, targetName);

  await fs.copyFile(sourcePath, targetPath);
  copied.push(targetName);
}

if (copied.length === 0) {
  throw new Error(`No installer artifacts found in ${sourceDir}`);
}

console.log(`Collected ${copied.length} installer artifact(s):`);
for (const fileName of copied) {
  console.log(`- ${fileName}`);
}
