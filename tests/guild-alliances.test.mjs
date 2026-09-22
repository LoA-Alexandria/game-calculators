import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptedAlliance,
  alliancePartnerId,
  allianceSide,
  canAnswerAlliance,
  offerableGuilds,
  openOffers,
} from "../lib/content/guild-alliances.ts";

const OURS = "guild-a";
const THEIRS = "guild-b";
const THIRD = "guild-c";

function row(overrides = {}) {
  return {
    id: "alliance-1",
    event_id: "trials-of-odin",
    from_guild_id: OURS,
    to_guild_id: THEIRS,
    status: "pending",
    note: "",
    created_at: "2026-09-22T10:00:00Z",
    ...overrides,
  };
}

describe("guild alliance helpers", () => {
  it("tells an offer we sent from one we received", () => {
    assert.equal(allianceSide(row(), OURS), "outgoing");
    assert.equal(allianceSide(row(), THEIRS), "incoming");
  });

  it("names the other guild in the pair", () => {
    assert.equal(alliancePartnerId(row(), OURS), THEIRS);
    assert.equal(alliancePartnerId(row(), THEIRS), OURS);
  });

  it("finds only an accepted alliance for the shared board", () => {
    assert.equal(acceptedAlliance([row()], OURS), null);
    const live = row({ status: "accepted" });
    assert.equal(acceptedAlliance([row({ id: "old", status: "declined" }), live], OURS), live);
  });

  it("lists open offers newest first", () => {
    const older = row({ id: "older", created_at: "2026-09-20T10:00:00Z" });
    const newer = row({ id: "newer", from_guild_id: THIRD, to_guild_id: OURS });
    const offers = openOffers([older, newer, row({ id: "done", status: "accepted" })], OURS);
    assert.deepEqual(offers.map((entry) => entry.id), ["newer", "older"]);
  });

  it("lets only the invited guild answer, and only while pending", () => {
    assert.equal(canAnswerAlliance(row(), THEIRS), true);
    assert.equal(canAnswerAlliance(row(), OURS), false);
    assert.equal(canAnswerAlliance(row({ status: "accepted" }), THEIRS), false);
  });

  it("offers only guilds that are neither us nor already in a live pair", () => {
    const guilds = [{ id: OURS }, { id: THEIRS }, { id: THIRD }];
    assert.deepEqual(offerableGuilds(guilds, OURS, [row()]).map((g) => g.id), [THIRD]);
    // A declined offer frees the pair again.
    assert.deepEqual(
      offerableGuilds(guilds, OURS, [row({ status: "declined" })]).map((g) => g.id),
      [THEIRS, THIRD],
    );
  });
});
