# Changes

Write each change as a new item under **To do**, in the order you want them done. Changes can be for the frontend, backend, database or Android app.
Say "start changes" and Claude works through **To do** from the top, one item at a time. When an item is finished, Claude moves it to **Done** with a short note on what changed.
You can keep adding items at any time.

## To do

- [ ] 

## Done

- [x] delete all the data from the app please
  - All data deleted (workers, attendance, materials, products, buyers, sales, settings…). Database structure kept.
  - A full backup was taken first: `C:\MFP\backups\mfp-before-wipe-20261103-0304.sql` (ask Claude to restore it if needed).
- [x] in the stock module : the stock module should contain three tabs : raw materials supplies and products - whatever production we add at the day end should be added to here
  - Stock now has three tabs: **Raw materials**, **Supplies**, **Products**. The Products tab shows each product's ready stock; production adds to it, sales take from it.
- [x] it should be easier to add the production rather than from stock - remove it from there and add it to dashboard as a hot key : these hot keys should be the ones that are frequently used like new sale, add production, view stock , add buyer
  - Dashboard has four big hot keys at the top: **New sale**, **Add production**, **View stock**, **Add buyer**.
  - Production moved out of Stock to its own **Production** page (products made + materials used, same as before). Products made can now be entered even before any materials are added.
  - Dashboard "Production today" card and the history links on product/material pages now open the Production page.

- [x] in the workers module: i need workers to have a distinction on permanent/temporary (this should be a checkbox while adding the workers) and in the attendance tab i want the permanent ones on top and then temporary workers and also please hard delete on employees please
  - **Permanent / temporary**: new "Permanent worker" checkbox on the add/edit worker form (unticked = temporary). Shown as a badge on the workers list and worker page. Existing workers start as temporary; tick the box on each permanent one.
  - **Attendance**: permanent workers are listed first under a "Permanent" heading, then temporary workers under "Temporary". The workers list is ordered the same way.
  - **Hard delete**: worker page → "Delete permanently" (with a confirmation). Removes the worker and all their attendance, advances and pay history. "Archive" is still there to keep history.
  - Backend: `permanent` column on Worker (migration `worker_permanent`), `DELETE /workers/:id`. Workers spec updated.

