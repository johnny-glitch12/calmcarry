# Parental consent screen copy (draft for counsel review)

NOT LEGAL ADVICE. Values in [SQUARE BRACKETS] must be filled before shipping.

DRAFT COPY FOR THE IN-APP PANEL. Shown once, inside the parent-gated area, immediately before a child profile can be created. This is an informed-parent acknowledgement and an auditable record. Under the recommended approach it is NOT the legal consent event, because there is no collection from the child to consent to. Do not label it "verifiable parental consent" anywhere in the UI or in analytics event names.

---

SCREEN TITLE
Before you add a child

INTRO
Kids mode is built so we do not receive information about your child. Here is exactly what happens, in plain terms.

BODY (four points, each with a check or lock icon)

1. We ask for a first name, and nothing else.
It stays on this phone. It is never sent to our servers. We cannot see it.

2. We record nothing while kids mode is on.
No usage analytics. No crash reports. Both are switched off in the app the moment a child profile becomes active.

3. No ads. Not now, not later, not from anyone.
No advertising, no ad networks, no tracking across other apps, no profile built about your child.

4. Nothing to share, nothing to send.
No chat, no messages, no comments, no leaderboards. Nobody can contact your child through CalmCarry.

RETENTION LINE
You can delete the child profile at any time, from the Family screen. That removes the name from this phone. There is no copy anywhere else.

PARENT GATE LINE
Your PIN keeps kids mode locked and keeps your child out of the adult areas. It is a lock, not an age check.

LINK
Read the full Children's Privacy Notice

CONFIRMATION CHECKBOX (must be ticked to continue, unticked by default)
I am this child's parent or legal guardian, and I have read the above.

PRIMARY BUTTON
Continue and add child

SECONDARY BUTTON
Not now

---

DECLINE PATH ("Not now")
No problem. You can add a child profile later from the Family screen. Nothing has been saved.

---

CONFIRMATION TOAST AFTER PROFILE CREATION
Child profile created. [Name] is saved on this device only.

---

SETTINGS SCREEN ENTRY (persistent, so the parent can revisit)
Label: What kids mode collects
Sub-label: First name, on this device only. Nothing sent to us.
Tapping opens the same panel in read-only form, plus a "Remove child profile" action.

---

COPY RULES FOR WHOEVER EDITS THIS LATER
- Never write "we protect your child's data" when the accurate line is "we do not receive your child's data". The second is stronger and it is true.
- Never call this screen consent to collection. It is an acknowledgement.
- If the app is ever changed so that a child's name, or anything else about a child, is sent to a server, this screen is no longer adequate and a real verifiable parental consent flow is required before the change ships. Treat that as a hard gate, not a follow-up ticket.