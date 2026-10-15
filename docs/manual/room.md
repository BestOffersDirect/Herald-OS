# The Pet Room

The Pet Room is a window where everything Hermes is working on in Herald shows as a petdex pet of
its own: each conversation, each mission, each helper agent Hermes hands part of a job to, and each
of your automations. Pets walk to the area for the tool they are using, a bubble says what each one
is doing, a pet walks a note over to a helper it started and the helper brings the result back, a
pet holds up a sign when it needs your OK, and pets that are idle or have gone quiet say so. The
documents you have open in Herald stand as desks, and a pet working on one stands at its desk.

Open it from the Dock (the sofa), from Applications, with the Pet Room button at the top of the
Missions page, from Settings > Pet Room, or by saying "show the pet room". It can also be your
screensaver (see [The Room as the screensaver](#the-room-as-the-screensaver)).

## What you see

| In the room | What it means |
| --- | --- |
| A pet at Docs, Sheets, Slides or Canvas | Hermes is working on that document, workbook, presentation or image ("working on Q3 report") |
| A desk below Docs, Sheets, Slides or Canvas | A document open in Herald Docs, Sheets or Slides, or a project open in Herald Canvas (see [Desks and meetings](#desks-and-meetings)) |
| A pet at a desk | Hermes is working on that document |
| Two pets at one desk | Two agents are working on the same document at once ("2 agents on Launch plan.docx") |
| A pet at the Terminal | Hermes is running a command, or checking the system. The room never shows the command itself |
| A pet at the Browser | Hermes is searching the web or reading a page ("reading example.com") |
| A pet at Files | Hermes is reading, writing or searching files ("reading Budget.xlsx") |
| A pet at the Studio | Hermes is running code |
| A pet at Memory | Hermes is updating its memory, reading a skill or searching past conversations |
| A pet at Messages | Hermes is sending a message or using a connected app ("using Gmail") |
| A pet standing in the lounge, reading | A turn has started and Hermes is thinking, with no tool yet |
| A pet resting in the lounge | That conversation is idle |
| A pet on the bench with a sign | It needs your OK (see [Approvals](#approvals)) |
| A pet on the bench, no sign | Hermes asked something in the conversation itself: a question, a password or a secret |
| A pet coming in at the door | A helper agent Hermes started for this work |
| A pet at the Automations board, at work | One of your automations is running (see [Automations](#automations)) |
| A pet resting by the Automations board | An automation between runs |
| A pet in the lane at the right edge | Hermes at work outside Herald, when you turn that on (see [Hermes outside Herald](#hermes-outside-herald)) |

The stations a pet works at glow while it is there, and so does a desk. The top of the window counts
what is going on ("2 working", "1 waiting for you", "3 idle", helpers, automations running and work
active outside Herald).

Each pet has a name tag: the conversation's title, the job a helper was given, or the automation's
name; hover over a pet for the whole title. Under the tag, short facts say what is true right now:

- "idle for 12 minutes"
- "quiet for 4 minutes during a turn": nothing has come from Hermes for a while, though the turn is
  still running. A long command or a slow model looks like this too.
- "same call 3 times": Hermes made the same tool call with the same arguments three times in a row.
- "Hermes stopped a repeating call to terminal": Hermes's own guardrail stopped a loop.
- "2 agents on Launch plan.docx": two agents are working on the same document. It is a hint, not a
  warning: they may be taking turns on purpose.
- For a helper that has finished: done, could not finish, ran out of time or was stopped.
- For an automation: "running for 3 minutes", "ran 2 hours ago", "failed 5 minutes ago", "not run
  yet" or "paused".

These are facts, not verdicts: the room says what it sees and leaves the judging to you. A working
pet moves for a few seconds each time Hermes reports something and then holds still, so a pet that
stops moving has had no news.

Click a pet to open its conversation in the Hermes window; a helper opens the conversation that
started it, and an automation opens Automations at its job. Pets in the lane for Hermes outside
Herald open nothing: that work belongs to another Hermes app.

## Helpers

When Hermes hands work to helper agents, each helper comes in at the door as a pet of its own. The
pet that started it walks over with a note, hands it over and goes back, and the helper walks to the
area for the tool it uses. When the helper finishes, it walks back with the result and, for a few
seconds, says the first sentence of Hermes's summary of what it found. Then it leaves through the
door.

Hermes often lets helpers work in the background: the conversation can be resting in the lounge
while its helpers are still busy, and it starts working again when their results come in.

## Approvals

When Hermes needs a yes or no, the pet goes to the bench and holds up a sign that says Needs your
OK. Click the sign for Herald's own approval card, with the choices it offers anywhere else: Allow
once, Allow this session, Always allow and Deny, as the request allows. Answering here answers it
everywhere, and the card in the Hermes window goes away too. Nothing is ever answered for you, and
the sign and the card never take the keyboard, so a key pressed in another window cannot answer
them. Escape closes the card without answering.

Questions, passwords and secrets never reach the pets: the pet waits on the bench and you answer
in the Hermes window.

## Automations

Each automation on your Automations page stands in the Automations corner, at the front of the room
by the board. While a run is under way its pet is at work at the board ("Running"); between runs it
rests there, and its facts say when the last run was and whether it failed. Automations that run
when something happens are not shown as paused, though Hermes keeps them paused between events.

Automations send Hermes no step by step news, so the room only knows what the Automations page
knows: whether a run is under way, and when the last run happened and how it ended. Hermes counts a
run as under way until it ends or has been silent for five minutes. The room notices a run starting
within a few seconds, as soon as Hermes's automations change.

## Desks and meetings

Each document open in Herald Docs, Sheets or Slides, and each project open in Herald Canvas, stands
as a desk below its app, with the document's name over it (only the name: never where it is or what
is in it). A pet stands at a desk when it works on that document: when its step names the document,
when the latest command its conversation ran in that app named it, or, for a step on "the document
in front", the document in front of that app's window. Up to four desks stand under each app, as
many as fit the room; a document without a desk still has its pet at the app's station.

Two or more pets working on the same document meet at its desk, one on each side, and their tags say
"2 agents on Launch plan.docx". Turn the names on desks off in Settings > Pet Room to leave the
desks unnamed in the room's window.

Herald knows which conversation ran a command in Docs, Sheets, Slides or Canvas because the system
bridge sends it along with each command (see [the system bridge](../SYSTEM-BRIDGE.md)). With an
older bridge, pets still go to desks by their steps and the document in front.

## Hermes outside Herald

Settings > Pet Room > Show Hermes work outside Herald adds a lane at the right edge of the room for
Hermes at work in its other apps: messaging bots, the Hermes CLI and TUI, Hermes's own desktop app,
and automations Hermes's messaging gateway runs. It is off until you turn it on, and while it is off
the room never reads Hermes's list of sessions at all.

The lane is coarse, and says so at its top: it reads Hermes's session list once a minute and shows
each session's title, where it runs ("Telegram", "the Hermes CLI") and how active it is
("Telegram · active now", "the Hermes CLI · last active 25 minutes ago"), for sessions active in the
last hour.
It never shows steps, desks or what anyone wrote. Herald's own conversations stay in the room, and
runs of automations the room already shows stay at the Automations board.

## The Room as the screensaver

Settings > Pet Room > Show the Pet Room as the screensaver turns Herald's screensaver into the room:
the scene alone, with no names, document names, facts or bubbles. Steps in the screensaver brings
back the bubbles that say what each pet is doing, and nothing else. Any key, click, scroll or move
of the mouse ends it, and nothing in it answers or opens: a pet waiting for your OK holds up a sign
with no words, which you answer once you are back.

While Herald Slides is presenting, or while the desktop pet is put away for a screen share, the
screensaver shows the clock instead. Herald knows of these two; it cannot tell when another app
shares your screen. When the screensaver starts, and whether it is on at all, stays in Settings >
General (see [Lock screen, idle and the screensaver](lock-and-idle.md)).

## Which pets

The room borrows the pets you have installed for Hermes; Settings > Pet has the petdex gallery. It
never installs a pet and never changes the pet Hermes shows on your desktop and in its other apps.
With no pet installed, the room still works and shows name tags, bubbles and signs.

Each kind of work has a pet: conversations, missions, helpers, automations and, with its lane on,
Hermes outside Herald. A conversation counts as a mission once it keeps a to-do list, as the
missions Herald starts do. Settings > Pet Room picks which pet each kind shows; left on Pick for me,
the room spreads your pets over the kinds. When several agents share a pet (with one pet installed,
they all do), each wears a colour of its own, and it keeps that colour while it is in the room. The
room keeps at most four pets' pictures in memory at a time.

## Settings

Settings > Pet Room:

- **Open the Pet Room.**
- **A pet for each kind of work**: conversations, missions, helpers, automations and, while the
  lane is on, Hermes outside Herald, each with a picture, from the pets you have installed or Pick
  for me.
- **Tell pets apart by colour**, for agents that share a pet.
- **Motion**: Full (pets walk between areas), Calm (they appear where they work, without walking) or
  Still (still pictures). With Reduce motion on, in Herald's Accessibility settings or the system's,
  the room is always still.
- **Show each step**: the bubble that says what each pet is doing. Off leaves the name tags, signs
  and facts.
- **Document names on desks**, on unless you turn it off.
- **Show Hermes work outside Herald**: the lane, off unless you turn it on.
- **Show the Pet Room as the screensaver**, off unless you turn it on, and **Steps in the
  screensaver**.

## Commands and voice

| Command | What it does | Say |
| --- | --- | --- |
| `room.open` | Opens the Pet Room | "show the pet room", "open the pet room", "show what Hermes is doing" |
| `room.status` | Says how many agents are at work, waiting for you or idle, which automations are running, and what each one is doing; with the lane on, it adds the work active outside Herald | "what is in the pet room", "what is Hermes doing" |

On Herald OS Linux, `herald-os os room.open` opens it from a terminal.

## What it shows, and what it does not

- Work that runs through Herald's own Hermes: the Hermes window's conversations and missions, their
  helpers, the desktop pet's chat and Herald Office's Ask Hermes, plus your automations. Hermes work
  elsewhere (messaging bots, the Hermes CLI and TUI, Hermes's own desktop app, and automations run
  by Hermes's messaging gateway) shows only in the lane, only when you turn it on, and only as
  titles and how active each one is.
- Titles and steps only. The room never shows what you or Hermes wrote, what a file holds, a
  command's text or Hermes's thinking, and a web address shows as its site's name only. The one
  exception is a helper's result: its bubble shows the first sentence of Hermes's own summary, as
  the Hermes window does. An automation shows its name, never its instructions. A desk shows its
  document's name, never where it is, what is selected in it or what it says.
- If Hermes's tool progress is off (`display.tool_progress: off` in its config, or Hermes's focus
  mode), Hermes does not say which tools it uses, so pets cannot go to areas; the room says so at
  the top.
- Steps follow Hermes about a second behind for busy conversations and up to ten seconds for idle
  ones. When Hermes restarts, the room fills again from what Hermes lists.

## Cost

The room asks Hermes about its work about once a second for each busy conversation, and every ten
seconds for idle ones; nothing at all while the window is closed, minimized or hidden. It reads your
automations every two minutes (every 30 seconds while one runs, and soon after they change) and each
automation's latest run every five minutes (every 15 seconds while it runs); the documents open in
Herald every ten seconds (every two while a pet works in Office or Canvas), which Herald answers
itself; and, with the lane on, Hermes's session list once a minute. Pets that rest draw nothing, and
all pets share one picture and one timer.

On an Apple Silicon Mac, an open room with four resting pets (two of them automations) and three
desks cost about 0.6% of one processor core in all, Hermes's share included, over the same Herald
with the room closed. Shown as the screensaver, the room cost about 0.65% more than the clock.

## Linux notes

- The Pet Room is a window of its own, "Herald OS · Pet Room", with its own connection to Hermes.
  Herald's niri config opens it at a third of the screen beside your work; `Super+R` makes it wider.
  In a narrow room, long document names on desks are shortened.
- Its approval card answers through Hermes directly, and the card in the Hermes window goes away as
  soon as you answer.
- The Hermes window passes the room which conversation ran each Office and Canvas command, only
  while the room or the screensaver is open.
- The screensaver is a full screen window of its own, as the clock is.
