# The Pet Room

The Pet Room is a window where everything Hermes is working on in Herald shows as a petdex pet of
its own: each conversation, each mission and each helper agent Hermes hands part of a job to. Pets
walk to the area for the tool they are using, a bubble says what each one is doing, a pet walks a
note over to a helper it started and the helper brings the result back, a pet holds up a sign when
it needs your OK, and pets that are idle or have gone quiet say so.

Open it from the Dock (the sofa), from Applications, with the Pet Room button at the top of the
Missions page, from Settings > Pet Room, or by saying "show the pet room".

## What you see

| In the room | What it means |
| --- | --- |
| A pet at Docs, Sheets, Slides or Canvas | Hermes is working on that document, workbook, presentation or image ("working on Q3 report") |
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

The stations a pet works at glow while it is there. The top of the window counts what is going on
("2 working", "1 waiting for you", "3 idle", helpers).

Each pet has a name tag: the conversation's title or, for a helper, the job it was given; hover
over a pet for the whole title. Under the tag, short facts say what is true right now:

- "idle for 12 minutes"
- "quiet for 4 minutes during a turn": nothing has come from Hermes for a while, though the turn is
  still running. A long command or a slow model looks like this too.
- "same call 3 times": Hermes made the same tool call with the same arguments three times in a row.
- "Hermes stopped a repeating call to terminal": Hermes's own guardrail stopped a loop.
- For a helper that has finished: done, could not finish, ran out of time or was stopped.

These are facts, not verdicts: the room says what it sees and leaves the judging to you. A working
pet moves for a few seconds each time Hermes reports something and then holds still, so a pet that
stops moving has had no news.

Click a pet to open its conversation in the Hermes window; a helper opens the conversation that
started it.

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

## Which pets

The room borrows the pets you have installed for Hermes; Settings > Pet has the petdex gallery. It
never installs a pet and never changes the pet Hermes shows on your desktop and in its other apps.
With no pet installed, the room still works and shows name tags, bubbles and signs.

Each kind of work has a pet: conversations, missions and helpers. A conversation counts as a mission
once it keeps a to-do list, as the missions Herald starts do. Settings > Pet Room picks which pet
each kind shows; left on Pick for me, the room spreads your pets over the kinds. When several agents
share a pet (with one pet installed, they all do), each wears a colour of its own, and it keeps that
colour while it is in the room. The room keeps at most four pets' pictures in memory at a time.

## Settings

Settings > Pet Room:

- **Open the Pet Room.**
- **A pet for each kind of work**: conversations, missions and helpers, each with a picture, from
  the pets you have installed or Pick for me.
- **Tell pets apart by colour**, for agents that share a pet.
- **Motion**: Full (pets walk between areas), Calm (they appear where they work, without walking) or
  Still (still pictures). With Reduce motion on, in Herald's Accessibility settings or the system's,
  the room is always still.
- **Show each step**: the bubble that says what each pet is doing. Off leaves the name tags, signs
  and facts.

## Commands and voice

| Command | What it does | Say |
| --- | --- | --- |
| `room.open` | Opens the Pet Room | "show the pet room", "open the pet room", "show what Hermes is doing" |
| `room.status` | Says how many agents are at work, waiting for you or idle, and what each one is doing | "what is in the pet room", "what is Hermes doing" |

On Herald OS Linux, `herald-os os room.open` opens it from a terminal.

## What it shows, and what it does not

- Only work that runs through Herald's own Hermes: the Hermes window's conversations and missions,
  their helpers, the desktop pet's chat and Herald Office's Ask Hermes. Hermes work elsewhere
  (messaging bots, the Hermes CLI and TUI, Hermes's own desktop app, and automations run by Hermes's
  messaging gateway) does not appear yet.
- Titles and steps only. The room never shows what you or Hermes wrote, what a file holds, a
  command's text or Hermes's thinking, and a web address shows as its site's name only. The one
  exception is a helper's result: its bubble shows the first sentence of Hermes's own summary, as
  the Hermes window does.
- If Hermes's tool progress is off (`display.tool_progress: off` in its config, or Hermes's focus
  mode), Hermes does not say which tools it uses, so pets cannot go to areas; the room says so at
  the top.
- Steps follow Hermes about a second behind for busy conversations and up to ten seconds for idle
  ones. When Hermes restarts, the room fills again from what Hermes lists.

## Cost

The room asks Hermes about its work about once a second for each busy conversation, and every ten
seconds for idle ones; nothing at all while the window is closed, minimized or hidden. Pets that
rest draw nothing, and all pets share one picture and one timer. On an Apple Silicon Mac, an open
room with resting pets cost about 0.4% of one processor core in all, and four busy conversations'
polling cost Hermes about 0.2%.

## Linux notes

- The Pet Room is a window of its own, "Herald OS · Pet Room", with its own connection to Hermes.
  Herald's niri config opens it at a third of the screen beside your work; `Super+R` makes it wider.
- Its approval card answers through Hermes directly, and the card in the Hermes window goes away as
  soon as you answer.
