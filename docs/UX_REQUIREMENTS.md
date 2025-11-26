# UX Requirements: Safety-Critical Raffle System

## Executive Summary

This system manages daily food distribution lottery for vulnerable clients at William Temple House. Client positions must be **immutable once displayed**. Any position changes break trust and can provoke conflicts. This document defines safety requirements to prevent accidental order disruption.

---

## User Context

### Client Population
- **Food insecure** - hungry, waiting for essential resources
- **Language barriers** - many non-English speakers
- **Mental health challenges** - SPMI, trauma, addiction
- **Low technical literacy** - limited familiarity with digital systems
- **Low trust** - past experiences with systemic failures

**Critical Principle:** Once a client sees their position, it becomes sacred. Changes to order = broken trust = conflict risk, potentially violence.

### Staff Users
- Front desk administrators managing crowd control
- Operating under time pressure during peak service hours
- May accidentally click wrong buttons in high-stress environment
- Need simple, error-resistant interface

---

## Workflow Phases

### Phase 1: Initial Draw (10:50am)
1. Gates open, clients receive tickets (e.g., 10530-10580)
2. Staff enters range into admin page
3. System generates **randomized order** and **locks positions**
4. Display shows order on TV screen
5. Staff sets "Now Serving" to first 8 tickets
6. **All 51 positions are now immutable**

### Phase 2: Random Batch Appends (10:50-11:15am)
1. Late arrivals receive tickets 10581-10592
2. Staff appends via admin page (mode: Random)
3. System randomizes **new batch only** (10581-10592 shuffled among themselves)
4. Appends shuffled batch to end of queue
5. **Previous positions 1-51 remain unchanged**
6. Clients in positions 1-51 see same neighbors, same relative positions

### Phase 3: Sequential Appends (After 11:15am)
1. Staff switches mode to Sequential
2. New tickets 10593-10615 issued
3. Staff appends via admin page (mode: Sequential)
4. System appends in exact order issued
5. **All previous positions remain unchanged**

### Phase 4: Next Day Reset
1. End of service day
2. Staff clicks "Reset" with confirmation dialog
3. System clears all state
4. Ready for next day's cycle

---

## Safety Requirements

### Critical Operations That Must Be Locked

#### 1. Regenerate Order
**Risk:** Completely replaces existing order. Client #5 becomes #47.

**Guards:**
- Block regeneration after initial draw
- Require `orderLocked === false`
- Show error: "Order is locked. Use Reset to start new lottery."
- UI: Disable "Generate" button when locked

#### 2. Rerandomize
**Risk:** Reshuffles all existing positions. Everyone's place changes.

**Solution:** **Remove function entirely.** No legitimate use case after clients see numbers.

#### 3. Random Position Insertion
**Risk:** Old `insertAtRandomPositions()` shuffled new tickets INTO existing queue.

**Fix:** Shuffle new batch separately, append entire batch to end.

```typescript
// ❌ OLD (DANGEROUS)
insertAtRandomPositions(existingQueue, shuffle(newTickets))
// This could place ticket 10581 between positions 15 and 16

// ✅ NEW (SAFE)
[...existingQueue, ...shuffle(newTickets)]
// New tickets 10581-10592 shuffled among themselves, appended as block
```

### Safe Operations

#### 1. Append Tickets
- **Random mode:** Shuffles new batch, appends to end
- **Sequential mode:** Appends in order
- **Never reorders existing positions**

#### 2. Update "Now Serving"
- Changes display pointer only
- No position changes
- Always safe

#### 3. Switch Mode (Random ↔ Sequential)
- Changes behavior for **future appends only**
- Does not touch existing order
- Safe after initial draw

#### 4. Reset
- Clears entire state for new daily cycle
- Requires confirmation dialog
- Only way to unlock for regeneration

---

## Implementation Strategy

### State Model

```typescript
type RaffleState = {
  startNumber: number;
  endNumber: number;
  mode: "random" | "sequential";
  generatedOrder: number[];
  currentlyServing: number | null;
  orderLocked: boolean;  // Prevents regeneration
  timestamp: number | null;
  displayUrl: string | null;
};
```

### Guard Logic

**generateState():**
- Check `orderLocked === true` → throw error
- Generate order, set `orderLocked = true`
- Cannot be called again without Reset

