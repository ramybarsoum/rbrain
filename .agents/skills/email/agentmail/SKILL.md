---
name: agentmail
description: Send, receive, and manage emails via AgentMail API. Includes inbox management, message sending/replying, thread tracking, and label management for agent email workflows.
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [Email, AgentMail, Communication]
    related_skills: [himalaya]
---

# AgentMail — Email API for Agents

Max's email is powered by AgentMail. Use this for all email operations: sending, receiving, replying, threading, labels, and attachments.

## Credentials

- **API Key:** stored in `~/.hermes/config.yaml` under `mcp_servers.agentmail.env.AGENTMAIL_API_KEY`
- **Inbox:** `max.brain@agentmail.to`
- **SMTP Host:** max.brain@agentmail.to, Port 465
- **IMAP Host:** imap.agentmail.to, Port 993
- **Username:** max.brain@agentmail.to
- **Password:** stored in config

## SDK Usage (Python)

```python
from agentmail import AgentMail

client = AgentMail(api_key="am_us_...")  # from config
INBOX = "max.brain@agentmail.to"
```

### Send an Email

```python
msg = client.inboxes.messages.send(
    INBOX,
    to="recipient@example.com",
    subject="Hello!",
    text="Plain text body",
    html="<p>HTML body</p>",  # optional
    cc=["cc@example.com"],    # optional
)
print(msg.message_id)
```

### Reply to a Message

```python
client.inboxes.messages.reply(
    INBOX,
    message_id="original_message_id",
    to=["sender@example.com"],
    text="Thanks for reaching out!",
)
```

### Forward a Message

```python
client.inboxes.messages.forward(
    INBOX,
    message_id="original_message_id",
    to=["forward-target@example.com"],
    text="FYI - forwarding this to you.",
)
```

### List Messages (Receive)

```python
messages = client.inboxes.messages.list(INBOX, limit=10)
for msg in messages.messages:
    print(msg.subject, msg.from_, msg.extracted_text or msg.text)
```

- Use `extracted_text` / `extracted_html` for reply content without quoted history.

### List Threads

```python
threads = client.inboxes.threads.list(INBOX, limit=20)
for t in threads.threads:
    print(t.thread_id, t.subject, t.last_message_at)
```

### Get Full Thread

```python
thread = client.inboxes.threads.get(INBOX, thread_id="thread_id")
for msg in thread.messages:
    print(msg.from_, msg.subject, msg.extracted_text)
```

### Manage Labels

```python
# Add labels to a message
client.inboxes.messages.update(INBOX, message_id="msg_id", labels=["important", "todo"])

# List messages with specific labels
messages = client.inboxes.messages.list(INBOX, labels=["important"])
```

### Create Additional Inboxes

```python
inbox = client.inboxes.create(display_name="Sales Agent")
# inbox.inbox_id is the email address
```

### Download Attachments

```python
# From a message
attachment = client.inboxes.messages.get_attachment(INBOX, message_id="msg_id", attachment_id="att_id")
# From a thread
attachment = client.inboxes.threads.get_attachment(INBOX, thread_id="t_id", attachment_id="att_id")
```

## MCP Server (Native Tools)

The MCP server is configured in `~/.hermes/config.yaml` and provides these tools after restart:

| Tool | Description |
|------|-------------|
| `mcp_agentmail_create_inbox` | Create a new email inbox |
| `mcp_agentmail_list_inboxes` | List all inboxes |
| `mcp_agentmail_get_inbox` | Get inbox details |
| `mcp_agentmail_delete_inbox` | Delete an inbox |
| `mcp_agentmail_send_message` | Send an email |
| `mcp_agentmail_reply_to_message` | Reply to an email |
| `mcp_agentmail_forward_message` | Forward an email |
| `mcp_agentmail_update_message` | Update message labels/status |
| `mcp_agentmail_list_threads` | List email threads |
| `mcp_agentmail_get_thread` | Get full thread with messages |
| `mcp_agentmail_get_attachment` | Download an attachment |

## Common Patterns

### Send and wait for reply (polling)

```python
import time

client.inboxes.messages.send(INBOX, to="user@example.com", subject="Question", text="What do you think?")

# Poll for replies
while True:
    msgs = client.inboxes.messages.list(INBOX, limit=5)
    for m in msgs.messages:
        if m.from_ != INBOX:
            print(f"Reply from {m.from_}: {m.extracted_text}")
            break
    time.sleep(30)
```

### Draft → Review → Send workflow

```python
# Create draft
draft = client.inboxes.drafts.create(INBOX, to="user@example.com", subject="Proposal", text="Draft text...")

# Later, send it
client.inboxes.drafts.send(INBOX, draft_id=draft.draft_id)
```

## API Docs

- Full docs: https://docs.agentmail.to/llms.txt
- Quickstart: https://docs.agentmail.to/quickstart
- API Reference: https://docs.agentmail.to/api-reference
- Console: https://console.agentmail.to

## Pitfalls

- `extracted_text` removes quoted reply history — always prefer it over `text` for reading inbound replies.
- The API key is under `mcp_servers.agentmail.env.AGENTMAIL_API_KEY` in config — do NOT hardcode it in scripts; read it from config or env.
- Free tier: 3 inboxes, 3,000 emails/month.
- MCP tools require an agent restart to take effect.
- `SendMessageResponse` does not have a `status` attribute — only `message_id`.
