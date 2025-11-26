# Release Plan: Safety-Critical UX Hardening

## Executive Summary

**Goal:** Implement safety hardening and database migration for William Temple House raffle system.

**Timeline:** 6 phases over 3-4 weeks  
**Current Version:** 0.1.0 (pre-hardening)  
**Target Version:** 1.0.0 (production-ready)

---

## Phase Structure

Each phase includes:
- Specific deliverables
- Testing requirements
- Documentation updates
- Git commit guidelines
- Success criteria

---

## PHASE 1: Core Safety Model (Week 1, Days 1-2)

### Objective
Add `orderLocked` state field and implement foundational guard logic.

### Tasks

#### 1.1 Update State Types
- [ ] Add `orderLocked: boolean` to `RaffleState` type in `state-types.ts`
- [ ] Update `defaultState` with `orderLocked: false`
- [ ] Verify backward compatibility with existing states

**Files to modify:**
- `src/lib/state-types.ts`

**Git commit:**
```
feat: add orderLocked field to RaffleState

- Add orderLocked: boolean to state type
- Default to false for backward compatibility
- Preparation for position lock safety guards
```

#### 1.2 Add Guard to generateState()
- [ ] Add lock check in `state-manager.ts` `generateState()`
- [ ] Add lock check in `state-manager-db.ts` `generateState()`
- [ ] Set `orderLocked: true` on generation
- [ ] Add descriptive error message

**Files to modify:**
- `src/lib/state-manager.ts`
- `src/lib/state-manager-db.ts`

**Implementation:**
```typescript
const generateState = async (input: {...}) => {
  const current = await safeReadState();
  
  // NEW GUARD
  if (current.orderLocked) {
    throw new Error(
      "Order is locked. Cannot regenerate—this would change all client positions. " +
      "Use Reset to start a new lottery."
    );
  }
  
  validateRange(input.startNumber, input.endNumber);
  const generatedOrder = generateOrder(input.startNumber, input.endNumber, input.mode);
  
  return persist({
    startNumber: input.startNumber,
    endNumber: input.endNumber,
    mode: input.mode,
    generatedOrder,
    currentlyServing: null,
    orderLocked: true, // NEW
    timestamp: null,
    displayUrl: current.displayUrl ?? null,
  });
};
```

**Git commit:**
```
feat: lock order after generation to prevent regeneration

- Add guard to generateState() checking orderLocked
- Set orderLocked: true after initial generation
- Throw descriptive error on regeneration attempt
- Prevents accidental position changes after clients see numbers
```

#### 1.3 Unit Tests
- [ ] Test generation sets `orderLocked: true`
- [ ] Test regeneration throws error when locked
- [ ] Test error message is descriptive
- [ ] Test unlocked state allows generation

**Test file:** `src/lib/state-manager.test.ts` (create if needed)

**Git commit:**
```
test: add unit tests for orderLocked generation guard

- Test generation locks order
- Test locked state prevents regeneration
- Test error messages
```

#### 1.4 Documentation
- [ ] Update CHANGELOG.md with Phase 1 changes
- [ ] Add migration notes for existing deployments

**CHANGELOG.md entry:**
```markdown
## [0.2.0] - 2025-11-26

### Added
- orderLocked field to RaffleState for position safety
- Generation guard preventing order regeneration after lock

### Security
- Prevents accidental position changes after clients view order
```

**Git commit:**
```
docs: document orderLocked field and generation guard
```

### Success Criteria
- ✅ All unit tests pass
- ✅ Generate works on fresh state
- ✅ Generate blocked on locked state
- ✅ Error messages clear and helpful
- ✅ Docker build succeeds
- ✅ No TypeScript errors

---

## PHASE 2: Fix Append Logic (Week 1, Days 3-4)

### Objective
Correct `appendTickets()` to never reorder existing positions.

### Tasks

#### 2.1 Fix Random Append Logic
- [ ] Replace `insertAtRandomPositions()` with batch shuffle
- [ ] Update in `state-manager.ts`
- [ ] Update in `state-manager-db.ts`
- [ ] Preserve mode-specific behavior

**Current (WRONG):**
```typescript
const generatedOrder = current.mode === "random"
  ? insertAtRandomPositions(current.generatedOrder, shuffle(additions))
  : [...current.generatedOrder, ...additions];
```

**New (CORRECT):**
```typescript
const newBatch = current.mode === "random"
  ? shuffle(additions)  // Shuffle new batch only
  : additions;          // Keep sequential

const generatedOrder = [...current.generatedOrder, ...newBatch];
```

**Files to modify:**
- `src/lib/state-manager.ts`
- `src/lib/state-manager-db.ts`