**appendTickets():**
- Build new range
- If `mode === "random"`: shuffle new batch only
- If `mode === "sequential"`: keep new batch in order
- Append batch to end: `[...existingOrder, ...newBatch]`

**setMode():**
- Allowed anytime
- Updates mode for future operations
- Does not regenerate or reorder

**rerandomize():**
- Delete function from codebase
- Remove from API routes
- Remove from UI

**resetState():**
- No guards needed
- Returns to `defaultState` with `orderLocked = false`

---

## UI/UX Requirements

### Admin Page Indicators

**When Order Locked:**
```
✓ Lottery Active
Initial draw: tickets 10530-10580 (locked)
Current mode: RANDOM (new tickets randomized within batch)
```

**Mode Selector:**
```
Append Mode (affects new tickets only):
○ Random (10:50-11:15am) - shuffles new batch before appending
○ Sequential (after 11:15am) - adds tickets in order issued

Note: Changing mode does not affect existing tickets
```

### Button States

**Generate Order:**
- Disabled when `orderLocked === true`
- Tooltip: "Order already generated. Use Reset to start new lottery."

**Rerandomize:**
- **Remove button entirely**

**Reset:**
- Always enabled
- Opens confirmation dialog

### Confirmation Dialogs

**Reset Dialog:**
```
Title: "Reset Lottery - DESTRUCTIVE ACTION"

Message: "This will completely clear the current lottery and all client 
positions. Clients who have seen their numbers will lose their place in 
line. Only do this to start a new daily cycle."

Buttons: [Cancel] [Yes, Reset Lottery]
```

### Error Messages

**Attempt to regenerate when locked:**
```
Order is locked. Cannot regenerate—this would change all client positions.
Use Reset to start a new lottery.
```

**Attempt to rerandomize (if not removed):**
```
Rerandomization is disabled. This would disrupt all client positions and 
break trust. This operation has been removed for client safety.
```

---

## Client Benefits

### Transparency
- Immediate knowledge of queue position
- No suspenseful waiting for number calls
- Can monitor position from phone anywhere

### Fairness
- True random draw (cryptographically shuffled)
- No perception of favoritism
- Positions cannot be manipulated

### Autonomy
- Can leave and return based on queue progress
- Don't need to stay in crowded waiting area
- Better control over their time

### Trust
- Positions never change after initial display
- System behavior is consistent and predictable
- Digital record prevents disputes

---

## Staff Benefits

### Efficiency
- No manual ticket drawing from can
- No calling out numbers
- No whiteboard updates
- Focus on client needs, not lottery mechanics

### Crowd Control
- Clients can wait elsewhere
- Reduced crowding at front desk
- Better flow management

### Error Prevention
- System prevents dangerous operations
- Clear visual feedback on locked state
- Impossible to accidentally disrupt order

### Conflict Reduction
- Fewer disputes about positions
- Digital record is authoritative
- No manual errors in recording numbers

---

## Testing Requirements

### Safety Tests
1. Verify `generateState()` throws error when locked
2. Verify `appendTickets()` never reorders existing positions
3. Verify mode switch does not regenerate order
4. Verify Reset is only way to unlock

### Workflow Tests
1. Generate initial order (10530-10580)
2. Verify positions locked
3. Append batch in random mode (10581-10592)
4. Verify original 51 positions unchanged
5. Switch to sequential mode
6. Append batch in sequential mode (10593-10615)
7. Verify all previous positions unchanged
8. Reset and verify unlock

### UI Tests
1. Generate button disabled when locked
2. Mode toggle works after generation
3. Reset confirmation dialog appears
4. Status indicators show correct state

---

## Success Metrics

### Technical
- Zero position changes after initial display
- 100% append safety (new tickets only at end)
- Zero regeneration bugs in production

### Operational
- Staff can complete workflow without confusion
- No accidental resets during service hours
- Quick daily reset process (<30 seconds)

### Client Impact
- Reduced conflicts over positions
- Increased trust in system
- Better waiting experience
- Clients can monitor queue remotely

---

## Migration Notes

### Database Schema
Order lock state persists across requests:
```sql
-- Already stored as JSONB payload in raffle_state table
-- No schema changes needed, just add orderLocked to payload
```

### Backward Compatibility
- Existing state files/DB records without `orderLocked` default to `false`
- Safe migration: unlocked state allows first generation
- After first deployment generation, state auto-locks

