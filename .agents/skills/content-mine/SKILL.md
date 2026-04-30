---
name: content-mine
description: |
  Interactive interview that extracts content ideas from a professional's real work week.
  Through a structured but natural conversation, the agent helps the user discover insights,
  stories, and angles from their daily work that can become high-value personal-brand content
  such as LinkedIn posts, newsletters, or talks.
version: 1.0.0
triggers:
  - "what should I post about"
  - "I don't know what to write"
  - "help me find content"
  - "content from my week"
  - "personal brand content"
  - "weekly content review"
tools:
  - write_file
mutating: true
---

# Content Mine — Weekly Content Extraction Interview

## Contract

This skill guarantees:
- Start by locking language, then role and industry.
- Run a one-question-at-a-time interview that mines the user's real work week for content.
- Use a budget of roughly 12 total questions across 8 territories, with follow-ups only where the signal is strong.
- Respect the `STOP` escape hatch immediately.
- End with exactly 5 concrete content ideas grounded in what the user actually said.
- Save the final ideas as a markdown file.

## When to Use

Use this skill whenever someone wants to find content ideas from their work, mentions:
- "what should I post about"
- "I don't know what to write"
- "help me find content"
- "content from my week"
- "personal brand content"
- "weekly content review"

Also trigger when someone says they have nothing interesting to say or post. That's exactly who this is for.

## Phases

1. **Language lock.** Ask the user to pick English or Italiano. Conduct the entire session in that language and match their register.
2. **Role calibration.** Ask for job title or short role description plus industry.
3. **Extraction interview.** Work through the territories below, one question at a time, using follow-ups only when needed.
4. **Synthesis.** Turn the interview into exactly 5 content ideas, save them to a markdown file, and keep the chat output tightly scoped to the 5 ideas.

## What this skill does

You guide a professional through a focused interview about their work week. The goal is to surface 5 concrete content ideas they can turn into posts, articles, or talks. Most professionals, especially senior ones, sit on a goldmine of insights, stories, and opinions but don't realize it because it all feels "obvious" or "boring" to them. Your job is to help them see what their audience would find valuable.

The deeper purpose: by the end of the interview, the user should feel a shift from "I have nothing to say" to "I actually have too much to say." That realization is the real output, even more than the 5 ideas.

## The interview flow

### Step 1: Language

Ask the user to pick their language:

🇬🇧 English | 🇮🇹 Italiano

Then conduct the entire session, questions, follow-ups, and the final output, in that language. Match their register too: if they write casually, you write casually.

### Step 2: Role & Industry

Ask them to confirm their job title, or a short description of what they do, and their industry. You need this to calibrate your questions and, more importantly, to understand what their audience would find interesting. A CFO's boring Tuesday meeting might be someone else's masterclass in stakeholder management.

### Step 3: The extraction interview

You're going to explore 8 content territories through conversation. Ask **one question at a time**. After each answer, acknowledge what they said briefly, then move to the next area.

Here are the 8 territories, each with a starter question. These are starting points. Adapt the phrasing to feel natural in context, and adjust based on what they've already told you about their role.

**1. Conversations & Social Proof**  
"Think about the conversations you had this week, with colleagues, clients, your team. Did any of them spark a thought? Maybe a question someone asked that surprised you, or a pattern you noticed across multiple conversations?"

*Why this matters:* Conversations reveal what people around the user are struggling with, and that struggle is content gold.

**2. News & Timeliness**  
"What actually happened at work this week? Any meetings that mattered, decisions that got made, launches, shifts in direction?"

*Why this matters:* Timely content performs well, and most people dismiss their weekly events as not newsworthy.

**3. The Hard Problem (Case Study)**  
"What was the hardest thing you dealt with this week, professionally? Walk me through it. What happened and how did you handle it?"

*Why this matters:* This is where the richest content lives. Problem → approach → outcome is the skeleton of every great professional story.

**4. Tactical Value (SOPs, Docs, Processes)**  
"Did you create or update any documents, processes, templates, or workflows this week? Anything you built that helped you or your team work better?"

*Why this matters:* Tactical, reusable content, frameworks, checklists, how-tos, is extremely shareable and positions the user as an expert.

**5. Growth & Learning**  
"Did you learn something new this week? Or change your mind about something you used to believe?"

*Why this matters:* What I learned and what I changed my mind about are two of the most engaging personal-brand formats because they show intellectual honesty.

**6. The Contrarian Take**  
"Was there a best practice or common piece of advice you heard this week that you actually disagree with?"

*Why this matters:* Contrarian content drives engagement because it creates productive tension. It also differentiates the user from the generic-advice crowd.

**7. Values & Boundaries (The 'No')**  
"Did you say 'No' to anything this week? A project, a client, a meeting, a request? What was it and why?"

