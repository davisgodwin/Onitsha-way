# Simplified phone · v0.19.3

## Corrected scope

Business ads is the only retained community phone app. Removed the added Players/People, Voice, Co-op, Account and Nearby chat apps, their extra screens, the floating online controls and links that reopened those screens. The HUD online count and initials are now non-interactive indicators. Ordinary phone apps, including Messages, Contacts, Jobs and home features, remain.

## Co-op is part of Messages

Open Phone → Messages → Groups. This contains crew invitations, available online friends to invite, crew membership, game rewards and shared task controls. Open the crew conversation to chat. Its Co-op controls button expands an in-chat panel for marking/checking in/cancelling tasks and leaving the crew; the composer remains available. Incoming crew state/messages update without discarding your unsent draft. When a crew ends, the view returns to Groups.

To connect with someone new, find their @username in Messages. Use Conversation actions → Add friend, accept the invitation in Messages, then invite the friend to your crew from Groups or the conversation. Existing invitations remain consent-based. There is no duplicate Nearby chat interface or voice control in a private chat.

## Business ads

Phone → Business ads retains the existing test campaign flow, area selection, seven-day slot quote, optional artwork, mock payment activation, cancellation and map marker. If disconnected, Reconnect appears directly in the business app; no Account app is needed. Messages also has inline Reconnect.

**No real payments.** Campaign activation is still a local test simulation, not production payment processing or moderation.

## Upgrade

No save schema change. Account-first entry remains intact. Preserve your existing server/data folder, browser storage and address (http://localhost:5173). The archive contains no live account records. Run npm ci, then npm run local.

## Validation

npm run check
npm run test:online
npm run test:account
npm run test:mail
npm run test:entry
npm run e2e:phone-community
npm run e2e:phone

The current phone-community browser test is tests/e2e/phone193.mjs. Historical v0.19.2 tests and notes describe that older UI, not this release.
