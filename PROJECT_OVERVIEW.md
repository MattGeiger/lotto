# **Technical Specification Document**
## **William Temple House — Digital Raffle & Queue Management Web App**
### **Prepared for: Agentic AI Development**
### **Tech Stack Preference: Next.js + ShadCN UI + Global CSS + JSON Persistence**

---

## **1. Purpose & Problem Context**

William Temple House (WTH) operates a food pantry serving ~150 clients per day. Only ~75 clients are able to shop in the pantry directly; the rest receive pre-packaged food or shopping lists. Historically, clients would line up early, leading to:

- Line-cutting disputes  
- Crowd surges when gates open  
- Perceived unfairness  
- Stress for clients and staff

To improve fairness, WTH adopted a *raffle ticket* system: randomized drawing of ticket numbers using a whiteboard, paper tickets, and a coffee can. While fair, this approach:

- Requires multiple volunteers  
- Is slow to update  
- Is difficult to see from a distance  
- Cannot be viewed remotely  
- Does not retain data if disrupted  

The proposed solution: **a small web app that digitizes this randomized selection process**, preserves fairness, and reduces operational friction.

---

## **2. Project Goals**

The app must:

1. **Generate a randomized sequence of raffle ticket numbers**  
2. **Display that sequence in a clean, airport-style departures/arrivals grid**  
3. **Allow clients to view the board on a large screen *and* on their phones via QR code**  
4. **Allow staff to manage ranges, append new tickets, toggle random/sequential mode, and update “now serving” info**  
5. **Retain randomized data even after refresh, crash, or page navigation**  
6. **Be extremely simple to use for front-end volunteers with minimal technical knowledge**

---

## **3. High-Level System Architecture**

### **3.1 Front-End**
- **Next.js (App Router)**  
- **ShadCN UI components** for clean, accessible styling  
- **Global CSS** for consistency  
- **Client view without background polling** to avoid clobbering in-progress form input on `/admin`
- **Built-in read-only board** at `/display` that polls `/api/state` for wall screens, plus an optional standalone server (`npm run readonly`) for edge/legacy hosting

### **3.2 Back-End**
- Hosted inside Next.js API routes  
- JSON file–based “mini datastore” for durability  
- Simple, fast read/write operations using Node FS  
- Disaster-safe behavior (writes create temporary files + atomic rename)

### **3.3 Persistence**
- **JSON storage**, not CSV  
- Advantages:  
  - Natively handled by JavaScript  
  - No parsing overhead  
  - Flexible schema for additional fields  
- Stored state includes:
  ```json
  {
    "startNumber": 640,
    "endNumber": 690,
    "mode": "random" | "sequential",
    "generatedOrder": [689, 650, 677, ...],
    "timestamp": 1710459345,
    "currentlyServing": 17
  }


⸻

4. Core User Roles

4.1 Front-End (Clients)
	•	View-only
	•	Access via web browser or QR code
	•	See:
	•	Total tickets issued
	•	Randomized (or sequential) ticket order
	•	Highlighted “Now Serving” indicator
	•	Auto-updating information available via the separate read-only board

4.2 Back-End (Staff & Volunteers)

Functionality includes:
	•	Enter start number
	•	Enter end number
	•	Append additional tickets to the range
	•	Choose sort mode:
	•	Randomized
	•	Sequential (first-come-first-serve)
	•	Re-randomize (with modal confirmation)
	•	Update “now serving” field
	•	Reset system (protected by multi-step confirmation modal)
	•	Persist all state changes automatically
	•	Restore previous state if page refreshes or browser closes

⸻

5. Feature Requirements

5.1 Display Grid (Client-Facing)
	•	Airport-style departures grid layout
	•	Responsive design for mobile & large monitors
	•	Numbers displayed in a clean, high-contrast grid
	•	Ability to highlight:
	•	Current number
	•	Upcoming numbers
	•	Optional animation (flipboard-style number transitions)

5.2 Staff Interface
	•	Form fields:
	•	Start number
	•	End number
	•	Additional tickets to append
	•	Buttons:
	•	Generate / re-generate random order
	•	Toggle random vs sequential
	•	Update “Now Serving”
	•	Reset system

All button actions require modal confirmations for safety.

5.3 Data Retention
	•	A JSON file should store:
	•	Current range
	•	Generated order
	•	Next ticket to serve
	•	Timestamp of last update
	•	On load:
	•	If the file exists → load it
	•	If not → create new file with default empty state

5.4 Reliability & Fail-Safes
	•	Atomic write operations
	•	Backups created on each write (state-YYYYMMDDHHMM.json)
	•	Warnings within UI if JSON is malformed
	•	UI lockout indicators during write operations
	•	Soft error handling (system never crashes in public view)

⸻

6. Data Model

6.1 Ticket Range

startNumber: Integer
endNumber: Integer

6.2 Modes

mode: "random" | "sequential"

6.3 Generated Order

generatedOrder: Array<Integer>

6.4 Operational State

currentlyServing: Integer
timestamp: UnixEpochInteger

6.5 Full Schema

{
  "startNumber": 0,
  "endNumber": 0,
  "mode": "random",
  "generatedOrder": [],
  "currentlyServing": null,
  "timestamp": null
}


⸻

7. Logical Behavior

7.1 Generate Randomized Order
	1.	Build array [startNumber → endNumber]
	2.	Shuffle using Fisher–Yates algorithm
	3.	Store result in JSON

7.2 Sequential Mode
	•	Simply display numbers [start → end] in order
	•	Updates automatically when end increases
	•	Does not reshuffle previous values

7.3 Append Tickets
	•	Extend only the upper range
	•	If in random mode:
	•	Only shuffle newly added numbers
	•	Insert them into the existing array in randomized positions
	•	If in sequential mode:
	•	Append numbers sequentially

7.4 Reset

Requires:
	•	“Are you sure?” modal
	•	“Type RESET to confirm” safety measure
	•	Backups automatically archived

⸻

8. QR Code Support
	•	QR code generated client-side
	•	Links to /display page
	•	Updated automatically with each new state change
	•	Helpful for clients away from the board

⸻

9. Security Considerations
	•	No personally identifiable data is stored
	•	Only ticket numbers (anonymous)
	•	Admin page protected with a simple passphrase or pin
	•	No external login system required
	•	State files write-protected and sanitized

⸻

10. Stretch & Optional Features
	•	Live WebSocket updates (if desired)
	•	“Estimated wait time” indicator
	•	Flipboard-style number animations
	•	“Accessibility mode” (high contrast, dyslexia-friendly font)
	•	Multilingual dropdown
	•	Public-facing “What this system is” explanation page

⸻

11. Summary

This app replaces a labor-intensive, analog raffle system with a streamlined, fair, digital queue management tool. It:
	•	Enhances fairness
	•	Reduces tension in morning lines
	•	Lets clients view updates from any device
	•	Lightens staff workload
	•	Remains simple and reliable
	•	Avoids heavy infrastructure by using lightweight JSON persistence

The result is a pragmatic, low-overhead system designed for real-world social-service operations.

⸻

12. Next Steps for Agentic AI
	1.	Scaffold Next.js project
	2.	Build JSON state manager module
	3.	Build staff dashboard
	4.	Build public display UI
	5.	Implement QR code generator
	6.	Implement data persistence and recovery
	7.	Implement safe modal confirmations
	8.	Add styling + accessibility polish
	9.	Perform test runs simulating real WTH operations

⸻