### Deployment Checklist
- [ ] Update `state-types.ts` with `orderLocked: boolean`
- [ ] Add guards to `generateState()`
- [ ] Fix `appendTickets()` batch logic
- [ ] Remove `rerandomize()` function
- [ ] Update API routes to remove rerandomize endpoint
- [ ] Update UI to disable Generate when locked
- [ ] Remove Rerandomize button from UI
- [ ] Add Reset confirmation dialog
- [ ] Add status indicators for locked state
- [ ] Test full workflow in Docker
- [ ] Deploy to staging, verify safety guards
- [ ] Train staff on new workflow
- [ ] Deploy to production

---

## Appendix: Technical Reference

### Correct Append Implementation

```typescript
const appendTickets = async (newEndNumber: number) => {
  const current = await safeReadState();
  ensureHasRange(current);

  if (newEndNumber <= current.endNumber) {
    throw new Error("New end number must be greater than current end.");
  }

  const additions = buildRange(current.endNumber + 1, newEndNumber);
  
  // Shuffle new batch only, never reorder existing
  const newBatch = current.mode === "random" 
    ? shuffle(additions)  // Randomize within new batch
    : additions;          // Keep sequential
  
  // Append entire batch to end
  const generatedOrder = [...current.generatedOrder, ...newBatch];

  return persist({
    ...current,
    endNumber: newEndNumber,
    generatedOrder,
  });
};
```

### Guard Pattern

```typescript
if (current.orderLocked) {
  throw new Error(
    "Operation forbidden: would disrupt client positions. " +
    "Use Reset to start new lottery."
  );
}
```

---

---

## THE SCRAM BUTTON: UNDO/REDO AS NUCLEAR SAFETY

### Critical Safety Principle

**This system must have a fail-safe undo mechanism equivalent to a nuclear reactor's SCRAM button.**

In nuclear engineering, SCRAM (Safety Control Rod Axe Man) is the emergency shutdown system. When triggered, it MUST work—no exceptions, no failures. Lives depend on it.

Our undo/redo system serves the same function: **absolute, reliable, instantaneous recovery from human error.**

### Why This Matters

**Scenario 1: Fat-Finger Error**
- Staff enters tickets 10530-10580 but accidentally types 10530-**11580**
- System generates order with 1,051 tickets instead of 51
- Display shows incorrect positions
- **Solution:** Press Undo → Instantly back to pre-generation state

**Scenario 2: Accidental Advance**
- Staff meant to set "Now Serving" to ticket 8
- Accidentally clicks on position 47 (last ticket)
- All clients see service is "complete" and panic
- **Solution:** Press Undo → Instantly back to correct serving position

**Scenario 3: Wrong Append Range**
- Staff appends 10581-10620 but meant 10581-10590
- 40 extra tickets added, confusing queue display
- **Solution:** Press Undo → Instantly back to 80-ticket state

**Scenario 4: Accidental Reset**
- Staff accidentally confirms Reset during active service
- Entire lottery cleared, all client positions lost
- **Solution:** Press Undo → Instantly restore complete state

### Current Implementation: Automatic Snapshotting

**Every state change creates an immutable snapshot:**

