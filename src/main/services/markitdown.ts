import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { FileType } from '../../shared/types.js';
import { resolveAppDataDir, ensureDir } from './runtime-paths.js';

type CommandCandidate = {
  command: string;
  args: string[];
  source: 'env' | 'path' | 'python' | 'managed';
};

export interface MarkItDownCommand {
  command: string;
  args: string[];
  source: CommandCandidate['source'];
  version?: string;
}

export interface MarkItDownConvertResult {
  markdown: string;
  command: MarkItDownCommand;
}

const MANAGED_MARKITDOWN_DIR = join(resolveAppDataDir(), 'tools', 'markitdown');

function getManagedCommandPath(): string {
  return process.platform === 'win32'
    ? join(MANAGED_MARKITDOWN_DIR, 'Scripts', 'markitdown.exe')
    : join(MANAGED_MARKITDOWN_DIR, 'bin', 'markitdown');
}

function getManagedPythonPath(): string {
  return process.platform === 'win32'
    ? join(MANAGED_MARKITDOWN_DIR, 'Scripts', 'python.exe')
    : join(MANAGED_MARKITDOWN_DIR, 'bin', 'python');
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function parseEnvCommand(raw: string): CommandCandidate | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, '')) ?? [];
  if (parts.length === 0) return null;
  return {
    command: parts[0],
    args: parts.slice(1),
    source: 'env',
  };
}

function buildCandidates(): CommandCandidate[] {
  const candidates: CommandCandidate[] = [];
  const envCommand = parseEnvCommand(process.env.OPENSTUDY_MARKITDOWN_BIN ?? '');
  if (envCommand) candidates.push(envCommand);

  candidates.push({
    command: getManagedCommandPath(),
    args: [],
    source: 'managed',
  });

  candidates.push({
    command: 'markitdown',
    args: [],
    source: 'path',
  });

  candidates.push({
    command: getManagedPythonPath(),
    args: ['-m', 'markitdown'],
    source: 'managed',
  });

  candidates.push({
    command: 'python3',
    args: ['-m', 'markitdown'],
    source: 'python',
  });

  candidates.push({
    command: 'python',
    args: ['-m', 'markitdown'],
    source: 'python',
  });

  return candidates;
}

async function runCommand(
  command: string,
  args: string[],
  input?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

async function detectPythonBootstrap(): Promise<string> {
  for (const candidate of ['python3', 'python']) {
    try {
      const result = await runCommand(candidate, ['--version']);
      if (result.code === 0) return candidate;
    } catch {
      continue;
    }
  }

  throw new Error('当前环境未检测到可用的 Python。请先安装 Python 3。');
}

export async function detectMarkItDown(): Promise<MarkItDownCommand | null> {
  for (const candidate of buildCandidates()) {
    if (candidate.source === 'managed' && candidate.command.includes(MANAGED_MARKITDOWN_DIR)) {
      const exists = await isExecutable(candidate.command);
      if (!exists) continue;
    }

    try {
      const result = await runCommand(candidate.command, [...candidate.args, '--version']);
      if (result.code === 0) {
        return {
          command: candidate.command,
          args: candidate.args,
          source: candidate.source,
          version: (result.stdout || result.stderr).trim() || undefined,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function getManagedMarkItDownDir(): string {
  return MANAGED_MARKITDOWN_DIR;
}

export async function installManagedMarkItDown(
  spec = 'markitdown[all]',
): Promise<{ commandPath: string; pythonPath: string }> {
  ensureDir(MANAGED_MARKITDOWN_DIR);
  const pythonPath = getManagedPythonPath();

  if (!(await isExecutable(pythonPath))) {
    const pythonBootstrap = await detectPythonBootstrap();
    const venvResult = await runCommand(pythonBootstrap, ['-m', 'venv', MANAGED_MARKITDOWN_DIR]);
    if (venvResult.code !== 0) {
      throw new Error(`创建 MarkItDown 虚拟环境失败：${venvResult.stderr || venvResult.stdout}`);
    }
  }

  const installResult = await runCommand(pythonPath, ['-m', 'pip', 'install', '--upgrade', 'pip', spec]);
  if (installResult.code !== 0) {
    throw new Error(`安装 ${spec} 失败：${installResult.stderr || installResult.stdout}`);
  }

  return {
    commandPath: getManagedCommandPath(),
    pythonPath,
  };
}

export async function convertWithMarkItDown(filePath: string): Promise<MarkItDownConvertResult> {
  const command = await detectMarkItDown();
  if (!command) {
    throw new Error(
      '当前环境未检测到 MarkItDown。请先运行 `npm run markitdown:install` 或设置 OPENSTUDY_MARKITDOWN_BIN。',
    );
  }

  const result = await runCommand(command.command, [...command.args, filePath]);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `MarkItDown 转换失败：${filePath}`);
  }

  return {
    markdown: result.stdout.trim(),
    command,
  };
}

export function supportsMarkItDownConversion(fileType: FileType): boolean {
  return !['txt', 'md'].includes(fileType);
}