**Git commit:**
```
fix: append tickets to end only, never reorder existing positions

BREAKING CHANGE: Random mode now shuffles new batch separately before
appending, rather than inserting throughout existing queue. This
prevents position changes after clients see their numbers.

- Replace insertAtRandomPositions with batch shuffle
- New tickets always append to end of queue
- Existing positions immutable in both modes
```

#### 2.2 Remove insertAtRandomPositions Helper
- [ ] Delete `insertAtRandomPositions()` function from both state managers
- [ ] Verify no other references exist

**Git commit:**
```
refactor: remove insertAtRandomPositions helper (no longer needed)
```

#### 2.3 Unit Tests
- [ ] Test random append shuffles new batch only
- [ ] Test random append preserves existing order
- [ ] Test sequential append keeps order
- [ ] Test multiple appends maintain immutability

**Test scenarios:**
```typescript
// Test: Random append preserves existing positions
// Initial: [1, 5, 3, 2, 4]
// Append: 6, 7, 8
// Result: [1, 5, 3, 2, 4, 8, 6, 7] (new batch shuffled, original untouched)

// Test: Sequential append maintains order
// Initial: [1, 5, 3, 2, 4]
// Append: 6, 7, 8
// Result: [1, 5, 3, 2, 4, 6, 7, 8]
```

**Git commit:**
```
test: add comprehensive tests for safe append behavior

- Test random mode shuffles new batch only
- Test existing positions never change
- Test sequential mode maintains order
```

#### 2.4 Documentation
- [ ] Update UX_REQUIREMENTS.md with implementation status
- [ ] Update CHANGELOG.md

**CHANGELOG.md entry:**
```markdown
## [0.3.0] - 2025-11-27

### Fixed
- **BREAKING:** Append now adds tickets to end only, never reorders existing
- Random mode shuffles new batch separately before appending
- Existing client positions remain immutable during appends

### Removed
- insertAtRandomPositions helper (replaced with safer batch logic)
```

**Git commit:**
```
docs: update append behavior documentation
```

### Success Criteria
- ✅ All unit tests pass
- ✅ Append in random mode preserves existing order
- ✅ Append in sequential mode works correctly
- ✅ Multiple appends maintain position integrity
- ✅ No insertAtRandomPositions references remain

---

## PHASE 3: Remove Dangerous Operations (Week 1, Day 5)

### Objective
Delete `rerandomize()` function and API endpoint entirely.

### Tasks

#### 3.1 Remove rerandomize from State Managers
- [ ] Delete `rerandomize()` from `state-manager.ts`
- [ ] Delete `rerandomize()` from `state-manager-db.ts`
- [ ] Delete `reshuffleUntilDifferent()` helper (only used by rerandomize)

**Files to modify:**
- `src/lib/state-manager.ts`
- `src/lib/state-manager-db.ts`

**Git commit:**
```
feat: remove rerandomize operation for client safety

BREAKING CHANGE: Removed rerandomize() function. This operation would
disrupt all client positions and break trust. No legitimate use case
exists after clients see their numbers.

- Delete rerandomize() from both state managers
- Delete reshuffleUntilDifferent() helper
```

#### 3.2 Remove rerandomize from API Route
- [ ] Remove `rerandomize` case from `actionSchema` in `api/state/route.ts`
- [ ] Remove `rerandomize` from switch statement

**Files to modify:**
- `src/app/api/state/route.ts`

**Git commit:**
```
feat: remove rerandomize API endpoint

- Remove rerandomize from action schema
- Remove rerandomize switch case
```

#### 3.3 Update TypeScript Types
- [ ] Verify type exports still work
- [ ] Check no broken imports

#### 3.4 Unit Tests
- [ ] Remove rerandomize tests
- [ ] Verify API tests still pass
- [ ] Test that rerandomize action returns error

**Git commit:**
```
test: remove rerandomize tests, verify API rejection
```

#### 3.5 Documentation
- [ ] Update CHANGELOG.md
- [ ] Note breaking change

**CHANGELOG.md entry:**
```markdown
## [0.4.0] - 2025-11-28

### Removed
- **BREAKING:** rerandomize() operation removed entirely
- Rerandomize API endpoint removed
- reshuffleUntilDifferent() helper removed

### Security
- Eliminates path for accidental position disruption
- No way to reshuffle after clients see numbers
```

**Git commit:**
```
docs: document removal of rerandomize operation
```

### Success Criteria
- ✅ No rerandomize code exists in codebase
- ✅ API returns error for rerandomize action
- ✅ All tests pass
- ✅ TypeScript compiles without errors
- ✅ Grep shows no rerandomize references

**Verification command:**
```bash
grep -r "rerandomize" src/
# Should return no results
```

---

## PHASE 4: UI Safety Enhancements (Week 2, Days 1-3)

### Objective
Update admin UI with disabled states, warnings, and confirmation dialogs.

