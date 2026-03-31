# Session Persistence via trackingId

**日期**: 2026-03-31
**功能名称**: HTTP 路由会话持久化
**状态**: 设计完成，待实现

---

## 概述

允许客户端通过 `trackingId` 参数在 HTTP 路由中复用已有的浏览器会话，保留完整的浏览器上下文（cookies、cache、localStorage、sessionStorage），减少浏览器启动开销。

---

## 核心目标

1. HTTP 路由支持通过 `trackingId` 复用现有浏览器会话
2. 复用现有页面执行操作，保留页面状态
3. 每次请求导航到指定的 URL
4. 会话通过 TTL 自动过期，客户端可通过定期请求延长生命周期
5. 与现有 WebSocket 路由行为统一

---

## 架构设计

### 修改模块

1. **`src/browsers/index.ts` (BrowserManager)** - 核心会话管理
2. **`src/config.ts`** - TTL 配置
3. **`src/types.ts`** - 类型定义扩展
4. **HTTP 路由基础类** - 会话复用逻辑
5. **具体路由实现** - handler 签名调整

### 数据流

```
请求到达 → 解析 trackingId →
  存在? → 查找现有会话 → 复用浏览器和页面 → 导航到 URL → 执行操作 → 刷新 TTL
  不存在? → 创建新浏览器 → 注册 trackingId → 执行操作 → 返回结果
```

---

## 详细设计

### 1. BrowserlessSession 扩展 (src/types.ts)

新增字段：

```typescript
export interface BrowserlessSession {
  // ... 现有字段
  lastActivityTime: number;  // 最后活动时间戳，用于 TTL 计算
}
```

### 2. Config 扩展 (src/config.ts)

新增配置：

```typescript
protected sessionTTL = +(process.env.SESSION_TTL ?? '1800000'); // 默认 30 分钟

public getSessionTTL(): number {
  return this.sessionTTL;
}

public setSessionTTL(ttl: number): number {
  this.emit('sessionTTL', ttl);
  return (this.sessionTTL = ttl);
}
```

环境变量：`SESSION_TTL`（毫秒）

### 3. BrowserManager 扩展 (src/browsers/index.ts)

新增方法：

**`findSessionByTrackingId(trackingId: string)`**

- 根据 trackingId 查找现有会话
- 返回 `{ browser, session, page }` 或 `null`
- 检查会话是否仍在运行（浏览器未关闭）

**`refreshSessionActivity(trackingId: string)`**

- 更新 `lastActivityTime` 为当前时间
- 重置 TTL 定时器
- 若会话不存在或已过期，忽略（不报错）

**`getOrCreateSession(req, router, logger)`**

- 供 HTTP 路由调用的统一入口
- 检查 trackingId 是否存在
- 存在 → 复用会话和页面
- 不存在 → 创建新会话并注册 trackingId
- 返回 `{ browser, page, isNew }`

**修改 `getBrowserForRequest()`**：

- trackingId 检查逻辑改为"查找并复用"而非"报错冲突"
- 创建新会话时设置 `lastActivityTime = Date.now()`

**修改 `close()` 方法**：

- 支持 TTL 定时器管理
- 会话空闲超过 TTL 时自动关闭

### 4. BrowserHTTPRoute 修改 (src/types.ts)

```typescript
export abstract class BrowserHTTPRoute extends BasicHTTPRoute {
  defaultLaunchOptions?: defaultLaunchOptions;
  abstract browser: BrowserClasses;

  supportsSessionReuse: boolean = true;  // 是否支持会话复用

  abstract handler(
    req: Request,
    res: http.ServerResponse,
    logger: Logger,
    browser: BrowserInstance,
    page: Page,           // 新增：传入页面实例
    isNewSession: boolean, // 新增：标识是否为新会话
  ): Promise<unknown>;

  onNewPage?: (url: URL, page: Page) => Promise<void>;
}
```

### 5. 具体路由修改

需要修改的路由（使用 BrowserHTTPRoute）：

- `src/shared/pdf.http.ts` - PDF 生成
- `src/shared/screenshot.http.ts` - 截图
- `src/shared/content.http.ts` - 内容抓取
- `src/shared/scrape.http.ts` - 结构化抓取
- `src/shared/download.http.ts` - 文件下载
- `src/shared/performance.http.ts` - 性能分析
- `src/shared/function.http.ts` - 函数执行

修改要点：

- handler 接收 `page` 参数，无需调用 `browser.newPage()`
- 导航到请求中指定的 URL
- 会话复用时不关闭页面，由 BrowserManager 管理 TTL

---

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| trackingId 会话不存在 | 创建新会话并注册该 trackingId |
| 会话已过期/浏览器已关闭 | 清理记录，创建新会话 |
| 页面导航失败 | 返回 400 BadRequest，不关闭会话 |
| trackingId 与 WebSocket 会话冲突 | 复用该会话（统一行为） |
| 达到最大并发限制 | 进入队列等待 |

---

## TTL 机制

- 每次请求刷新 `lastActivityTime`
- 设置定时器在 TTL 到期时检查会话
- 若 `Date.now() - lastActivityTime > TTL` 且无活跃连接，关闭会话
- 有活跃连接时不关闭（`numbConnected > 0`）

---

## API 使用示例

```bash
# 创建新会话
curl -X POST "http://localhost:3000/chromium/pdf?trackingId=my-session" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# 复用会话
curl -X POST "http://localhost:3000/chromium/pdf?trackingId=my-session" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/page2"}'

# 查看会话
curl "http://localhost:3000/sessions?trackingId=my-session"

# 关闭会话
curl "http://localhost:3000/kill/my-session"
```

---

## 实现优先级

1. Config 和 Types 扩展
2. BrowserManager 核心方法
3. TTL 定时器机制
4. PDF 路由试点验证
5. 其他路由批量修改
6. 测试覆盖

---

## 测试策略

**单元测试** (src/browsers/tests/session-persistence.spec.ts)：
- findSessionByTrackingId 查找逻辑
- refreshSessionActivity TTL 刷新
- TTL 定时器触发和自动关闭

**集成测试**：
- 相同 trackingId 两次请求验证复用
- cookies/localStorage 跨请求保留
- TTL 过期后会话重建
- 显式 kill 后重建