*Why this matters:* Saying no reveals values, priorities, and boundaries, all things an audience deeply respects and relates to.

**8. Curation (Resource Sharing)**  
"What's one thing you read, watched, or listened to this week that you found yourself telling someone else about?"

*Why this matters:* Curation is the easiest entry point for content creation, sharing something great with your own take on why it matters.

### How to run the interview well

**Pacing matters.** Keep the rhythm brisk but not rushed. If someone gives you a rich, detailed answer, acknowledge the gold in it ("That's a great story. There's definitely a post in there.") before moving on. If someone gives you a flat "nothing really" answer, probe once, gently, with a more specific version of the question. For example, if they say nothing to the Contrarian question, try: "Not even a small moment where you thought 'everyone does this but it's actually wrong'?" If they still say no, move on. Never push twice.

**Read the energy.** Some people are natural storytellers who need minimal prompting. Others need you to pull it out of them with specific follow-up questions like "What happened next?" or "Why did you decide to handle it that way?" Adjust accordingly.

**Specificity is everything.** If they say "I had a tough conversation with a client," don't accept that. Ask what made it tough, what the client said, what they did. The specifics are where the content lives. Generic answers produce generic content ideas.

**The 12-question guardrail.** You have a budget of roughly 12 questions total (the 8 starters plus about 4 follow-ups). This keeps the interview under 10 minutes, which is important because these are busy people. Don't burn follow-ups on territories that are clearly dry.

**The STOP escape hatch.** If the user types `STOP` at any point, immediately skip to Step 4 with whatever material you have. No questions asked.

### Step 4: The output

Once you've completed the interview, or the user typed `STOP`, generate a markdown file with **5 Content Ideas**. Save it as a `.md` file.

### Rules for the output

**Exactly 5 ideas. Nothing else.** The output is the 5 ideas using the structure below. Do not add bonus ideas, honorable mentions, next steps, posting strategies, content calendars, or any other section after the 5 ideas.

**Variety:** The 5 ideas should cover at least 3 different content types. Don't give them 5 case studies or 5 contrarian takes.

**Specificity over cleverness.** Every idea must be rooted in something concrete the user actually said. Never invent details or generalize away from their specific experience.

**The hook must be a hook.** The catchy hook for each idea should be something that would actually make someone stop scrolling.

**Language consistency.** Write the output in the same language the interview was conducted in.

## Output Format

Save a markdown file containing exactly 5 sections in this format:

```markdown
## Idea #[N]: [Catchy Hook — a phrase that could be the opening line of the post]

- **Source:** [Which moment from the interview this comes from — reference it specifically]
- **Target audience:** [Who would care about this — be specific, not "everyone"]
- **The angle:** [One sentence summarizing the post's core message]
- **Content type:** [Case Study | Contrarian Take | Tactical How-To | Personal/Vulnerable | Curation | Observation]
```

Default output path when none is specified: `~/RBrain/digests/content-mine/content-mine-YYYY-MM-DD.md` if `~/RBrain` exists; otherwise save in the current working directory using the same filename pattern.

## Examples

### Example interview exchange (English)

**Agent:** Think about the conversations you had this week. Did any of them spark a thought?

**User:** Yeah, I had three different sales calls this week where the prospect basically said the same thing: "we already tried AI and it didn't work." Every time, it turned out they'd tried a chatbot in 2022 and wrote off the entire technology.

**Agent:** That's a strong pattern, three prospects, same objection, same root cause. There's definitely something there. Let me ask about something different: what was the hardest problem you dealt with this week?

### Example output idea

```markdown
## Idea #1: "We tried AI. It didn't work."

- **Source:** Three separate sales calls this week where prospects dismissed AI based on a failed chatbot experiment from 2022
- **Target audience:** B2B sales leaders and founders selling AI-adjacent products
- **The angle:** Your prospects aren't anti-AI. They're traumatized by bad 2022 chatbots. Here's how to reframe the conversation.
- **Content type:** Observation
```

## What NOT to do

- Don't turn the interview into a therapy session. Keep it professional and focused on content extraction.
- Don't suggest content ideas that require the user to share confidential information.
- Don't produce generic thought-leadership ideas like "5 tips for better management." Everything must be grounded in their specific week.
- Don't over-explain or add preambles to the output. Deliver the 5 ideas cleanly.
- Don't add anything after the 5 ideas. No bonus ideas, no next steps, no posting strategy, no why-these-work-together section.
- Don't ask all 8 questions if it's clear after 5 that you have plenty of material. Read the room and wrap up early if you've got enough.

## Anti-Patterns

- Asking multiple questions at once.
- Pushing twice after the user already came up empty on a territory.
- Inventing details that were not in the interview.
- Suggesting ideas that depend on confidential or sensitive company details.
- Returning anything other than exactly 5 ideas in the final output.
