# v0.40.0 — Open life, stage 1: no forced path; jobs, reputation and your record

Stage 1 of the open-life redesign you approved (plan: "Onitsha Way — Open-Life Redesign: Audit & Plan"). Built and
tested single-player, as you chose. Nothing tells you what to do any more: you decide how to live and earn, and the
city keeps score.

## What was removed
- **The career pick in character creation.** A new life starts with no job: "looking for opportunities".
- **The 4-chapter "Story & careers" arc** (honest / risky / reformed) and its phone app.
- **The career boards' multiple-choice contracts** and the **"illegal paths"** (street crime and Yahoo as menu
  careers). Crime comes back as real activities with risk in stage 3.
- **"Find Your Friend"**, the only scripted mission (as you asked). The "Missions & Jobs" app is now "Trader jobs".

Kept: trader jobs, wholesale trading, the keke business, shops, homes, furniture, vehicles, venues, sports,
hospitals, police checkpoints, chases, custody and bail, EFCC investigations of old fraud, parcels you can return or
steal, and everything online.

## Jobs (occupations)
- **Workplaces** on the map (Metadav ICT Hub, Main Market desk, property desk, motors workshop, Bridgehead dispatch,
  Ochanja kitchen and fashion workshop) are now employers. **Apply** if you qualify: the skill level, the tools, and a
  clean police record (no job while you're wanted, in custody or owing fines).
- **Work shifts** there, 7:00–20:00 Monday to Saturday (students 7:00–15:00, weekdays), up to 2 a day. Pay depends on
  your rank and how well the shift goes (skill, how rested you are). Shifts use the real Onitsha clock, like the rest
  of the game.
- **Ranks:** 4–5 per job (e.g. Intern → Junior developer → Developer → Senior developer → Lead developer). A promotion
  needs shifts worked, days in the job, skill, and professional standing, so nobody jumps to the top. The workplace
  shows what your next promotion needs.
- **Real choices on the job:** every third shift brings a situation (the old career prompts). Do it properly, or take
  the shortcut. Shortcuts pay more if nobody notices and cost integrity; get caught and it's a written warning.
  **Three warnings and you're dismissed**: that employer won't take you back for 7 days, other employers still will,
  and good work clears warnings over time.
- **Resign** any time; take another job any time (you resign the old one).
- **Working for yourself:** trader jobs, keke fares and wholesale deliveries make you known as an errand runner,
  keke driver or market trader, with their own levels. You can do all of these alongside a job.

## Reputation: seven sides (Profile on your phone)
Public reputation (Trusted, Respected, Known, Controversial, Disliked, Feared), professional reputation (per job),
criminal notoriety, integrity, business reputation, social influence, and wealth and status. Each has a bar, a word
and who can see it. Integrity and notoriety are private; other people see only your public word, social standing,
business standing and wealth tier. Reputation only changes from things that happened (each counted once), an
unproven accusation moves public opinion half as much and nothing else, and bad feeling fades if you give people no
new reason. The latest changes are listed with their reasons.

## Police and work record
Fines, running from checkpoints, held vehicles, custody, bail or community service, work warnings and dismissals are
kept as facts, separate from reputation. Your status line reads Clean record, Clear (has a past record), Fines unpaid,
Open case, Wanted by the police, Under EFCC investigation, or In custody. Employers check it.

## Your existing save
Converted automatically (save version 17 → 18). Nothing is taken: money, homes, furniture, vehicles, skills and
everything else stay. **Your old career becomes your current job** at its starting rank (resign if you like). Trader
jobs, keke trips and wholesale deliveries you already did count towards working for yourself. Your old trust, heat and
choices seed your reputation; unpaid fines, wanted status and custody go on your record. Any unfinished career
contract is cancelled with no penalty; rewards already paid stay paid.

## How to update
Back up first (Settings → Export save, and copy `server/data`). Extract into a fresh folder, copy your own
`server/data` back, `npm ci`, then `npm run dev` (or `npm run lan`). Keep the same browser profile and address.
**Do not clear browser storage.**

## Next (stage 2, after your go-ahead)
Contracts with escrow, organisations with shared accounts, owning a stall / shop / beer parlour / club with stock,
staff and customers, bus and minibus routes and fleets, and **banks with accounts and loans**.
