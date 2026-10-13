'use strict';
/**
 * cli.js —— CodeBuddy CLI 的跨平台定位与执行（Windows / macOS / Linux 通用）
 *
 * 设计要点：
 *   1. 优先定位全局安装包里的 CLI JS 入口，以 `node <entry>` 直接执行：
 *      - Windows：规避 spawn .cmd 包装器的 EINVAL 问题；
 *      - macOS/Linux：同样可用（全局 bin 目录不一定在 PATH 中时更可靠）。
 *   2. 找不到 JS 入口时回退到 PATH 中的可执行名：
 *      - Windows：codebuddy.cmd（经 cmd /c 包装）
 *      - macOS/Linux：codebuddy（直接数组传参，不经过 shell）
 *   3. 允许通过环境变量 CODE_BUDDY_CMD 覆盖（自定义安装路径 / 兜底）。
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function isWindows() {
  return process.platform === 'win32';
}

/**
 * 定位 CLI 可执行目标。
 * @returns {{node:string, entry:string}|string} 对象形式为“node + JS 入口”，字符串形式为可执行名
 */
function resolveCliCommand() {
  if (process.env.CODE_BUDDY_CMD) return process.env.CODE_BUDDY_CMD;
  try {
    // shell: true 使 npm / npm.cmd 均可被解析（Windows 上直接 spawn .cmd 会报 EINVAL）
    const globalRoot = execSync('npm root -g', {
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
    }).trim();
    const pkgDir = path.join(globalRoot, '@tencent-ai', 'codebuddy-code');
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin && (pkg.bin.codebuddy || pkg.bin.cbc));
    const entry = bin ? path.join(pkgDir, bin) : '';
    if (entry && fs.existsSync(entry)) return { node: process.execPath, entry };
  } catch (e) { /* 忽略：回退到 PATH 中的可执行名 */ }
  return isWindows() ? 'codebuddy.cmd' : 'codebuddy';
}

/**
 * 执行 CLI。
 * @param {string[]} args  CLI 参数数组
 * @param {string} [cwd]   工作目录
 * @param {number} [timeoutMs] 超时（毫秒）
 */
function runCli(args, cwd, timeoutMs) {
  const cliCmd = resolveCliCommand();
  const base = { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 };
  if (cliCmd && typeof cliCmd === 'object') {
    // node + JS 入口：数组传参，跨平台一致，无 shell 转义问题
    return spawnSync(cliCmd.node, [cliCmd.entry, ...args], Object.assign({ cwd }, base));
  }
  if (isWindows()) {
    // Windows 兜底：cmd /c 包装，手工加引号规避空格参数
    const argStr = args.map(a => (/[\s"]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a)).join(' ');
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', `${cliCmd} ${argStr}`], Object.assign({ cwd }, base));
  }
  // macOS / Linux 兜底：直接以数组启动，不经过 shell（无需转义）
  return spawnSync(cliCmd, args, Object.assign({ cwd }, base));
}

/** 人类可读的 CLI 标签，用于日志 */
function cliLabel(cmd) {
  return cmd && typeof cmd === 'object' ? `${cmd.node} ${cmd.entry}` : cmd;
}

module.exports = { resolveCliCommand, runCli, cliLabel, isWindows };
