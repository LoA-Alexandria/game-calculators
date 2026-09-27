import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guildRoomPowers } from "../lib/content/guilds.ts";

const standing = (over = {}) => ({
  frozen: false,
  isMaster: false,
  isSiteAdmin: false,
  membershipStatus: "active",
  membershipRole: "member",
  ...over,
});

describe("what a frozen guild still allows", () => {
  it("keeps every reader", () => {
    assert.equal(guildRoomPowers(standing({ frozen: true })).canEnter, true);
    assert.equal(guildRoomPowers(standing({ frozen: true, isMaster: true })).canEnter, true);
  });

  it("loses every writer, master and officer alike", () => {
    const master = guildRoomPowers(standing({ frozen: true, isMaster: true }));
    assert.equal(master.canOfficer, false);
    assert.equal(master.canManageSettings, false);

    const officer = guildRoomPowers(standing({ frozen: true, membershipRole: "officer" }));
    assert.equal(officer.canOfficer, false);
  });

  it("does not take a site admin's tools away", () => {
    // The admin is how a frozen guild gets unstuck, so the UI keeps their
    // panels; the trigger lets their writes through as well.
    const admin = guildRoomPowers(standing({ frozen: true, isSiteAdmin: true }));
    assert.equal(admin.canEnter, true);
    assert.equal(admin.canManageSettings, false);
  });

  it("still lets a member walk out", () => {
    assert.equal(guildRoomPowers(standing({ frozen: true })).canLeave, true);
  });
});

describe("who may do what in a running guild", () => {
  it("gives the master and a site admin the settings", () => {
    assert.equal(guildRoomPowers(standing({ isMaster: true })).canManageSettings, true);
    assert.equal(guildRoomPowers(standing({ isSiteAdmin: true, membershipStatus: null })).canManageSettings, true);
  });

  it("gives an officer the officer tools but not the settings", () => {
    const officer = guildRoomPowers(standing({ membershipRole: "officer" }));
    assert.equal(officer.canOfficer, true);
    assert.equal(officer.canManageSettings, false);
  });

  it("gives a plain member neither", () => {
    const member = guildRoomPowers(standing());
    assert.equal(member.canOfficer, false);
    assert.equal(member.canManageSettings, false);
    assert.equal(member.canLeave, true);
  });

  it("keeps an applicant and an outsider out", () => {
    assert.equal(guildRoomPowers(standing({ membershipStatus: "pending" })).canEnter, false);
    assert.equal(guildRoomPowers(standing({ membershipStatus: null, membershipRole: null })).canEnter, false);
  });

  it("never offers the master a way to leave their own guild", () => {
    assert.equal(guildRoomPowers(standing({ isMaster: true })).canLeave, false);
  });

  it("offers nothing to leave when there is no membership", () => {
    assert.equal(guildRoomPowers(standing({ membershipStatus: "rejected" })).canLeave, false);
    assert.equal(guildRoomPowers(standing({ isSiteAdmin: true, membershipStatus: null })).canLeave, false);
  });
});
