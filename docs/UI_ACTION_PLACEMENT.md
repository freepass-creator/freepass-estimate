# FreePass Action Placement Standard

Status: **ACTIVE**
Date: 2026-09-19
Source: AI Core `docs/SCREEN_DESIGN_STANDARD.md`

## Rule

**Top is informational. Bottom is actionable.**

### Top/header
Allowed:
- CI / product name
- page title
- progress
- passive state / version / context

Not allowed by default:
- Save
- Submit
- Share
- Send
- Reset
- Preview
- Export
- Complete
- other task CTAs

### Bottom action area
Use for:
- Back / Next
- View quote
- Share
- Send quote
- Save / Submit / Complete
- Reset
- Preview / Export
- cart / batch actions

Mobile uses a sticky/fixed footer. Desktop uses an anchored bottom action bar.

### Content selections are not CTAs
Manufacturer, model, powertrain, seat/drive choice, trim, color, option, radio, checkbox and dropdown controls stay inside the content where the user makes the choice.

### Single-choice steps
For manufacturer → model → powertrain → optional seat/drive → trim:
- tap selection
- advance immediately
- keep Back in bottom area where needed
- do **not** show a redundant Next button

### Dialogs
Dialog header = title/context.
Dialog actions = dialog footer.