### Tasks

#### 4.1 Disable Generate Button When Locked
- [ ] Check `state.orderLocked` in admin page
- [ ] Disable "Generate Order" button when locked
- [ ] Add tooltip explaining why disabled

**Files to modify:**
- `src/app/admin/page.tsx`

**Implementation:**
```typescript
<Button
  onClick={handleGenerate}
  disabled={state.orderLocked}
  title={state.orderLocked ? "Order locked. Use Reset to start new lottery." : "Generate random order"}
>
  Generate Order
</Button>
```

**Git commit:**
```
feat: disable Generate button when order locked

- Check orderLocked state
- Disable button with tooltip
- Prevents accidental regeneration attempts
```

#### 4.2 Add Lock Status Indicator
- [ ] Add Alert component showing locked state
- [ ] Display initial range that was locked
- [ ] Show current mode with explanation

**Implementation:**
```typescript
{state.orderLocked && (
  <Alert>
    <CheckCircle2 className="size-4" />
    <AlertTitle>Lottery Active</AlertTitle>
    <AlertDescription>
      Initial draw: tickets {state.startNumber}-{state.endNumber} (locked)
      <br />
      Current mode: {state.mode.toUpperCase()}
      {state.mode === "random" 
        ? " (new tickets randomized within batch)" 
        : " (new tickets added in order)"}
    </AlertDescription>
  </Alert>
)}
```

**Git commit:**
```
feat: add lottery active status indicator

- Show lock status with visual feedback
- Display locked range
- Explain current mode behavior
```

#### 4.3 Remove Rerandomize Button
- [ ] Delete Rerandomize button from admin page
- [ ] Remove associated handler function
- [ ] Clean up any related state

**Files to modify:**
- `src/app/admin/page.tsx`

**Git commit:**
```
feat: remove Rerandomize button from UI

- Delete button component
- Remove handler function
- No UI path for position disruption
```

#### 4.4 Add Reset Confirmation Dialog
- [ ] Wrap Reset button in ConfirmAction dialog
- [ ] Write strong warning message
- [ ] Use destructive variant
- [ ] Explain undo option

**Implementation:**
```typescript
<ConfirmAction
  title="Reset Lottery - DESTRUCTIVE ACTION"
  description="This will completely clear the current lottery and all client positions. Clients who have seen their numbers will lose their place. Only do this to start a new daily cycle. You can undo this action immediately after if needed."
  confirmText="Yes, Reset Lottery"
  onConfirm={handleReset}
  variant="destructive"
>
  <Button variant="destructive">Reset for New Day</Button>
</ConfirmAction>
```

**Git commit:**
```
feat: add confirmation dialog to Reset action

- Strong warning about client impact
- Mention undo safety net
- Prevent accidental resets
```

#### 4.5 Add Mode Explanation
- [ ] Add helper text under mode selector
- [ ] Clarify mode only affects new tickets
- [ ] Use muted text color

**Implementation:**
```typescript
<Label>Append Mode (affects new tickets only)</Label>
<RadioGroup value={mode} onValueChange={handleModeChange}>
  <Radio value="random">Random (10:50-11:15am)</Radio>
  <Radio value="sequential">Sequential (after 11:15am)</Radio>
</RadioGroup>
<p className="text-sm text-muted-foreground">
  Changing mode does not affect existing tickets in the queue
</p>
```

**Git commit:**
```
feat: add mode selector explanation text

- Clarify mode only affects future appends
- Reduce confusion about mode changes
```

#### 4.6 Manual Testing
- [ ] Test Generate button disabled when locked
- [ ] Test status indicator appears correctly
- [ ] Test Reset dialog shows and works
- [ ] Test mode selector explanation visible
- [ ] Verify no Rerandomize button exists

**Git commit:**
```
test: manual UI testing checklist completed
```

#### 4.7 Documentation
- [ ] Update CHANGELOG.md
- [ ] Screenshot UI for documentation (optional)

**CHANGELOG.md entry:**
```markdown
## [0.5.0] - 2025-12-01

### Added
- Lock status indicator in admin UI
- Reset confirmation dialog with strong warnings
- Mode selector explanation text
- Disabled state for Generate button when locked

### Removed
- Rerandomize button from admin interface

### Changed
- Generate button disabled with tooltip when order locked
```

**Git commit:**
```
docs: document Phase 4 UI safety enhancements
```

### Success Criteria
- ✅ Generate button disabled when order locked
- ✅ Status indicator shows locked state
- ✅ No Rerandomize button in UI
- ✅ Reset requires confirmation
- ✅ Mode explanation visible
- ✅ All UI interactions tested manually
- ✅ No console errors

---

## PHASE 5: Undo/Redo UI (Week 2, Days 4-5)

### Objective
Add prominent Undo/Redo buttons with visual feedback.

