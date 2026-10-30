# v0.45.0 — Open life, stage 6: politics and elections; sit and lie down; eateries and dates; the palace and other interiors

## Sit down and lie down
- **Anywhere**: press **X** to sit on the ground, **Z** to lie down (on a phone: the **Sit** and **Lie** buttons).
  Walk or jump to get up. Sitting and lying slowly give you energy back (most on a bed).
- **On furniture**: walk up to a chair, bench, sofa or bed and press **E** ("Sit down" / "Lie down"); E again
  stands you up. Works on every seat in the interiors (court benches, waiting chairs, church pews, palace benches,
  restaurant tables, hotel sofas, the nightclub booths, hospital ward beds) and on the sofas, chairs and beds in your
  home. Your bed's menu now starts with **Lie down**, and going to sleep lies you on it.
- **Other players** see you sitting or lying.
- Fixed while building it: the body used to slide off a bed or sofa (it was pushed out of the furniture's
  collision); home furniture turned the wrong way (degrees read as radians).

## The palace and the other interiors
The places that still had the old plain box room now have proper rooms:
- **Ime Obi (palace visitors' hall)**: a red runner to a **roped-off dais with an empty carved chair** and two
  ceremonial umbrellas, carved pillars with gold bands, visitors' benches, palace guards and an attendant, a
  **heritage gallery** (drums, pottery, a carved stool, uli wall paintings) and the **visitors' book**. It is a
  stylised visitors' room, not a copy of the real palace; the Obi is never shown, and the private rooms stay closed.
- **Holy Trinity Basilica and All Saints' Cathedral**: a nave with pews, the sanctuary and altar, a lectern, a choir,
  coloured windows.
- **Christ the King College**: a visitors' classroom (blackboard, desks, trophy cabinet, notice board).
- **Metadav ICT Hub**: rows of computers, the equipment desk, a photo studio corner, a gig board.
- **The hotels**: reception with the key rack, a lounge, a restaurant corner and a made-up day room.
- **The nightclub** booths can be sat in.

## Eateries, and going on a date
Three new fictional restaurants, each its own building with a dining room (map: *Eateries & restaurants*):
**Nne Ada's Kitchen** (near the Main Market: soups and swallow, rice, abacha), **Niger Breeze Grill** (Bridgehead:
suya, asun, grilled fish, open late) and **Ugo Garden Restaurant** (near the mall: a quiet garden room with fairy
lights). Order at the counter (it fills you up), sit at any table.
- **A date with someone you know** in the city (you've talked a few times and know their name): at the counter,
  *Invite someone here on a date*. They join you at a table for two; sit with them, order for two (or just drinks),
  then talk for three rounds. What you say decides how it goes. Good dates build the relationship; after three
  you're "seeing each other". Conversation only. Adults only.
- **A date with another player**: walk up to them, *Ask … on a date — (eatery)* (friends only). If they accept, you
  both go in and sit down; the server counts the date once you've both been there a while.

## Politics and elections (stage 6)
Fictional parties (**Onward Progress Party, People's Renewal Alliance, Greater Anambra Movement, Common Good
Party**) and fictional candidates. The electoral bodies are the real ones (**INEC** for the House of Assembly and the
governorship, **ANSIEC** for council elections) with invented staff. No real politician or party appears.
**Adults only**: a child can't register, join a party, stand, campaign or vote.

**The season** (every 28 days): days 1–7 nominations, days 8–20 the campaign, **day 21 election day** (polls
8:00–17:00), day 22 results and the swearing-in.
- **The Electoral Offices** (map: *Politics & government*): the INEC desk (register to vote, voter card), the ANSIEC
  desk (nominations), the results board, the debate stage, and on election day the **polling unit** with the ballot
  box and voting cubicle.
- **Four offices**: Councillor (Ward 4, Onitsha North), Chairman of Onitsha North LGA, Member of the State House of
  Assembly (Onitsha North I), Governor of Anambra State. Higher offices need more public standing, the chairmanship
  wants experience (or a lot of standing), and the governorship needs an election won first. Nomination forms cost
  money (₦50,000 to ₦5 million).
- **Join a party** on the phone (Politics app). You can switch, but not while you're a candidate.
- **The campaign**: **rallies** at four rally grounds (Main Market, Upper Iweka Motor Park, Bridgehead, Ochanja: a
  stage in your party's colours, a banner with your name), **posters** at the rally grounds, **donations** that come
  in after rallies (and your own money into the campaign fund), and the **candidates' debate** from day 14 (three
  questions; substance scores, empty promises cost integrity). The phone shows a newspaper poll.
- **Voting**: one vote per election, at the polling unit, if you registered before election day. A second vote is
  refused.
- **Counting**: every polling unit's count is kept, and the result is always counted from that record (the phone
  and the results board show it). A tie is re-run between the tied candidates.
- **In office**: a weekly salary, and a **public budget** for the term. Commission **public projects** where you
  stand: solar streetlights, a borehole and water tank, a bus shelter, a toilet block, a playground, road patching,
  a classroom block, a health centre. They go up behind a hoarding and open a few days later, with a signboard
  naming who commissioned them, and **stay in the city**.
- **Corruption**: you can **share money at a rally** (vote buying) or **divert public money** to yourself. Both are
  crimes: the **EFCC opens a case** (more evidence the more you take). A conviction **removes you from office**,
  disqualifies you if you're standing, and **bars you for two seasons**.
- **The players' elections (online)**: on the server, players elect their own councillor, chairman, assembly member
  and governor every week (Onitsha time): Monday–Thursday nominations, Friday campaign, **Saturday voting**, Sunday
  results. One vote per account per office; results counted from the stored vote record; a tie means no winner that
  week. Phone > Politics > Players' elections.

## Saves
- Save version **21** (adds politics). Older saves convert by themselves: you start unregistered and in no party;
  nothing else changes.
- The server stores the players' elections with the rest of its data (JSON or MySQL; no new table).

## Not in this stage
- Office holders' budgets and projects are part of your own game (and your save); the players' elections give a result on
  the phone, not a shared budget or a title over your head.
- NPC voters don't walk to the polling unit; the electorate is counted, not shown.
- The remaining occupations are stage 7; the news feed and world reactions stage 8.
