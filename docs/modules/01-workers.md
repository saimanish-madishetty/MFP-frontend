# Module 1 – Workers

Register workers, mark attendance every day, and work out how much each worker is owed. When a worker is paid, a **Settle pay** button records the payment and starts a fresh pay period.

## Concepts

- **Pay type**: each worker is paid either **per day** (e.g. ₹600/day) or **per month** (e.g. ₹15,600/month).
- **Pay period**: runs from the day after the last settlement (or the joining date) up to today. It is used to show "earned this period" and to group pay history.
- **Settlement**: the "pay day" event. It records what was paid, and the next period starts the following day. Nothing is deleted; past periods stay in the worker's pay history.
- **Bonus**: an optional amount entered on any attendance day, for overtime or extra work. Filled in at the end of the day when needed.
- **Advance**: money given to a worker before pay day. Advances are deducted automatically, because they count against what the worker is owed. *(Improvisation: very common in practice, and without it the pay calculation is wrong whenever an advance was given.)*

## Attendance statuses

| Status | Counts as | Notes |
|---|---|---|
| Present | 1 day | |
| Half day | 0.5 day | |
| Absent | 0 | |
| Paid leave / holiday | 1 day | e.g. a festival holiday that is paid. |
| *(not marked)* | 0 | Weekly offs are simply left unmarked. Unmarked working days are listed as a warning at settlement. |

Each attendance day also has an optional **Bonus (₹)** field and a short note.

## Pay calculation

**Day value**

- Per-day worker: the daily rate.
- Per-month worker: `monthly salary ÷ working days per month`. **Working days per month** is set on each worker (default 26), e.g. ₹15,600 ÷ 26 = ₹600 per day. Working every working day in a month earns the full salary.

The day value is copied onto each attendance record when it's marked, so a change to the rate or the working-days count only affects days marked after the change.

**Earned for a day** = day value × (1, 0.5 or 0 by status) + bonus

**Payable now** = everything ever earned − everything ever paid (settlements) − all advances

Because pay is worked out from the full history, there is no separate carry-forward to maintain:

- If advances exceed earnings, payable shows as negative ("Worker owes ₹X") and is covered by future earnings.
- If a past day is corrected, the difference shows up in payable automatically (see below).

The worker screen splits payable into **earned this period** and **brought forward** (from earlier periods: corrections, leftover advances, or under- or over-payment), so it's clear where the number comes from.

## Editing attendance

**Every day is editable, including days that were already paid**, to allow for mistakes.

- Editing a day in the current period simply changes the period's total.
- Editing a day that was already settled asks for confirmation ("This day was paid on 30 Sep. The difference of +₹600 will be added to the next payment.") and saves the change. The difference flows into **brought forward**.
- Every change to an already-paid day is logged (date, old status and bonus, new status and bonus, amount difference). The log is listed in the next Settle pay breakdown, so nothing changes silently.
- Past settlements are never rewritten: they always show what was actually paid on that date.

## Data model (draft)

- **Worker**: name, phone, role/work type (free text, e.g. "Machine operator"), joining date, pay type (`DAILY` / `MONTHLY`), rate (₹ per day or per month), working days per month (monthly only, default 26), pay cycle (`WEEKLY` + weekday, `MONTHLY` + day of month, or `MANUAL`), permanent (yes/no; no = temporary), photo (optional, later), notes, active.
- **Attendance**: worker, date, status, day value snapshot, bonus, note. Unique per worker per date.
- **AttendanceChange**: attendance, changed at, old status and bonus, new status and bonus, amount difference. Recorded only for days inside an already-settled period.
- **Advance**: worker, date, amount, note.
- **Settlement**: worker, period start, period end, summary at the time (days worked, earned, bonuses, advances, brought forward), amount paid, payment mode (cash/UPI/bank), paid on, note.

## Screens

1. **Today's attendance** (the screen used daily; also the module's landing page)
   - Date at the top (defaults to today, can go to any past day).
   - Every active worker in one list with large P / ½ / A buttons; one tap per worker.
   - A **Bonus** field on each row (collapsed until tapped), filled at the end of the day when needed.
   - "Mark all present" button, then tap the exceptions.
   - Shows how many workers are marked and how many are left.
2. **Workers list**: name, pay type and rate, **payable now**, and a "Pay due" badge when the pay cycle date has arrived.
3. **Worker detail**
   - Contact with call and WhatsApp buttons.
   - Summary: days worked this period, earned this period, bonuses, advances, brought forward, **payable now**.
   - Month calendar coloured by attendance status, with a bonus dot; tap any day to edit it.
   - Buttons: **Settle pay**, Give advance.
   - Pay history (past settlements) and the log of corrections to paid days.
4. **Settle pay** (sheet/dialog)
   - Breakdown: days by status, day value, earned, bonuses, advances, brought forward (with the list of corrections to past days), **payable**.
   - Warning listing unmarked days in the period.
   - Amount paid defaults to the payable amount and can be changed (e.g. paying part now); any difference simply remains in payable.
   - Choose payment mode → Confirm.
5. **Add / edit worker** form.

## Dashboard cards

- Attendance today: "8 / 10 marked".
- Total wages owed right now (sum of payable across workers).
- Workers with pay due.

## Decisions

- Monthly day value = salary ÷ working days per month, configurable per worker (default 26).
- Overtime and extra work = a **bonus** amount on the attendance day; no hours tracking.
- All days stay editable, including paid ones; changes to paid days carry into the next payment and are logged.
- Each worker is **permanent** or **temporary** (a checkbox on the worker form; unticked = temporary). The attendance screen lists permanent workers first, then temporary, under separate headings.
- Workers can be **deleted permanently** (worker detail → Delete permanently, with a confirmation). This removes all their attendance, corrections, advances and pay history. Archiving remains the way to keep history. This is the one exception to the no-hard-deletes convention.
