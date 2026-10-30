# v0.43.0 — Open life, stage 4: the account server keeps the books; real hospital and bank buildings

## Hospitals, banks and the court get buildings of their own
You were right: the hospitals (and the banks) were borrowing ordinary city buildings, so one hospital ended up in the
same block as the Ezinne Furniture Showroom. Now each one is **purpose-built on its own clear, road-fronting plot**:
- **Hospitals**: a three-storey white block with a big red-cross panel, the hospital's name on the roof, a
  **24-hour emergency** canopy, an **ambulance bay** with the ambulance parked in it, and a guard post.
- **Banks**: a banking hall in each bank's colours (Nkwo Trust Bank navy and gold, Bridgehead Savings & Loans green
  and white): columns, a glass front, the name on the fascia, an **ATM**, a security post and steps.
- **Magistrate Court**: a columned portico, the green-white-green panel and a flagpole (in v0.42 it had a generic
  "jobs" building by mistake).
- The browser check confirms none of them shares a spot with any of the four home stores and no city building stands
  inside their plots. If no clear plot can be found (it always could here), the old way is used as a fallback.
- Your saves don't change for this: hospitals and banks are found by name, not position.

## Server authority (stage 4)
For an **account you're signed in to**, the account server now keeps its own books for your game, and they win:
- **Money**: every transaction in your wallet, bank account, each business account and each wage escrow is sent to
  the server as it happens. The server accepts it only if the game's rules allow it:
  - no spending money you don't have;
  - nothing counted twice;
  - moving money between your own accounts is fine (it must leave one account to arrive in another);
  - earnings must be possible: no more than that kind of work can pay at once, or in a day (shift pay, shop
    takings, drivers' takings, loans, interest, stolen money, schemes, bribes, sales…). Daily limits follow the real
    day in Onitsha (WAT).
  The server answers with the true balances and the game adopts them. A payment it refuses is taken back out, with a
  message saying why.
- **Property**: the server records what you paid for. A vehicle you never paid for on this account can't be sold or
  pledged for a loan (you keep it; nothing you own is ever removed).
- **The legal record** is append-only: a conviction deleted from the save comes back. Convictions never go down.
- **Reputation** can move at most 30 points per dimension in a day.
- **Cloud saves**: a save uploaded to the account is corrected to the server's books before it's stored, so editing
  the save file doesn't change your account.
- **Phone > Profile > Account server** shows when it last checked, anything it didn't accept, and property it has no
  record of.
- **Offline play and offline saves are unchanged.** Not signed in, the game in your browser is the game.
- When the server switches this on for a life, it opens its books from the game as it is at that moment (your current
  money and property are kept). From then on, it decides.

### Your server
- JSON storage (the default): the books are kept in `server/data/world.json` with everything else.
- MySQL (XAMPP): the server adds one table, `authority`, the first time v0.43 starts. Nothing else in your database
  changes. Checked against a database set up by an older version: users kept, table added.

## Not in this stage
- The server checks the results the game reports against its rules; it doesn't play the game itself. A change made
  within the rules (say, a shift's pay at the top of its range) is accepted.
- Players together (meeting, trading and crime between players, with the opt-out) is stage 5.
