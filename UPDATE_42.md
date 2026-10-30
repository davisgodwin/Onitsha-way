# v0.42.0 — Open life, stage 3: crime, investigations, the courts, Hustle Kingdoms, police and EFCC careers

Stage 3 of the open-life plan, built and tested single-player as agreed. The Nigeria Police Force and the EFCC use
their real names; every officer, suspect, gang, bank and case is fictional. Schemes stay abstract (no technique is
described). Children see none of it: no crime options, no academy, no Hustle Kingdom.

Also in this update: **a fix for the cloud-save crash you reported** ("Cannot read properties of undefined (reading
'rev')"), and the menu footer, which still said "Milestone 32 · v0.32.0", now shows the real version. Your error
report reads its "build" line from that footer, so it looked like an old copy even though it wasn't.

## The cloud-save crash
When an upload got a "200 OK" reply that wasn't the account server's own answer (for example an older server process
still running on port 8787, or another program answering there), the game read a field that wasn't in the reply and
threw. Now any reply the game doesn't recognise counts as "account server not reachable": your save stays safe in the
browser, Settings says so, and it tries again later. If you still see that message, stop the game's
window and start it again with `npm run dev` (make sure no older copy is still running), so the current server is the
one answering.

## Crime against the city
- **In a conversation**, an adult can try to **pick someone's pocket**, or **rob a trader's stall**. You're always asked
  first, with your odds and what can follow. Never with police officers.
- **Break-ins**: once you've bought **tools** from the back-street dealer, any walled compound can be broken into
  (better at night, when the family is asleep).
- **The bank job** (planned heist) on the fictional banks: needs tools, a **crew of two** (hired at the dealer, or your
  Hustle Kingdom's members), **casing the bank in daylight** within the last week, and the **night** (22:00–4:00). A
  getaway vehicle helps. Cameras mean there's always evidence.
- Your chances depend on your Hustle and Fitness skills, **how many people can see you**, **police nearby**, the time,
  how notorious you already are, and your preparation. Fail with police around and you're **chased** (the existing
  pursuit run).
- **Stolen goods** go in your bag; only **Okwy, the back-street dealer** (near Ochanja) buys them: 40% of their value,
  up to 60% with a good Hustle skill. Selling them can lead the police back to you.

## Evidence, investigations, warrants
- A crime that's noticed becomes a **case**: witnesses, cameras and getting caught are its evidence.
- Each day the police (or the EFCC) work it. The stronger the evidence, the likelier they **identify you and put out a
  warrant**. Evidence fades; a case with nothing new for 21 days **goes cold**.
- **Wanted**: officers at checkpoints and on patrol recognise you. **Go quietly**, **run** (a chase; escaping keeps the
  warrant and strengthens it), or **resist arrest** (Fitness; caught or not, it's another charge). You can also
  **turn yourself in** at the station or field office.
- Phone > **Law & street** shows your warrants, what people are asking questions about, your court date and your
  stolen goods. You never see the investigators' numbers.

## Custody and the Magistrate Court
- Arrested, your warrants become **charges**. At the custody desk:
  - **Plead guilty**: a lighter sentence.
  - **Plead not guilty and go to trial today**: defend yourself, take a **legal aid** lawyer (free) or a **private
    lawyer** (₦60,000). Weak evidence and a good lawyer can get you **acquitted**.
  - **Plead not guilty and ask for bail**: go home and come to the **Magistrate Court** (new building, on the map)
    for your hearing the next day. The bond comes back when you attend. **Miss it and a warrant goes out.**
  - **Offer the officer a bribe**: sometimes your file "gets lost"; if not, it's another charge.
- **Sentences**: a fine (or extra service if you can't pay), **community service** done in custody (an hour and a half
  each), and **handing back the proceeds** (from your cash, then your bank account). Stolen goods are confiscated.
  Each conviction makes the next sentence heavier and goes on your record.

## Hustle Kingdoms
- Phone > Law & street: **start a Hustle Kingdom** (₦20,000 for a house) or **join** one of three (The Okpoko Boys,
  Fegge Connect, Odoakpu Syndicate) and keep half of what you bring in.
- **Schemes** (small, bigger, the big one) are one choice each, once a day: they pay, they need members and Hustle
  skill, and they bring **heat**.
- The **EFCC** opens a case on any kingdom. **Members who don't trust you may become informants**, and every
  informant feeds the EFCC. Charisma helps you spot who might be talking; paying the crew extra buys loyalty (not back
  from someone already talking); you can let people go.
- Enough evidence and the **EFCC raids**: you're arrested and the kingdom is shut down.

## Working for the police or the EFCC
- At the **police station** or the **EFCC field office**: three **academy sessions** (one a day, 3 hours each), then
  **apply** (adults only, a clean record, Fitness 2 for the police / Coding 2 for the EFCC, not in a Hustle Kingdom).
- Ranks: Recruit constable → Constable → Corporal → Sergeant → Inspector; Cadet → Detective assistant → Detective →
  Senior detective → Team lead. Promotions work like other jobs (duties done, days, skill, standing).
- **Go on duty** instead of a shift: a duty with steps marked on your map. The police respond to reported crime
  (the scene, then find and arrest a suspect, who may run) or patrol; the EFCC trace bank records, meet an informant,
  and raid a fraud ring's house. You **file a report** at the desk to finish and get paid.
- At each step: **by the book**, or **the corrupt way** (take a bribe, "lose" evidence). Corruption pays and costs
  integrity; it may be **reported**: a complaint that's upheld is a written warning, three and you're dismissed.
  A conviction while serving means dismissal. The dealer won't deal with an officer.

## Saves
- Save version **20**. Older saves get a clean slate (no cases, no stolen goods, no kingdom). Nothing else changes.

## Not in this stage
- Other players can't be targeted yet (that's stage 5, players together, with the opt-out you asked for).
- Server-side checks on money and records are stage 4.
- No 3D fights, weapons or shooting. Arrests, chases and raids use choices and the existing pursuit run.
- Suspects and raided crews appear as people standing at the duty spot; they don't walk or flee in 3D.
