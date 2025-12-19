# Supabase Realtime 配置指南

## ⚠️ 重要提醒

为了确保聊天室的实时更新功能正常工作，你需要在 Supabase Dashboard 中手动启用 Realtime。

## 📋 配置步骤

### 1. 启用 chat_history 表的 Realtime

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **Database** > **Replication**
4. 找到 `chat_history` 表
5. 点击开关，启用 **Realtime**
6. 确保状态显示为 **Enabled** ✅

### 2. 启用 chat_messages 表的 Realtime

重复上述步骤，为 `chat_messages` 表也启用 Realtime。

## 🔍 验证配置

配置完成后，前端应该能够：
- ✅ 实时接收 n8n Agent 写入 `chat_history` 的新消息
- ✅ 实时接收用户发送到 `chat_messages` 的新消息
- ✅ 根据 `match_id` 过滤显示相关消息

## 🐛 故障排查

如果实时更新不工作，请检查：

1. **Realtime 是否已启用**
   - 在 Supabase Dashboard > Database > Replication 中确认两个表都已启用

2. **RLS 策略是否正确**
   - 确保 RLS 策略允许读取 `chat_history` 和 `chat_messages` 表

3. **网络连接**
   - 检查浏览器控制台是否有 WebSocket 连接错误

4. **代码中的 Null 检查**
   - 确保所有使用 `supabase` 的地方都有 `if (!supabase) return;` 检查

## 📝 代码中的 Null 安全

所有使用 Supabase 客户端的地方都应该先检查：

```typescript
const sb = supabase;
if (!sb) {
  console.warn('Supabase client is null');
  return;
}
```

## ⚡ 性能优化

- 初始消息加载限制为 **50 条**（`HISTORY_LIMIT = 50`）
- 消息按 `created_at DESC` 排序（最新的在前）
- 使用防抖机制减少网络请求频率