### Tasks

#### 5.1 Add Undo/Redo State Management
- [ ] Add `canUndo` state tracking
- [ ] Add `canRedo` state tracking
- [ ] Fetch snapshot count on load
- [ ] Update after each action

**Files to modify:**
- `src/app/admin/page.tsx`

**Implementation:**
```typescript
const [canUndo, setCanUndo] = useState(false);
const [canRedo, setCanRedo] = useState(false);

useEffect(() => {
  // Check if undo available (need 2+ snapshots)
  fetch('/api/state?action=listSnapshots')
    .then(r => r.json())
    .then(snapshots => {
      setCanUndo(snapshots.length >= 2);
    });
}, [state]);
```

**Git commit:**
```
feat: add undo/redo state tracking

- Track canUndo/canRedo availability
- Update after state changes
```

#### 5.2 Create Undo/Redo Button Group
- [ ] Add Undo button with icon
- [ ] Add Redo button with icon
- [ ] Add History button for dialog
- [ ] Disable when not available
- [ ] Add tooltips

**Implementation:**
```typescript
<div className="flex gap-2">
  <Button
    onClick={handleUndo}
    disabled={!canUndo}
    variant="outline"
    title="Undo last action"
  >
    <Undo2 className="size-4" />
    Undo
  </Button>
  
  <Button
    onClick={handleRedo}
    disabled={!canRedo}
    variant="outline"
    title="Redo last undone action"
  >
    <Redo2 className="size-4" />
    Redo
  </Button>
  
  <Button
    onClick={() => setHistoryOpen(true)}
    variant="ghost"
    title="View full history"
  >
    <History className="size-4" />
    History
  </Button>
</div>
```

**Git commit:**
```
feat: add Undo/Redo/History button group

- Undo button with Undo2 icon
- Redo button with Redo2 icon
- History button opens snapshot dialog
- Proper disabled states
```

#### 5.3 Implement Undo Handler
- [ ] Call `/api/state` with undo action
- [ ] Update local state
- [ ] Show success feedback
- [ ] Handle errors gracefully

**Implementation:**
```typescript
const handleUndo = async () => {
  try {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'undo' }),
    });
    
    if (!response.ok) throw new Error('Undo failed');
    
    const newState = await response.json();
    setState(newState);
    setCanRedo(true);
    
    toast.success('Action undone successfully');
  } catch (error) {
    toast.error('Undo failed: ' + error.message);
  }
};
```

**Git commit:**
```
feat: implement undo handler with error handling

- Call undo API endpoint
- Update state on success
- Show toast notifications
- Handle errors gracefully
```

#### 5.4 Implement Redo Handler
- [ ] Similar to undo handler
- [ ] Enable redo after undo
- [ ] Disable after new action

**Git commit:**
```
feat: implement redo handler

- Call redo API endpoint
- Update state on success
- Handle errors gracefully
```

#### 5.5 Create Snapshot History Dialog
- [ ] Create Dialog component
- [ ] List snapshots with timestamps
- [ ] Show ticket ranges
- [ ] Show serving position if set
- [ ] Add Restore button per snapshot
- [ ] Add confirmation for restore

**Implementation:**
```typescript
<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>State History</DialogTitle>
      <DialogDescription>
        View and restore from any previous state
      </DialogDescription>
    </DialogHeader>
    
    <ScrollArea className="h-96">
      {snapshots.map((snapshot) => (
        <div key={snapshot.id} className="flex justify-between p-2 border-b">
          <div>
            <div className="font-medium">
              {new Date(snapshot.timestamp).toLocaleString()}
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

**Git commit:**
```
feat: add snapshot history dialog

- Show all snapshots with timestamps
- Display ticket ranges and serving position
- Add restore functionality
- Scrollable list for long history
```

#### 5.6 Add Visual Feedback Toast
- [ ] Install/verify toast library (likely shadcn toast)
- [ ] Show success message after undo
- [ ] Show success message after redo
- [ ] Show error messages

**Git commit:**
```
feat: add toast notifications for undo/redo actions

- Success feedback after undo
- Success feedback after redo
- Error messages on failure
```

#### 5.7 Manual Testing
- [ ] Test undo after generate
- [ ] Test undo after append
- [ ] Test undo after set serving
- [ ] Test redo after undo
- [ ] Test redo disabled after new action
- [ ] Test history dialog opens and lists snapshots
- [ ] Test restore from history
- [ ] Test buttons disabled appropriately

**Git commit:**
```
test: manual undo/redo testing completed
```

#### 5.8 Documentation
- [ ] Update CHANGELOG.md
- [ ] Add user guide section

**CHANGELOG.md entry:**
```markdown
## [0.6.0] - 2025-12-02

