#!/usr/bin/env node
/**
 * set-project-root.js —— 一次性设置开发目录（写入用户级配置，跨项目/跨机器重装 Skill 后仍生效）
 *
 * 用法：
 *   node scripts/set-project-root.js <开发目录>
 *   node scripts/set-project-root.js            # 查看当前生效的开发目录
 *
 * 写入位置：~/.codebuddy/settings.json 的 projectRoot 字段（与其它字段合并，不覆盖既有配置）
 * 优先级：--project-root 参数 > CODEBUDDY_PROJECT_ROOT > 该用户级配置 > config/settings.json > 当前工作目录
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveProjectRoot, expandUser } = require('./lib/resolve-project-root');

const target = process.argv[2];
const configFile = path.join(os.homedir(), '.codebuddy', 'settings.json');

if (!target) {
  const cur = resolveProjectRoot();
  console.log(`当前开发目录：${cur.root}`);
  console.log(`来源：${cur.source}`);
  console.log(`用户级配置文件：${configFile}`);
  console.log('设置方式：node scripts/set-project-root.js <开发目录>');
  process.exit(0);
}

const abs = path.resolve(expandUser(target.trim()));
fs.mkdirSync(abs, { recursive: true });

let cfg = {};
if (fs.existsSync(configFile)) {
  try {
    cfg = JSON.parse(fs.readFileSync(configFile, 'utf8')) || {};
  } catch (e) {
    console.error(`错误：${configFile} 不是合法 JSON，已中止。请手动修复或直接编辑该文件添加 "projectRoot" 字段。`);
    process.exit(1);
  }
}
cfg.projectRoot = abs;
fs.mkdirSync(path.dirname(configFile), { recursive: true });
fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2) + '\n');

console.log(`已设置开发目录：${abs}`);
console.log(`配置已写入：${configFile}`);
console.log('项目将创建在该目录下的独立子文件夹中（<开发目录>/<项目名>）。');
