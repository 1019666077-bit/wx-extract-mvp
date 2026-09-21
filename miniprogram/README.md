# 微信小程序 M0 脚手架（无视频）

本目录是 VOA Let's Learn English 的 **原生 `mp-weixin` M0 壳**：四 Tab + 课页可点，对话/测验/付费墙可用。**视频是占位，不接 Akamai。**

## 用微信开发者工具打开

仓库**还没有**正式小程序 AppID。`project.config.json` 使用占位：

```json
"appid": "touristappid"
```

### 方式 A：没有正式 AppID（默认）

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 导入项目，目录选下面**任一**：
   - 仓库根目录（根上 `project.config.json` 的 `miniprogramRoot` 为 `miniprogram/`）
   - 或直接选本目录 `miniprogram/`
3. AppID 保持 **测试号 / 游客模式**（`touristappid`）。工具可能提示「未绑定 AppID」，选测试号即可预览。
4. M0 **没有** `wx.request` / 播放器域名依赖；不必勾选「不校验合法域名」也能走通课表→测验→打卡。

### 方式 B：换成正式 AppID（注册完成后再做）

1. 在[微信公众平台](https://mp.weixin.qq.com/)用**同主体新注册**一个小程序（不要复用电子木鱼 / 诗句对对的 AppID）。
2. 复制 AppID（`wx` 开头）。
3. 把下面两处的 `"appid": "touristappid"` 换成正式值：
   - `miniprogram/project.config.json`
   - 仓库根 `project.config.json`（若从根目录导入）
4. 用开发者工具重新打开项目，或在「详情 → 基本信息」里核对 AppID。
5. **不要**把 AppSecret 写进仓库。本地如出现 `project.private.config.json`，已在 `.gitignore`。

## 生成课表数据

课正文 SSOT 仍是仓库根 `data/lessons.json`。小程序**不**整包加载 764KB：

```bash
# 在仓库根目录
bash scripts/build-mp-data.sh
bash scripts/build-mp-data.sh --check   # 生成物过期则失败
```

产物：

| 文件 | 包 | 内容 |
| --- | --- | --- |
| `miniprogram/data/catalog.json` | 主包 | 课表索引（无对话/测验/视频） |
| `miniprogram/packageLessons/data/lessons/*.json` | 分包 `packageLessons` | 单课对话 + 测验，**无 `videoUrl`** |
| `miniprogram/packageLessons/data/load-lesson.js` | 分包 | 静态 `require` 表（微信不允许动态路径） |
| `miniprogram/utils/study.js` / `unlock.js` | 主包 | 从 `js/study.js`、`js/unlock.js` **原样复制**，勿手改 |

逻辑层：`createStudy` / `createUnlock` 注入 `utils/storage.js`（`wx.setStorageSync`，键名与 H5 一致）。

## 走通验收路径

1. 编译预览 → Tab **课表**。
2. 打开 **Lesson 1 / lle1-01**（免费试学）。
3. 视频区应写 **「视频将在 M1 接入」**，没有 `<video>`，没有 akamai 地址。
4. 读对话，答测验，点 **Check answers**。
5. 切到 Tab **打卡**，当日格子应已打卡。

付费课（L1 第 6 课起、全部 L2）显示锁，点卡片进 **开通** Tab。开通页是人工兑码，**没有** `wx.requestPayment`。

## 单测（仓库根）

```bash
node --test js/study.test.js js/unlock.test.js js/mp-scaffold.test.js
bash scripts/build-mp-data.sh --check
bash scripts/check-codes-json.sh
```

## M0 不做

COS / 视频域名、`requestPayment`、改 H5 付费逻辑、web-view 套壳、L3。