### Added
- Undo button for immediate error recovery
- Redo button for reversing undo actions
- Snapshot history dialog for manual restoration
- Visual feedback toasts for undo/redo operations
- SCRAM-button safety mechanism complete
```

**Git commit:**
```
docs: document undo/redo UI implementation
```

### Success Criteria
- ✅ Undo button works correctly
- ✅ Redo button works correctly
- ✅ History dialog shows all snapshots
- ✅ Restore from history works
- ✅ Toast notifications appear
- ✅ All error scenarios handled
- ✅ Manual testing complete

---

## PHASE 6: Database Migration Preparation (Week 3, Days 1-3)

### Objective
Prepare for production Postgres deployment, eliminate file system dependencies.

### Tasks

#### 6.1 Deploy Neon Database Schema
- [ ] Log into Neon console
- [ ] Create raffle_state table
- [ ] Create raffle_snapshots table
- [ ] Add indexes for performance
- [ ] Verify JSONB support

**SQL Script:**
```sql
-- Main state table
CREATE TABLE IF NOT EXISTS raffle_state (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Snapshot history
CREATE TABLE IF NOT EXISTS raffle_snapshots (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS raffle_snapshots_created_at_idx 
  ON raffle_snapshots(created_at DESC);

CREATE INDEX IF NOT EXISTS raffle_snapshots_id_idx 
  ON raffle_snapshots(id);

-- NextAuth tables (from DEPLOYMENT_MIGRATION.md)
CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS verification_token_identifier_idx 
  ON verification_token(identifier);
CREATE INDEX IF NOT EXISTS accounts_userId_idx 
  ON accounts("userId");
CREATE INDEX IF NOT EXISTS sessions_userId_idx 
  ON sessions("userId");
CREATE INDEX IF NOT EXISTS sessions_sessionToken_idx 
  ON sessions("sessionToken");
```

**Documentation:**
- [ ] Save schema as `/Users/russbook/lotto/schema.sql`

**Git commit:**
```
chore: add Neon database schema file

- Raffle state and snapshot tables
- NextAuth authentication tables
- Performance indexes
```

#### 6.2 Test Database State Manager in Docker
- [ ] Update `.env.local` with `USE_DATABASE=true`
- [ ] Add local Postgres connection in Docker
- [ ] Test all state operations work
- [ ] Verify snapshots persist
- [ ] Test undo/redo with DB

**Docker test checklist:**
- [ ] `docker compose down && docker compose up --build`
- [ ] Generate order → Check DB for state
- [ ] Append tickets → Check snapshots table
- [ ] Undo → Verify restore works
- [ ] Check snapshot count in DB
- [ ] Verify no file writes to /data

**Git commit:**
```
test: verify database state manager in Docker

- All operations tested with Postgres
- Snapshots persisting correctly
- Undo/redo working with DB
```

#### 6.3 Simplify Database URL Handling
- [ ] Update auth.ts to use DATABASE_URL only
- [ ] Remove fallback complexity
- [ ] Add clear error if missing
- [ ] Document required env vars

**Files to modify:**
- `src/lib/auth.ts`

**Simplified approach:**
```typescript
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for authentication. ' +
    'Set this environment variable to your Neon connection string.'
  );
}

const adapter = PostgresAdapter(new Pool({ connectionString: databaseUrl }));
```

**Git commit:**
```
refactor: simplify database URL handling

- Use DATABASE_URL exclusively
- Remove fallback chain complexity
- Fail fast with clear error message
```

#### 6.4 Remove File-Based State Manager Fallback
- [ ] Update state-manager.ts export logic
- [ ] Require DATABASE_URL in production
- [ ] Keep file manager for local dev only
- [ ] Add environment detection

**Implementation:**
```typescript
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

if (isProduction && !databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for production deployment. ' +
    'Vercel does not support file system storage.'
  );
}

export const stateManager = databaseUrl
  ? createDbStateManager()
  : createStateManager(); // Local dev only

export const storageMode = databaseUrl ? "database" : "file";
```

**Git commit:**
```
feat: require DATABASE_URL for production

- Fail fast if DATABASE_URL missing in production
- Keep file fallback for local dev only
- Prevent Vercel deployment without DB
```

#### 6.5 Update Environment Variable Documentation
- [ ] Document minimal required vars for Vercel
- [ ] Create .env.production.example
- [ ] Update DEPLOYMENT_MIGRATION.md

**Create `.env.production.example`:**
```bash
# Required for Vercel Production
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
RESEND_API_KEY=re_xxxxxxxxxx
EMAIL_FROM=noreply@williamtemple.app
ADMIN_EMAIL_DOMAIN=williamtemple.org

# Configuration
USE_DATABASE=true
AUTH_TRUST_HOST=true
NODE_ENV=production
```

**Git commit:**
```
docs: add production environment variable template

