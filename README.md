# 台风巴威：杭州生存指南

一个 GitHub Pages 友好的台风路径互动网页 MVP。页面以杭州视角展示当前台风「巴威」的位置、路径、距离、风险摘要、时间轴、风圈和防台物资清单。

## 当前状态

- 已实现静态前端 MVP。
- 当前数据来自 `data/typhoon-bavi.json` 中的规范化样例数据。
- 样例数据用于验证交互和数据结构，不作为正式气象预警依据。
- 后续推荐通过 GitHub Actions 定时调用 QWeather 或其他授权数据源，再写回同一 JSON 结构。

## 本地预览

推荐用本地 HTTP 服务打开，因为页面会通过 `fetch()` 读取 JSON 数据：

```bash
python -m http.server 4173
```

然后访问：

```text
http://127.0.0.1:4173/
```

## 测试

项目使用 Node.js 内置测试框架，不需要安装依赖：

```bash
node --test tests/*.test.js
```

如果本机 npm 可用，也可以运行：

```bash
npm test
```

## 数据接入方向

前端只依赖规范化后的 `data/typhoon-bavi.json`。后续真实数据接入时，建议：

1. GitHub Actions 定时运行数据更新脚本。
2. 脚本读取 QWeather 台风列表，筛选 2026 年活跃的「巴威」。
3. 用对应 storm id 拉取实况路径和预报路径。
4. 转换成当前 JSON 结构。
5. 提交更新后的 `data/typhoon-bavi.json`。


## QWeather + GitHub Pages 配置

当前仓库已加入 `.github/workflows/update-typhoon-data.yml`，每小时会运行一次，也可以在 GitHub Actions 页面手动触发。

在仓库 `Settings -> Secrets and variables -> Actions` 添加这些 Repository secrets：

```text
QWEATHER_PROJECT_ID
QWEATHER_CREDENTIAL_ID
QWEATHER_PRIVATE_KEY
QWEATHER_API_HOST
```

说明：

- `QWEATHER_PROJECT_ID` 是 QWeather 项目 ID。
- `QWEATHER_CREDENTIAL_ID` 是 JWT 凭据 ID，不是公钥 SHA-256。
- `QWEATHER_PRIVATE_KEY` 填 Ed25519 私钥 PEM 内容。可以整段粘贴；如果写成一行，脚本也支持 `\n` 换行。
- `QWEATHER_API_HOST` 填 QWeather 控制台给你的 API Host；如果不填，脚本默认用 `https://devapi.qweather.com`。

如果由 GitHub Actions 调 QWeather，QWeather 凭据的「应用限制」建议选「不限制」。因为 Actions 出口 IP 不固定，域名限制只适用于浏览器前端直接请求，不适用于服务端/CI 请求。

GitHub Pages 的自定义域名只负责页面访问；QWeather JWT 公钥不需要和页面域名绑定。公钥上传到 QWeather，私钥只放 GitHub Secrets。

## 免责声明

本页面用于互动展示和生活提醒，不是官方气象业务系统、灾害预警系统或应急决策工具。正式预警、避险指引、停课停运、交通调整和灾害信息请以气象部门、应急管理部门及政府部门发布为准。

完整说明见 [DISCLAIMER.md](./DISCLAIMER.md)。

## 开源协议

本项目采用 MIT License 开源，详见 [LICENSE](./LICENSE)。
