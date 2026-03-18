---
name: filehelper-task-poller
description: Poll WeChat FileHelper (web) every 10 minutes after a task completes. If the latest message starts with "任务", treat it as a new task input and start processing.
alwaysApply: true
---

## Goal

After a task run completes, keep watching the FileHelper chat for new tasks.

**Task trigger rule:** If the latest message text starts with `任务`, then the remainder of that message becomes the new user request input.

## Constraints (must understand)

- MCP tool actions are executed **only during an active assistant run**. If there is no active run, this rule cannot truly run “in the background” by itself.
- Therefore, there are two supported modes:
  1. **Interactive polling mode (MCP within this chat):** The user asks to start polling, and the assistant performs a 10-minute polling loop while the run is active.
  2. **Unattended mode (external scheduler):** Use an OS scheduler (e.g., Windows Task Scheduler) + automation script to run every 10 minutes.

## Mandatory workflow (must follow)

### Phase A: Enter polling mode

1. After finishing a task (including verification and reporting results to FileHelper), the assistant must:
   - Tell the user it is ready to enter FileHelper polling mode.
   - Confirm polling mode.
     - **Mode 1 (default, interactive polling):** keep listening continuously until the user explicitly stops it.
     - **Unattended mode** (requires extra setup)

2. **Mode 1 stop condition (explicit user command)**
   - Stop polling immediately when the user says any of:
     - `停止监听`
     - `暂停监听`
     - `停止轮询`
     - `暂停轮询`

### Phase B: Interactive polling mode (MCP)

**Target URL:** `https://filehelper.weixin.qq.com/?from=windows&type=recommend`

1. Ensure the FileHelper page is open and selected.
2. Every **10 minutes**:
   - Get the latest message text from the page.
   - If it starts with `任务`:
     - Extract the full message as `taskText`.
     - Acknowledge in FileHelper by replying “收到任务，开始处理：<taskText>”（optional but recommended）.
     - Start processing the task.
     - After processing completes, report results to FileHelper per `post-task-report-filehelper`.
     - Then **return to Mode 1 listening state** and continue polling every 10 minutes.
   - If it does not start with `任务`, wait for the next interval.

**Implementation hint (preferred for reliability):**
- Use MCP `evaluate_script` to read the DOM and find the last message.
- Pseudocode for DOM extraction (must adapt to real DOM):

```js
() => {
  // 1) Find candidate message nodes (text bubbles)
  // 2) Pick the last one
  // 3) Return its innerText
}
```

If DOM is unstable, fallback to:
- Take a snapshot and parse the last `StaticText` that belongs to the message list (avoid UI labels like “发送/选择文件/文件传输助手”).

### Phase C: Unattended mode (external scheduler)

If the user explicitly requests unattended mode, the assistant should:

1. Propose a minimal Node.js script (e.g., Playwright) that:
   - Opens FileHelper (requires login persistence)
   - Every 10 minutes reads latest message
   - If message starts with `任务`, sends the content to this assistant (or calls a webhook) to initiate processing

2. Provide Windows Task Scheduler setup steps.

**Important:** Do not implement unattended mode without user confirmation because it requires installing dependencies and handling authentication/logins.

## Acceptance criteria

- Poll interval is 10 minutes (interactive loop or external scheduler).
- Latest message is correctly extracted.
- Messages starting with `任务` reliably trigger a new task handling flow.
- After each task completes, results are posted to FileHelper and confirmed as sent.