- Minimal required vars for Vercel
- Clear documentation for deployment
```

#### 6.6 Documentation
- [ ] Update DEPLOYMENT_MIGRATION.md with Phase 6 completion
- [ ] Update CHANGELOG.md

**CHANGELOG.md entry:**
```markdown
## [0.7.0] - 2025-12-04

### Changed
- **BREAKING:** DATABASE_URL now required for production
- Simplified database connection handling
- File-based storage only available in development

### Added
- Complete Neon database schema
- Production environment variable template
- Database migration testing procedures
```

**Git commit:**
```
docs: document database migration preparation
```

### Success Criteria
- ✅ Neon schema deployed
- ✅ All tables created
- ✅ Indexes verified
- ✅ Docker tests pass with DATABASE_URL
- ✅ State operations work via Postgres
- ✅ Snapshots persisting correctly
- ✅ Undo/redo works with DB
- ✅ Production env vars documented

---

## PHASE 7: Production Deployment (Week 3-4)

### Objective
Deploy hardened system to Vercel production.

### Tasks

#### 7.1 Pre-Deployment Checklist
- [ ] All previous phases complete
- [ ] All unit tests passing
- [ ] Docker build succeeds
- [ ] No TypeScript errors
- [ ] CHANGELOG.md up to date
- [ ] Documentation complete

**Git commit:**
```
chore: pre-deployment checklist completed
```

#### 7.2 Configure Vercel Environment Variables
- [ ] Set DATABASE_URL (from Neon)
- [ ] Set AUTH_SECRET (generate new)
- [ ] Set RESEND_API_KEY
- [ ] Set EMAIL_FROM
- [ ] Set ADMIN_EMAIL_DOMAIN=williamtemple.org
- [ ] Set USE_DATABASE=true
- [ ] Set AUTH_TRUST_HOST=true

**Verification:**
- [ ] Screenshot of Vercel env vars (redacted)
- [ ] Document in deployment log

#### 7.3 Test Resend Email Configuration
- [ ] Verify Resend domain DNS (williamtemple.app)
- [ ] Check SPF/DKIM records
- [ ] Send test magic link
- [ ] Verify email delivery
- [ ] Check spam folder

**Documentation:**
- [ ] Note any IT department coordination needed

**Git commit:**
```
test: verify Resend email configuration

- DNS records validated
- Test emails delivered successfully
```

#### 7.4 Deploy to Vercel Staging (Preview)
- [ ] Push to feature branch
- [ ] Vercel creates preview deployment
- [ ] Test all functionality in preview
- [ ] Verify database connection
- [ ] Test magic link auth
- [ ] Test state operations
- [ ] Test undo/redo

**Testing checklist:**
- [ ] Homepage loads
- [ ] Login page works
- [ ] Magic link received and works
- [ ] Admin page loads after auth
- [ ] Generate order works
- [ ] Append tickets works
- [ ] Mode switch works
- [ ] Undo/Redo works
- [ ] Display page shows correctly
- [ ] QR code displays

**Git commit:**
```
test: staging deployment verification complete
```

#### 7.5 Merge to Main and Deploy Production
- [ ] Create PR from feature branch
- [ ] Review all changes
- [ ] Merge to main
- [ ] Vercel auto-deploys production
- [ ] Monitor deployment logs

**Git commit (merge):**
```
release: v1.0.0 - Safety-hardened production deployment

- Order locking prevents position changes
- Safe append logic (batch randomization)
- Rerandomize removed for client safety
- Undo/Redo SCRAM button system
- 100% Postgres data persistence
- Production-ready authentication

See CHANGELOG.md for full release notes
```

#### 7.6 Post-Deployment Verification
- [ ] Production URL loads: https://lottowth.vercel.app
- [ ] Custom domain works: https://williamtemple.app (if configured)
- [ ] Login flow works
- [ ] Generate initial order
- [ ] Append batch in random mode
- [ ] Verify existing positions unchanged
- [ ] Switch to sequential mode
- [ ] Append in sequential mode
- [ ] Test undo operation
- [ ] Test redo operation
- [ ] Display page updates correctly
- [ ] QR code scannable

**Git commit:**
```
test: production deployment verified

- All critical paths tested
- No errors in Vercel logs
- Client-facing features working
```

#### 7.7 Staff Training
- [ ] Schedule training session
- [ ] Demonstrate new workflow
- [ ] Explain lock safety features
- [ ] Show undo/redo functionality
- [ ] Walk through daily cycle
- [ ] Provide quick reference guide

**Deliverable:**
- [ ] Create STAFF_QUICKSTART.md guide

#### 7.8 Monitor First Production Day
- [ ] Be available during first service day
- [ ] Monitor Vercel logs
- [ ] Check database connection stability
- [ ] Verify snapshot creation
- [ ] Collect staff feedback
- [ ] Document any issues

#### 7.9 Final Documentation
- [ ] Update README.md with v1.0.0 status
- [ ] Complete CHANGELOG.md
- [ ] Tag release in Git
- [ ] Close implementation issues

**CHANGELOG.md final entry:**
```markdown
## [1.0.0] - 2025-12-08

