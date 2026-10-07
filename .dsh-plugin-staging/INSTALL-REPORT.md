# dsh-our-free-model 安装记录（桌面端 profile 手工安装）

安装时间：2026-10-06（Asia/Shanghai）
来源：https://github.com/Ebony-Vinyl/dsh-our-free-model 标签 `v1.4.6`
方法：仓库 README 的「桌面端手工安装（真实目录）」流程，未使用 link:/junction，未走 npm 仓库（该包未发布到 registry）。

## 1. 落盘内容

| 项目 | 值 |
| --- | --- |
| 插件目录 | `C:\Users\Lxithral\.dsh\profiles\desktop\node_modules\dsh-our-free-model`（真实目录，非链接） |
| 文件数 | 32（= 发布清单 `feed/manifest.json` 的完整文件集） |
| 完整性 | 32/32 文件的 sha256 与字节长度与发布清单一致；复制后再从目标位置独立复核一遍：ok=32 bad=0 |
| 目录内符号链接/联接 | 0 |
| 包身份 | `dsh-our-free-model` 1.4.6，`dsh.bundle.patch = ./cordis.patch.yml` |
| 裸模块解析 | `require.resolve('dsh-our-free-model')` → 上述 `index.js`（解析成功） |
| 语法检查 | 目录内全部 `.js` 通过 `node --check` |

profile 清单 `C:\Users\Lxithral\.dsh\profiles\desktop\package.json` 两处改动（其余内容未动）：

1. `dsh.profile.bundles` 末尾追加 `"dsh-our-free-model"`
2. `dependencies` 增加 `"dsh-our-free-model": "1.4.6"`
3. 未改 `cordis.patch.yml`（两项都注册会导致 `duplicate loader entry id: our-free-model`）

## 2. 为什么这样做是安全的（读了 app.asar 里的桌面启动逻辑）

`app.asar` → `/lib/main.js` 中 `DesktopProjectManager.applyRelease()` 在启动时只做四件事：
`readDesktopRuntime` → `migrateProfileSettings`（仅当 pnpm-workspace.yaml 等于旧版字符串才重写）→
`createPluginProfile`（`initProfile`，只写“缺失”的文件，已存在的 package.json 不动）→
`removeLinkProjections`（只删除 `<profile>/node_modules` 下**指向 `<profile>/.dsh-module-fallback/node_modules` 的**符号链接，然后删掉该目录）。

结论：启动流程**不会运行任何包管理器**，不会校验 lockfile，不会重写已有 package.json，也不会碰我们的真实目录。
（对照：dsh 核心 `sanitizeProfile` 只在桌面端“安全模式/关闭全部插件”时才把 bundles 重置回 web 模板。）

## 3. 需要人工确认 / 已知风险

1. **必须重启桌面端**：bundle 列表只在启动时装配（`patchReload: live` 只热重载 cordis 用户补丁层）。重启会同时结束当前 GUI 会话。
2. **内核版本不在插件声明的测试范围内**：本机 dsh 为 **0.2.0-rc.2**，插件 README 只声明兼容 **0.1.5–0.1.7-rc.2**。能否挂载需重启后实测。
3. **发布清单签名与插件内置公钥不匹配**：`feed/manifest.json` 的 Ed25519 签名用插件自带校验函数（`src/updater.js` 的 `verifyManifestSignature` + `PINNED_MANIFEST_PUBLIC_KEY`）验证为 **false**（用新生成密钥对做自测为 true，说明校验逻辑本身正常）。影响的是插件内「一键升级」通道会被它自己拒绝，不影响本次安装的字节。
4. **`dependencies` 里有 registry 无法解析的条目**：该包未发布到 npm，pnpm-lock.yaml 里也没有它的条目。当前安装的解析由真实目录直接完成，无需 pnpm；但若之后在应用内插件管理器里安装/更新别的插件（会跑 pnpm install），pnpm 可能尝试从 registry 解析 `dsh-our-free-model@1.4.6` 而失败。真出现时再处理（本地 tgz + `overrides`，或去掉 dependencies 条目只留 bundles）。

## 4. 回滚

任选其一：

- 手工：从 profile `package.json` 的 `dsh.profile.bundles` 和 `dependencies` 删掉 `dsh-our-free-model`，再删除目录
  `C:\Users\Lxithral\.dsh\profiles\desktop\node_modules\dsh-our-free-model`。
- 若应用启动失败：用桌面端自带恢复（它会 `sanitizeProfile`，把 bundles 重置回内置 web 模板），再执行上面的手工清理。

## 5. 可复现的产物（工作区）

- `.dsh-plugin-staging/t/Ebony-Vinyl-dsh-our-free-model-7e84415/`：与发布清单逐字节一致的发布树
- `.dsh-plugin-staging/install-copy.cjs`：按清单复制到 profile 并复核 sha256/长度/符号链接
- `.dsh-plugin-staging/verify.cjs`：校验清单签名与每个文件摘要
- `.dsh-plugin-staging/asar.cjs`：读取 `app.asar`（list/dump/find），用于核查桌面启动逻辑
