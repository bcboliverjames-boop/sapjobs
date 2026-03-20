---
name: post-task-report-filehelper
description: After completing any task, must report the results by sending a message in the FileHelper (WeChat Web File Transfer Assistant) chat box via MCP, then confirm the message is sent.
alwaysApply: true
---

## When to use this rule

Use this rule **after handling any user message/request**, including:

- Rule creation/updates
- Process/plan confirmations
- Bug fixes / feature development
- Deployment/verification results

In other words: once you consider the current request “handled/answered”, you must send a brief result message to FileHelper.

## Mandatory workflow (must follow)

1. **Prepare a short result summary**
   - Include:
     - What was changed (bullet points)
     - Verification status (type-check/build/test/MCP, etc.)
     - Deployment info (version/commit SHA, environment) if applicable
   - If the request is **discussion/decision only** (no code change), include:
     - The decision and constraints
     - Next action required from user (if any)

2. **Send the summary to WeChat FileHelper (Web) via MCP**
   - Target URL:
     - `https://filehelper.weixin.qq.com/?from=windows&type=recommend`
   - Assumption:
     - The page is already opened in the controlled browser and logged in.

3. **MCP操作步骤（必须执行）**
   - **优先复用已登录页面**：
     - 先用 MCP `list_pages` 找到已打开的 `filehelper.weixin.qq.com` 页面。
     - 若存在多个，优先选择**已扫码登录完成**的那个（能看到聊天输入框 `textbox multiline` + “发送”按钮）。
     - 只在**找不到已登录页面**时，才允许 `navigate/new_page` 打开 FileHelper。
     - 若页面显示“扫码登录/使用手机微信扫码”等登录态，视为未登录，需要用户扫码后再继续。
   - **选择页面**：用 MCP `select_page` 选中上述可用页面。
   - **获取元素**：调用页面快照（snapshot）定位：
     - 聊天输入框（通常为 `textbox multiline`）
     - “发送”按钮（通常为 link/button，文本为“发送”）
   - **填写内容**：将“处理结果摘要”填入输入框。
   - **点击发送**：点击“发送”。

4. **Confirm it was sent (required)**
   - 发送后必须再抓一次 snapshot。
   - **验收标准**：在快照中能看到刚发送的文本内容（作为新消息气泡/静态文本出现）。
   - 如果未出现：
     - 重新定位输入框与发送按钮，重试一次
     - 仍失败则在 IDE 聊天中明确说明失败原因与当前页面状态，并请求用户协助（例如重新登录/刷新页面）

## Output requirement

Only after the FileHelper message is confirmed as sent, you may finalize the task response to the user.