```typescript
const persist = async (state: RaffleState, options) => {
  // Generate unique snapshot ID
  const snapshotId = `state-${timestamp}-${uniqueSuffix}.json`;
  
  // Store in database (unless skipBackup: true)
  if (!options?.skipBackup) {
    await sql`
      INSERT INTO raffle_snapshots (id, payload, created_at)
      VALUES (${snapshotId}, ${payload}::jsonb, now())
    `;
  }
  
  // Update current state
  await sql`
    INSERT INTO raffle_state (id, payload, updated_at)
    VALUES ('singleton', ${payload}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = excluded.payload
  `;
};
```

**Operations that create snapshots:**
- Generate order
- Append tickets
- Set mode
- Update "Now Serving"
- Reset state
- Restore from snapshot (for redo functionality)

**Operations that skip snapshots:**
- None by default—every change is tracked

### Undo/Redo Mechanism

**Undo Logic:**
```typescript
const undo = async () => {
  const snapshots = await listSnapshots(); // Sorted DESC by created_at
  
  if (snapshots.length < 2) {
    throw new Error("No history available.");
  }
  
  // Store current state for potential redo
  lastRedoSnapshot = snapshots[0];
  
  // Restore to previous state
  const previous = snapshots[1];
  return restoreSnapshot(previous.id);
};
```

**Redo Logic:**
```typescript
const redo = async () => {
  if (!lastRedoSnapshot) {
    throw new Error("No later snapshot to redo to.");
  }
  
  const target = lastRedoSnapshot;
  lastRedoSnapshot = null;
  
  return restoreSnapshot(target.id);
};
```

**Key Features:**
- Undo goes back one snapshot
- Redo restores the state before undo (single-level redo)
- New action after undo clears redo possibility
- All snapshots preserved in database for manual recovery

### Storage Capacity: Absurdly Large History

**Neon Free Tier:** 512 MB of database storage

**Snapshot Size Calculation:**

Typical RaffleState with 100 tickets:
```json
{
  "startNumber": 10530,
  "endNumber": 10630,
  "mode": "random",
  "generatedOrder": [10547, 10531, 10589, ...], // 100 numbers
  "currentlyServing": 10547,
  "orderLocked": true,
  "timestamp": 1732579200000,
  "displayUrl": "https://williamtemple.app/display"
}
```

**Size breakdown:**
- Metadata fields: ~150 bytes
- generatedOrder array: 100 numbers × 5 bytes (JSON encoding) = 500 bytes
- JSONB overhead: ~20-30% = 130-195 bytes
- **Total per snapshot: ~780 bytes**

**Maximum snapshots with 512 MB:**
```
512 MB = 536,870,912 bytes
536,870,912 bytes ÷ 780 bytes/snapshot = 688,296 snapshots
```

**Even with 500 tickets per lottery:**
- Snapshot size: ~2.5 KB
- Maximum snapshots: 214,748 snapshots

### Daily Operation Snapshot Count

**Typical day's operations:**
1. Generate initial order: **1 snapshot**
2. Set "Now Serving" (first 8): **8 snapshots**
3. Append batches (10 times): **10 snapshots**
4. Update "Now Serving" (40 times): **40 snapshots**
5. Switch mode: **1 snapshot**
6. More appends/updates: **20 snapshots**

**Total per day: ~80 snapshots**

**Daily storage:**
- 80 snapshots × 780 bytes = 62.4 KB/day

**Annual storage:**
- 62.4 KB/day × 365 days = 22.8 MB/year

**Years of history in 512 MB:**
- 512 MB ÷ 22.8 MB/year = **22.4 years**

### Retention Strategy

**Phase 1 (Current Implementation):**
- Keep all snapshots indefinitely
- No automatic cleanup
- Rely on 512 MB being sufficient for years

**Phase 2 (If Needed):**
- Retain last 30 days: full granularity (all snapshots)
- Retain 31-90 days: hourly granularity (thin to first snapshot per hour)
- Retain 91-365 days: daily granularity (thin to first snapshot per day)
- Delete snapshots older than 1 year

**With retention policy:**
- Last 30 days: 80 × 30 = 2,400 snapshots = 1.87 MB
- 31-90 days: 24 × 60 = 1,440 snapshots = 1.12 MB
- 91-365 days: 275 snapshots = 214 KB
- **Total with policy: ~3.2 MB**

**This leaves 508.8 MB free for years of retention.**

### UI Implementation Requirements

**Admin Page Undo/Redo Controls:**

```typescript
<div className="flex gap-2">
  <Button
    onClick={handleUndo}
    disabled={!canUndo}
    variant="outline"
    title="Undo last action (Ctrl+Z)"
  >
    <Undo2 className="size-4" />
    Undo
  </Button>
  
  <Button
    onClick={handleRedo}
    disabled={!canRedo}
    variant="outline"
    title="Redo last undone action (Ctrl+Y)"
  >
    <Redo2 className="size-4" />
    Redo
  </Button>
  
  <Button
    onClick={handleViewHistory}
    variant="ghost"
    title="View full history"
  >
    <History className="size-4" />
    History
  </Button>
</div>
```

**Visual Feedback:**
```typescript
// After undo
<Alert variant="success" className="animate-in fade-in">
  ✓ Undid: Set Now Serving → 10547
  Restored to: Now Serving → 10532
</Alert>

// After redo
<Alert variant="success" className="animate-in fade-in">
  ✓ Redid: Set Now Serving → 10547
</Alert>
```

**Snapshot History Dialog:**
```typescript
<Dialog>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>State History</DialogTitle>
      <DialogDescription>
        View and restore from any previous state
      </DialogDescription>
    </DialogHeader>
    
    <ScrollArea className="h-96">
      {snapshots.map((snapshot) => (
        <div key={snapshot.id} className="flex justify-between p-2">
          <div>
            <div className="font-medium">
              {formatTimestamp(snapshot.timestamp)}
            </div>
            <div className="text-sm text-muted-foreground">
              Tickets: {snapshot.payload.startNumber}-{snapshot.payload.endNumber}
              {snapshot.payload.currentlyServing && 
                ` | Serving: ${snapshot.payload.currentlyServing}`}
            </div>
          </div>
          <Button
            onClick={() => handleRestore(snapshot.id)}
            variant="outline"
            size="sm"
          >
            Restore
          </Button>
        </div>
      ))}
    </ScrollArea>
  </DialogContent>
</Dialog>
```

### Testing Requirements

**Undo/Redo Tests:**
1. Generate order → Undo → Verify back to empty state
2. Set serving → Undo → Verify previous serving value
3. Append tickets → Undo → Verify original end number
4. Undo → Redo → Verify returns to pre-undo state
5. Undo → New action → Verify redo disabled
6. Multiple undos → Verify walks back through history
7. Undo after reset → Verify restores pre-reset state

**Snapshot Persistence Tests:**
1. Create 100 state changes
2. Verify all 100 snapshots in database
3. Query `raffle_snapshots` table
4. Verify JSONB payload integrity
5. Verify created_at timestamps ordered correctly

**Recovery Scenario Tests:**
1. **Fat-finger recovery:**
   - Enter wrong range → Generate → Undo → Verify recovery
2. **Accidental advance recovery:**
   - Set serving to last → Undo → Verify correct position
3. **Wrong append recovery:**
   - Append wrong range → Undo → Verify original range
4. **Accidental reset recovery:**
   - Reset → Undo → Verify full state restored

### Database Schema Requirements

**Ensure indexes for performance:**
```sql
CREATE INDEX IF NOT EXISTS raffle_snapshots_created_at_idx 
  ON raffle_snapshots(created_at DESC);

CREATE INDEX IF NOT EXISTS raffle_snapshots_id_idx 
  ON raffle_snapshots(id);
```

**Verify JSONB operator support:**
```sql
-- Test JSONB queries work
SELECT payload->>'startNumber' as start,
       payload->>'endNumber' as end,
       payload->>'currentlyServing' as serving
FROM raffle_snapshots
ORDER BY created_at DESC
LIMIT 10;
```

### Error Recovery Procedures

**Procedure 1: Immediate Undo (Staff-Accessible)**
1. Staff notices error immediately
2. Clicks "Undo" button
3. System restores previous state
4. Display updates automatically
5. No client impact if caught within seconds

**Procedure 2: Recent History Restore (Staff-Accessible)**
1. Staff realizes error minutes later
2. Clicks "History" button
3. Reviews recent snapshots
4. Selects correct state
5. Clicks "Restore"
6. Confirm dialog appears
7. System restores selected state

**Procedure 3: Deep History Recovery (Admin-Accessible)**
1. Error discovered hours/days later
2. Admin queries database directly:
   ```sql
   SELECT id, created_at, 
          payload->>'startNumber' as start,
          payload->>'endNumber' as end
   FROM raffle_snapshots
   WHERE created_at::date = '2025-11-25'
   ORDER BY created_at DESC;
   ```
3. Identifies correct snapshot ID
4. Uses admin API to restore:
   ```bash
   curl -X POST /api/state \
     -d '{"action": "restoreSnapshot", "id": "state-20251125103045123-abc123.json"}'
   ```

### Success Criteria

**Reliability:**
- 100% of undo operations succeed
- Zero snapshot write failures
- Zero data corruption in JSONB payloads

**Performance:**
- Undo completes in <500ms
- Redo completes in <500ms
- History list loads in <1 second

**Recovery:**
- Any error recoverable within 5 seconds
- Staff trained on undo procedures
- No manual database intervention needed for common errors

**Capacity:**
- System handles 65,536+ snapshots without performance degradation
- Database stays under 512 MB for years of operation

---

**Document Version:** 1.1  
**Last Updated:** 2025-11-25  
**Authors:** Claude, Geiger  
**Review Status:** Approved for implementation  
**Changelog:**  
- v1.1: Added comprehensive undo/redo documentation (SCRAM system)
- v1.0: Initial safety requirements and workflow documentation
