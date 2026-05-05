# Task Scheduler Chrome Extension

This extension is a lightweight companion for your Task Scheduler backend.

It lets a logged-in user:

- See projects they are involved in
- Open a project and view tasks assigned to them that are due today
- Start and stop a task timer
- Save logged time to `POST /api/time-entries`

## Location

This extension is intentionally outside `frontend` and `backend`:

- `chrome-extension/manifest.json`
- `chrome-extension/popup.html`
- `chrome-extension/popup.css`
- `chrome-extension/popup.js`

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `chrome-extension` folder

## First Use

1. Start backend (`http://localhost:5001`)
2. Open extension popup
3. Keep API Base URL as `http://localhost:5001/api` (or change to your deployed API)
4. Login using your Task Scheduler credentials
5. Select a project
6. Click **Start timer** on a task due today
7. Click **Stop and log time** to send the time entry

## Notes

- Timer state persists in `chrome.storage.local`, so reopening popup keeps the timer running.
- This version filters tasks by `due_date == today` and user assignment.
- Time is logged in hours with up to 4 decimals to match backend precision.