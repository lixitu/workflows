'use strict';
/**
 * 开发目录（projectRoot）解析器 —— 无任何机器固定路径，完全由用户自定义。
 *
 * 解析优先级（从高到低）：
 *   1. 命令行参数 --project-root <目录>
 *   2. 环境变量 CODEBUDDY_PROJECT_ROOT
 *   3. 用户级配置 ~/.codebuddy/settings.json 的 projectRoot 字段
 *   4. 本 Skill 内 config/settings.json 的 projectRoot 字段
 *   5. 当前工作目录（cwd）—— 兜底，不写死任何绝对路径
 *
 * 路径支持 ~ 前缀（展开为用户主目录）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ENV_KEY = 'CODEBUDDY_PROJECT_ROOT';
// scripts/lib -> scripts -> skill 根目录
const SKILL_ROOT = path.resolve(__dirname, '..', '..');

function expandUser(p) {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function readConfigRoot(file) {
  try {
    if (!fs.existsSync(file)) return '';
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const v = cfg && (cfg.projectRoot || cfg.projectsRoot);
    return typeof v === 'string' ? v.trim() : '';
  } catch (e) {
    return '';
  }
}

/**
 * @param {string} [cliValue] --project-root 传入的值
 * @returns {{root: string, source: string, configured: boolean}}
 */
function resolveProjectRoot(cliValue) {
  const candidates = [
    ['--project-root 参数', typeof cliValue === 'string' ? cliValue.trim() : ''],
    [`环境变量 ${ENV_KEY}`, String(process.env[ENV_KEY] || '').trim()],
    ['用户级配置 ~/.codebuddy/settings.json', readConfigRoot(path.join(os.homedir(), '.codebuddy', 'settings.json'))],
    ['Skill 配置 config/settings.json', readConfigRoot(path.join(SKILL_ROOT, 'config', 'settings.json'))],
  ];
  for (const [source, value] of candidates) {
    if (value) return { root: path.resolve(expandUser(value)), source, configured: true };
  }
  return {
    root: path.resolve(process.cwd()),
    source: '当前工作目录（未配置，可用 --project-root 自定义）',
    configured: false,
  };
}

const HINT = [
  '提示：开发目录未自定义，已使用当前工作目录。可通过以下任一方式指定：',
  '  1) 命令行：--project-root <目录>',
  `  2) 环境变量：${ENV_KEY}=<目录>`,
  '  3) 一次性设置：node scripts/set-project-root.js <目录>',
  '  4) 手动编辑：config/settings.json 的 projectRoot 字段',
].join('\n');

module.exports = { resolveProjectRoot, expandUser, ENV_KEY, SKILL_ROOT, HINT };
