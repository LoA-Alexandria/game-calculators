"use client";

import { useEffect, useId, useState } from "react";
import {
  isDiscordUserId,
  isGuildSlug,
  suggestGuildSlug,
  type Guild,
} from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { isRole, PERMISSIONS, ROLES, ROLE_PERMISSIONS, type Role } from "../../lib/auth/roles";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PermissionGate } from "../components/SignInGate";
import { PageHead } from "../components/Ui";
import { InfoIcon, PlusIcon, TrashIcon } from "../components/Icons";

type Mapping = { id: string; discord_role_id: string; discord_role_name: string; role: Role };
type Member = { user_id: string; discord_user_id: string; role: Role | null; checked_at: string | null };

export default function AdminPage() {
  const { t } = useLocale();
  useDocumentTitle(t.admin.title);
  return (
    <PermissionGate permission="roles.assign">
      <AdminPanel />
    </PermissionGate>
  );
}

function AdminPanel() {
  const { t, d } = useLocale();
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [role, setRole] = useState<Role>("guide_writer");

  const [guildName, setGuildName] = useState("");
  const [guildSlug, setGuildSlug] = useState("");
  const [guildDescription, setGuildDescription] = useState("");
  const [guildMasterId, setGuildMasterId] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  /**
   * Tables are read here rather than in a helper the effect calls, so the
   * state updates sit plainly inside an async continuation. `gone` guards them:
   * without it a quick unmount lands a setState on a component that is no
   * longer mounted. A write bumps `reloadToken` to fetch again.
   */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const [mapped, team, roster] = await Promise.all([
        supabase.from("role_mappings").select("id, discord_role_id, discord_role_name, role").order("role"),
        supabase.from("editor_access").select("user_id, discord_user_id, role, checked_at").order("checked_at", { ascending: false }),
        supabase.from("guilds").select("id, slug, name, description, master_discord_user_id, created_at").order("name"),
      ]);
      if (gone) return;
      if (mapped.error) setError(mapped.error.message);
      else setMappings((mapped.data ?? []) as Mapping[]);
      if (team.error) setError(team.error.message);
      else setMembers((team.data ?? []) as Member[]);
      if (roster.error) setError(roster.error.message);
      else setGuilds((roster.data ?? []) as Guild[]);
    })();
    return () => { gone = true; };
  }, [supabase, reloadToken]);

  const reload = () => setReloadToken((value) => value + 1);

  const add = async () => {
    if (!supabase || !name.trim() || !discordId.trim()) return;
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase.from("role_mappings").insert({
      discord_role_name: name.trim(),
      discord_role_id: discordId.trim(),
      role,
    });
    // The database decides, not the interface: a non-admin gets rejected here
    // even though the form is on screen.
    if (insertError) setError(insertError.message);
    else { setName(""); setDiscordId(""); reload(); }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase.from("role_mappings").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else reload();
    setBusy(false);
  };

  const addGuild = async () => {
    if (!supabase || !session) return;
    const slug = guildSlug.trim().toLowerCase();
    const master = guildMasterId.trim();
    if (!guildName.trim() || !isGuildSlug(slug) || !isDiscordUserId(master)) {
      setError("Guild name, slug, and master Discord ID must be valid.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase.from("guilds").insert({
      name: guildName.trim(),
      slug,
      description: guildDescription.trim(),
      master_discord_user_id: master,
      created_by: session.userId,
    });
    if (insertError) setError(insertError.message);
    else {
      setGuildName("");
      setGuildSlug("");
      setGuildDescription("");
      setGuildMasterId("");
      setSlugTouched(false);
      reload();
    }
    setBusy(false);
  };

  const removeGuild = async (id: string) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase.from("guilds").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else reload();
    setBusy(false);
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <PageHead eyebrow={t.nav.admin} title={t.admin.title} lede={t.admin.lede} />
        </div>
        {session && (
          <div className="session-chip">
            <span className="who">
              <b>{session.name}</b>
              <span>{t.auth.signedInAs} · {session.role}</span>
            </span>
          </div>
        )}
      </div>

      {error && <p className="result-error" role="alert">{error}</p>}

      <section className="panel">
        <h2>{t.admin.guildsTitle}</h2>
        <p>{t.admin.guildsLede}</p>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.admin.guildsName}</th>
                <th>{t.admin.guildsSlug}</th>
                <th>{t.admin.guildsMasterId}</th>
                <th>{t.admin.guildsCreated}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {guilds.length === 0 && (
                <tr><td colSpan={5}>{t.admin.guildsEmpty}</td></tr>
              )}
              {guilds.map((guild) => (
                <tr key={guild.id}>
                  <td data-label={t.admin.guildsName}>{guild.name}</td>
                  <td data-label={t.admin.guildsSlug} className="mono">{guild.slug}</td>
                  <td data-label={t.admin.guildsMasterId} className="mono">{guild.master_discord_user_id}</td>
                  <td data-label={t.admin.guildsCreated} className="mono">
                    {d(guild.created_at.slice(0, 10))}
                  </td>
                  <td className="actions">
                    <button
                      className="small-button button-danger"
                      type="button"
                      disabled={busy}
                      aria-label={`${t.admin.guildsRemove}: ${guild.name}`}
                      onClick={() => void removeGuild(guild.id)}
                    >
                      <TrashIcon className="icon icon-sm" />
                      {t.admin.guildsRemove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <fieldset disabled={busy}>
          <legend>{t.admin.guildsAdd}</legend>
          <div className="guild-form">
            <div className="field">
              <label htmlFor={`${ids}-gname`}>{t.admin.guildsName}</label>
              <input
                id={`${ids}-gname`}
                value={guildName}
                onChange={(e) => {
                  const next = e.target.value;
                  setGuildName(next);
                  if (!slugTouched) setGuildSlug(suggestGuildSlug(next));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-gslug`}>{t.admin.guildsSlug}</label>
              <input
                id={`${ids}-gslug`}
                value={guildSlug}
                className="mono"
                onChange={(e) => {
                  setSlugTouched(true);
                  setGuildSlug(e.target.value.toLowerCase());
                }}
              />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-gmaster`}>{t.admin.guildsMasterId}</label>
              <input
                id={`${ids}-gmaster`}
                value={guildMasterId}
                inputMode="numeric"
                className="mono"
                placeholder="1534890988588498944"
                onChange={(e) => setGuildMasterId(e.target.value)}
              />
            </div>
            <div className="field guild-form-desc">
              <label htmlFor={`${ids}-gdesc`}>{t.admin.guildsDescription}</label>
              <input
                id={`${ids}-gdesc`}
                value={guildDescription}
                maxLength={500}
                onChange={(e) => setGuildDescription(e.target.value)}
              />
            </div>
            <button className="button button-primary" type="button" onClick={() => void addGuild()}>
              <PlusIcon className="icon" />
              {t.admin.guildsAdd}
            </button>
          </div>
          <p className="assumption">{t.admin.guildsSlugNote}</p>
          <p className="assumption">{t.admin.guildsMasterIdNote}</p>
        </fieldset>
      </section>

      <section className="panel">
        <h2>{t.admin.mappingTitle}</h2>
        <p>{t.admin.mappingLede}</p>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.admin.mappingRoleName}</th>
                <th>{t.admin.mappingRoleId}</th>
                <th>{t.admin.mappingSiteRole}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 && (
                <tr><td colSpan={4}>{t.admin.mappingEmpty}</td></tr>
              )}
              {mappings.map((entry) => (
                <tr key={entry.id}>
                  <td data-label={t.admin.mappingRoleName}>{entry.discord_role_name}</td>
                  <td data-label={t.admin.mappingRoleId} className="mono">{entry.discord_role_id}</td>
                  <td data-label={t.admin.mappingSiteRole}>
                    <span className={`role-badge role-${entry.role}`}>{entry.role}</span>
                  </td>
                  <td className="actions">
                    <button
                      className="small-button button-danger"
                      type="button"
                      disabled={busy}
                      aria-label={`${t.admin.mappingRemove}: ${entry.discord_role_name}`}
                      onClick={() => void remove(entry.id)}
                    >
                      <TrashIcon className="icon icon-sm" />
                      {t.admin.mappingRemove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <fieldset disabled={busy}>
          <legend>{t.admin.mappingAdd}</legend>
          <div className="mapping-form">
            <div className="field">
              <label htmlFor={`${ids}-name`}>{t.admin.mappingRoleName}</label>
              <input id={`${ids}-name`} value={name} placeholder="Guide Team" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-id`}>{t.admin.mappingRoleId}</label>
              <input id={`${ids}-id`} value={discordId} inputMode="numeric" placeholder="1534890988588498944" onChange={(e) => setDiscordId(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-role`}>{t.admin.mappingSiteRole}</label>
              <select id={`${ids}-role`} value={role} onChange={(e) => { if (isRole(e.target.value)) setRole(e.target.value); }}>
                {ROLES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <button className="button button-primary" type="button" onClick={() => void add()}>
              <PlusIcon className="icon" />
              {t.admin.mappingAdd}
            </button>
          </div>
          <p className="assumption">{t.admin.mappingIdNote}</p>
        </fieldset>
      </section>

      <section className="panel">
        <h2>{t.admin.teamTitle}</h2>
        <p>{t.admin.teamLede}</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.admin.teamDiscord}</th>
                <th>{t.admin.teamRole}</th>
                <th>{t.admin.teamLastSeen}</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && <tr><td colSpan={3}>{t.common.empty}</td></tr>}
              {members.map((member) => (
                <tr key={member.user_id}>
                  <td data-label={t.admin.teamDiscord} className="mono">{member.discord_user_id}</td>
                  <td data-label={t.admin.teamRole}>
                    {member.role
                      ? <span className={`role-badge role-${member.role}`}>{member.role}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td data-label={t.admin.teamLastSeen} className="mono">
                    {member.checked_at ? d(member.checked_at.slice(0, 10)) : t.admin.teamNever}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="notice notice-info" style={{ marginTop: 14 }}>
          <InfoIcon className="icon" />
          <div><p>{t.admin.roleRefreshNote}</p></div>
        </div>
      </section>

      <section className="panel">
        <h2>{t.admin.permissionsTitle}</h2>
        <p>{t.admin.permissionsLede}</p>
        <div className="table-scroll">
          <table className="data-table matrix">
            <thead>
              <tr>
                <th>{t.admin.permissionColumn}</th>
                {ROLES.map((entry) => <th key={entry}>{entry}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((permission) => (
                <tr key={permission}>
                  <td data-label={t.admin.permissionColumn} className="mono">{permission}</td>
                  {ROLES.map((entry) => {
                    const granted = ROLE_PERMISSIONS[entry].includes(permission);
                    return (
                      <td key={entry} data-label={entry} className={granted ? "yes" : "no"}>
                        {granted ? "✓" : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
