# v0.42.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), 2 CPUs. **No real phone.**
Built and tested single-player, as agreed for stages 1–3.

## The cloud-save crash you reported
`tests/cloudsave33.test.mjs` has a new test: the upload gets a "200 OK" that isn't the account server's answer (an
HTML page, `{}`, `{"ok":true}`, `{"ok":true,"save":null}`). **On v0.41 this test fails with your exact error**
("Cannot read properties of undefined (reading 'rev')"); on v0.42 it passes: the upload is reported as not done,
Settings says the server isn't reachable, and the save stays in the browser.

## Unit tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **326 tests: 325 pass, 1 skipped, 0 fail** (includes the 12 below
and the cloud-save test above).

New: `tests/justice42.test.mjs` (12 tests):
- save v20: a new life has a clean slate; an old save gains one without other changes; bad data is cleaned;
- the odds of a crime: people watching and police nearby make it harder; skill and planning help; always 5%–90%;
- an attempt: success pays cash or goods; failure leaves more evidence; police nearby means a chase; a bank job
  always leaves evidence;
- a fence pays 40% of value, more with Hustle, never more than 60%; the bank job's four requirements;
- cases: caught in the act is a warrant; investigators may identify you day by day; below the threshold nobody is;
  an informant's evidence can tip it; a case with nothing new for 21 days goes cold;
- court: a guilty plea is lighter, past convictions heavier, proceeds handed back; weak evidence plus a good lawyer
  means acquittal; bail scales with the charges;
- bribes: sometimes the case disappears, otherwise it is another charge;
- Hustle Kingdoms: one scheme a day; bigger ones need members and skill; members' cut; a boss takes half;
- heat makes disloyal members talk; informants feed the EFCC; paying more buys loyalty; charisma helps spot them;
- police and EFCC: academy and a clean record to join, never children or kingdom members; duties end at the desk;
  corrupt choices carry bribes; no corruption means no complaint;
- a complaint that sticks is a written warning; three and you are dismissed;
- reported crime for officers on duty is the same for everyone on a given day.

## In the real game (browser)
`tests/e2e/justice42.mjs` (preview build): **26 of 26 checks pass**:
1. the Magistrate Court and the back-street dealer are in town, on the map; save version 20;
2. adults can try crime in a conversation (never with police officers);
3. you are asked first, with the odds and what can follow;
4. a successful crime pays and the victim reports it: a case is open;
5. the dealer buys stolen goods for cash;
6. tools bought from the dealer;
7. a warrant makes you wanted (shown as your legal status);
8. near a checkpoint the police recognise you: go quietly, run or resist;
9. in custody you are charged, and choose: plead guilty, trial, bail, or a bribe;
10. pleading guilty gives a sentence: a fine, community service, and handing back the proceeds;
11. sentence served: released, the conviction is on your record;
12. bail: you go home and the hearing is set for tomorrow;
13. at trial a lawyer can win an acquittal: cleared, bail returned (less the lawyer's fee);
14. miss your hearing and a warrant goes out;
15. a Hustle Kingdom: members hired, a scheme pays, the EFCC opens a case; nervous members turn informant;
16. informants feed the EFCC until a warrant is out;
17. the EFCC raid: arrested, and the kingdom is shut down;
18. three academy sessions, then you can join the Nigeria Police Force;
19. a duty in the city, done by the book: steps, an honest report, paid like a shift;
20. the dealer won't deal with an officer;
21. with tools, any walled compound (2,025 of them) can be broken into;
22. the bank job needs tools, a crew, casing the bank by day, and the night;
23. children get no crime options, no academy, no kingdom;
24. cases, tools, academy and history survive a reload (save version 20);
25. a v19 save migrates: a clean slate, cash kept;
26. no page errors.

Screenshots: `qa/v42/` (crime-confirm, dealer, custody, court, phone-law, duty).

Random outcomes (success, verdicts, informants) were fixed in the test so each path could be checked; the game itself
rolls them.

## Regressions (browser), all on the v0.42 build
- `business41` (banks, shops, transport): 18/18
- `life40` (jobs, profile, v17 migration): 19/19
- `phone18` (phone and HUD): 20/20
- `smoke`: 8/8
- `entry` (sign-in / offline entry): 15/15

Not re-run this stage (to keep the wait short): the older browser suites for vehicles, nightlife, football, LAN,
furniture, and the cloud-save browser test (it needs the MariaDB database running). The cloud-save fix is covered by the
unit test above.

## Not tested
- The corrupt path on a duty (taking a bribe, a complaint) was tested in the unit tests, not played in the browser.
- A heist and a break-in actually carried out in the browser: the requirements were checked in the browser and the
  outcomes in the unit tests.
- Running from or resisting arrest end to end (the chase itself is the existing pursuit run, unchanged).
- No real phone; no LAN or multiplayer (stage 5).
- `tests/e2e/skills272.mjs` is still broken from before (waits for a `#preview-tools` element that no longer exists).
