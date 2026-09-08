// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

export const POLLED_STATE_REVISION_HEADER = "x-lotto-state-revision";

export const readPolledStateRevision = (
  headers: Pick<Headers, "get">,
): number | null => {
  const raw = headers.get(POLLED_STATE_REVISION_HEADER)?.trim();
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) ? revision : null;
};