### Production Release

Complete safety-hardened raffle system deployed to production.

#### Major Features
- Order locking prevents position changes after initial draw
- Safe batch append logic (random/sequential modes)
- Undo/Redo SCRAM button for error recovery
- 100% Postgres persistence (Neon)
- Magic link authentication restricted to @williamtemple.org
- Comprehensive snapshot history (22+ years retention)

#### Security Improvements
- Removed rerandomize operation entirely
- Generation guard prevents accidental regeneration
- Reset requires confirmation dialog
- Server-side route protection

#### User Experience
- Clear locked state indicators
- Disabled buttons with explanatory tooltips
- Mode selector with behavior explanation
- Visual feedback for all operations
- Snapshot history dialog for manual recovery

### Breaking Changes
- Database required for production (no file storage)
- Rerandomize API endpoint removed
- Random append behavior changed (batch-only shuffle)

### Migration Guide
See DEPLOYMENT_MIGRATION.md for upgrade instructions.

### Contributors
- Claude (AI Assistant) - Architecture & implementation guidance
- Codex (AI Assistant) - Code implementation
- Geiger - Project owner & requirements
```

**Git commands:**
```bash
git tag -a v1.0.0 -m "Safety-hardened production release"
git push origin v1.0.0
```

### Success Criteria
- ✅ Vercel deployment successful
- ✅ Database connected and working
- ✅ Authentication functioning
- ✅ All state operations tested in production
- ✅ Undo/redo verified in production
- ✅ Display page showing correctly
- ✅ Staff trained on new system
- ✅ First service day successful
- ✅ Documentation complete
- ✅ Release tagged in Git

---

## Key Milestones

### Milestone 1: Safety Foundation (End of Phase 3)
**Date:** Week 1 completion  
**Deliverables:**
- orderLocked field implemented
- Generation guard active
- Append logic corrected
- Rerandomize removed

**Success Metric:** Impossible to disrupt client positions after initial draw

---

### Milestone 2: UI Safety Complete (End of Phase 5)
**Date:** Week 2 completion  
**Deliverables:**
- All dangerous buttons removed/disabled
- Confirmation dialogs implemented
- Undo/Redo buttons functional
- History dialog working

**Success Metric:** Staff cannot accidentally disrupt order through UI

---

### Milestone 3: Production Ready (End of Phase 6)
**Date:** Week 3 completion  
**Deliverables:**
- Database schema deployed
- File dependencies eliminated
- Docker tests passing with Postgres
- Environment variables documented

**Success Metric:** System deployable to Vercel with full functionality

---

### Milestone 4: Live Production (End of Phase 7)
**Date:** Week 3-4 completion  
**Deliverables:**
- Vercel production deployment
- Staff trained
- First service day completed
- v1.0.0 tagged

**Success Metric:** System serving real clients safely

---

## Testing Strategy

### Unit Tests
**Location:** `src/lib/*.test.ts`

**Coverage Requirements:**
- State manager operations: 100%
- Guard logic: 100%
- Append logic: 100%
- Undo/redo: 100%

**Run command:**
```bash
npm test
```

### Integration Tests
**Location:** Manual testing checklists in each phase

**Focus Areas:**
- UI interactions
- API endpoints
- Database persistence
- Error handling

### End-to-End Tests
**Phase 7 production verification checklist**

**Scenarios:**
1. Full daily workflow (generate → append → switch mode → append)
2. Error recovery (undo after each operation type)
3. Reset and restart
4. Multi-user concurrent access (if applicable)

---

## Git Commit Conventions

### Commit Types
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `test:` - Adding or updating tests
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `release:` - Version release

### Commit Message Format
```
<type>: <short description>

<optional detailed description>

<optional breaking change notice>
```

### Examples
```bash
# Good
feat: add orderLocked field to RaffleState

# Good with detail
fix: append tickets to end only, never reorder existing

BREAKING CHANGE: Random mode now shuffles new batch separately
before appending, rather than inserting throughout existing queue.

# Good for docs
docs: document undo/redo UI implementation
```

---

## CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

### Sections
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements

### Version Format
```markdown
## [Version] - YYYY-MM-DD

### Added
- Feature description

### Changed
- Change description

### Breaking Changes
- Breaking change with migration notes
```

---

## Risk Management

### High-Risk Changes
1. **Append logic modification** (Phase 2)
   - Risk: Could still reorder positions if done wrong
   - Mitigation: Comprehensive unit tests before deployment
   - Rollback: Revert to previous append logic if tests fail

2. **Database migration** (Phase 6)
   - Risk: Data loss if migration fails
   - Mitigation: Test thoroughly in Docker first
   - Rollback: Keep file-based fallback for emergency

3. **Production deployment** (Phase 7)
   - Risk: Auth failure blocks staff access
   - Mitigation: Test Resend thoroughly in staging
   - Rollback: Keep Vercel previous deployment available

### Rollback Procedures
**Phase 1-5 rollbacks:**
```bash
git revert <commit-hash>
git push origin main
# Vercel auto-deploys previous state
```

**Phase 6-7 rollbacks:**
1. Vercel dashboard → Deployments → Promote previous deployment
2. Or: `git revert` and push
3. Database rollback not needed (snapshots preserved)

---

## Communication Plan

### Stakeholders
- **Staff** - Daily operators
- **Geiger** - Project owner
- **IT Department** - Email allowlist coordination

### Updates
**Weekly progress reports:**
- Phases completed
- Tests passed
- Blockers identified
- Next week's focus

**Pre-deployment communication:**
- Email to staff 2 days before deployment
- Training session scheduled
- Quick reference guide provided

**Post-deployment:**
- Success/issues report within 24 hours
- Collect feedback from first week
- Document lessons learned

---

## Success Metrics

### Technical Metrics
- Zero position changes after initial display: **100% success rate**
- Undo operations succeed: **100% success rate**
- Database snapshots persist: **100% reliability**
- API response times: **<500ms for all operations**

### Operational Metrics
- Staff training completion: **100% of operators**
- Accidental resets during service: **0 incidents**
- Undo usage frequency: **Track for first month**
- Staff confidence rating: **8+/10**

### Client Impact Metrics
- Position disputes: **<1 per week (target)**
- Client complaints about order: **<1 per week (target)**
- Trust in system: **Staff assessment after 2 weeks**

---

## Contingency Plans

### If Phase 1-2 Tests Fail
- Halt deployment
- Review logic errors
- Add more granular tests
- Retest until 100% pass

### If Phase 6 Database Migration Fails
- Stay on file-based storage temporarily
- Investigate Neon connection issues
- Verify schema correctness
- Test with fresh database

### If Phase 7 Production Deployment Fails
- Promote previous Vercel deployment
- Investigate logs
- Fix issues in staging
- Redeploy when verified

### If First Production Day Has Issues
- Have Geiger available for rapid support
- Use undo button immediately for errors
- Document all issues
- Plan hotfix deployment if critical

---

## Post-Release Activities

### Week 1 After Release
- [ ] Monitor Vercel logs daily
- [ ] Check database size growth
- [ ] Collect staff feedback
- [ ] Fix any minor issues

### Week 2-4 After Release
- [ ] Analyze undo/redo usage patterns
- [ ] Review snapshot retention
- [ ] Optimize if needed
- [ ] Plan future enhancements

### Future Enhancements (v1.1+)
- Mobile-optimized admin interface
- Analytics dashboard
- Automated daily reset
- SMS notifications for clients
- Multi-language display support

---

## Document Control

**Version:** 1.0  
**Created:** 2025-11-25  
**Last Updated:** 2025-11-25  
**Authors:** Claude, Geiger  
**Status:** Active Implementation Plan

**Review Schedule:**
- Review weekly during implementation
- Update after each phase completion
- Final review before Phase 7

**Approval:**
- [ ] Geiger (Project Owner) - Approved

---

## Quick Reference

### Phase Order
1. **Core Safety Model** (2 days) - Add locks
2. **Fix Append Logic** (2 days) - Correct position handling
3. **Remove Dangerous Ops** (1 day) - Delete rerandomize
4. **UI Safety** (3 days) - Buttons, dialogs, warnings
5. **Undo/Redo UI** (2 days) - SCRAM button
6. **Database Migration** (3 days) - Postgres prep
7. **Production Deploy** (Variable) - Go live

### Critical Commands
```bash
# Run tests
npm test

# Build
npm run build

# Docker test
docker compose down && docker compose up --build

# Check for rerandomize
grep -r "rerandomize" src/

# Git tag
git tag -a v1.0.0 -m "Production release"
```

### Critical Files
- `src/lib/state-types.ts` - State model
- `src/lib/state-manager.ts` - File manager (dev)
- `src/lib/state-manager-db.ts` - Database manager (prod)
- `src/app/admin/page.tsx` - Admin UI
- `src/app/api/state/route.ts` - State API
- `docs/UX_REQUIREMENTS.md` - Requirements
- `docs/DEPLOYMENT_MIGRATION.md` - Deployment guide
- `CHANGELOG.md` - Release notes
