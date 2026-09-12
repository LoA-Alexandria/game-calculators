"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { DEMO_MEMBERS, type RoleMapping } from "../../lib/auth/demo";
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, isRole, type Role } from "../../lib/auth/roles";
import { REPOSITORY_URL } from "../../lib/site";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { SignInCard } from "../components/SignInGate";
import { AlertIcon, InfoIcon, PlusIcon, TrashIcon } from "../components/Icons";

type Tab = "roles" | "team" | "permissions" | "integration";

export default function AdminPage() {
  const { t, d } = useLocale();
  const { session, signOut } = useAuth();
  useDocumentTitle(t.admin.title);
  const [tab, setTab] = useState<Tab>("roles");

  if (!session) return <SignInCard />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "roles", label: t.admin.tabRoles },
    { id: "team", label: t.admin.tabTeam },
    { id: "permissions", label: t.admin.tabPermissions },
    { id: "integration", label: t.admin.tabIntegration },
  ];

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">{t.nav.admin}</div>
          <h1>{t.admin.title}</h1>
        </div>
        <div className="session-chip">
          <span className="who">
            <b>{session.name}</b>
            <span>
              {t.auth.signedInAs} · {session.role}
            </span>
          </span>
          <button className="small-button" type="button" onClick={signOut}>
            {t.auth.signOut}
          </button>
        </div>
      </div>

      <p className="assumption" style={{ marginTop: 0 }}>{t.admin.lede}</p>

      <div className="notice notice-warn" style={{ marginTop: 16 }}>
        <AlertIcon className="icon" />
        <div>
          <strong>{t.auth.demoTitle}</strong>
          <p>{t.auth.demoBody}</p>
        </div>
      </div>

      <div className="tabs" role="tablist" style={{ marginTop: 22 }}>
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "roles" && <RoleMappingPanel />}
      {tab === "team" && (
        <section className="panel">
          <h2>{t.admin.teamTitle}</h2>
          <p>{t.admin.teamLede}</p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.admin.teamName}</th>
                  <th>{t.admin.teamDiscord}</th>
                  <th>{t.admin.teamRole}</th>
                  <th>{t.admin.teamLastSeen}</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_MEMBERS.map((member) => (
                  <tr key={member.id}>
                    <td data-label={t.admin.teamName}>{member.name}</td>
                    <td data-label={t.admin.teamDiscord} className="mono">@{member.discordTag}</td>
                    <td data-label={t.admin.teamRole}>
                      <span className={`role-badge role-${member.role}`}>{member.role}</span>
                    </td>
                    <td data-label={t.admin.teamLastSeen} className="mono">
                      {member.lastSeen ? d(member.lastSeen) : t.admin.teamNever}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "permissions" && <PermissionMatrix />}
      {tab === "integration" && (
        <section className="panel">
          <h2>{t.admin.integrationTitle}</h2>
          <p>{t.admin.integrationLede}</p>
          <ol className="assumption" style={{ margin: 0 }}>
            {t.admin.integrationSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="form-actions">
            <a
              className="button"
              href={`${REPOSITORY_URL}/blob/main/docs/AUTH-AND-CMS.md`}
              target="_blank"
              rel="noreferrer"
            >
              {t.admin.integrationDocs}
            </a>
          </div>
        </section>
      )}
    </>
  );
}

function RoleMappingPanel() {
  const { t } = useLocale();
  const { mappings, setMappings, resetMappings, allows } = useAuth();
  const formId = useId();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [role, setRole] = useState<Role>("guide_writer");

  const editable = allows("roles.assign");

  const add = () => {
    if (!name.trim()) return;
    const entry: RoleMapping = {
      id: `map-${Date.now()}`,
      discordRoleName: name.trim(),
      discordRoleId: id.trim(),
      role,
    };
    setMappings([...mappings, entry]);
    setName("");
    setId("");
  };

  return (
    <section className="panel">
      <h2>{t.admin.mappingTitle}</h2>
      <p>{t.admin.mappingLede}</p>

      {!editable && (
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          <InfoIcon className="icon" />
          <div><p>{t.auth.noAccess}</p></div>
        </div>
      )}

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
              <tr>
                <td colSpan={4}>{t.admin.mappingEmpty}</td>
              </tr>
            )}
            {mappings.map((entry) => (
              <tr key={entry.id}>
                <td data-label={t.admin.mappingRoleName}>{entry.discordRoleName}</td>
                <td data-label={t.admin.mappingRoleId} className="mono">
                  {entry.discordRoleId || "—"}
                </td>
                <td data-label={t.admin.mappingSiteRole}>
                  <span className={`role-badge role-${entry.role}`}>{entry.role}</span>
                </td>
                <td className="actions">
                  <button
                    className="small-button button-danger"
                    type="button"
                    disabled={!editable}
                    aria-label={`${t.admin.mappingRemove}: ${entry.discordRoleName}`}
                    onClick={() => setMappings(mappings.filter((item) => item.id !== entry.id))}
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

      <fieldset disabled={!editable}>
        <legend>{t.admin.mappingAdd}</legend>
        <div className="mapping-form">
          <div className="field">
            <label htmlFor={`${formId}-name`}>{t.admin.mappingRoleName}</label>
            <input
              id={`${formId}-name`}
              value={name}
              placeholder="Guide Team"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-id`}>{t.admin.mappingRoleId}</label>
            <input
              id={`${formId}-id`}
              value={id}
              inputMode="numeric"
              placeholder="100000000000000000"
              onChange={(event) => setId(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-role`}>{t.admin.mappingSiteRole}</label>
            <select
              id={`${formId}-role`}
              value={role}
              onChange={(event) => {
                if (isRole(event.target.value)) setRole(event.target.value);
              }}
            >
              {ROLES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <button className="button button-primary" type="button" onClick={add}>
            <PlusIcon className="icon" />
            {t.admin.mappingAdd}
          </button>
        </div>
        <p className="assumption">{t.admin.mappingIdNote}</p>
      </fieldset>

      <div className="form-actions">
        <button className="small-button" type="button" disabled={!editable} onClick={resetMappings}>
          {t.admin.mappingReset}
        </button>
        <span className="pill pill-warn">{t.admin.mappingLocal}</span>
      </div>
    </section>
  );
}

function PermissionMatrix() {
  const { t } = useLocale();
  return (
    <section className="panel">
      <h2>{t.admin.permissionsTitle}</h2>
      <p>{t.admin.permissionsLede}</p>
      <div className="table-scroll">
        <table className="data-table matrix">
          <thead>
            <tr>
              <th>{t.admin.permissionColumn}</th>
              {ROLES.map((role) => (
                <th key={role}>{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((permission) => (
              <tr key={permission}>
                <td data-label={t.admin.permissionColumn} className="mono">{permission}</td>
                {ROLES.map((role) => {
                  const granted = ROLE_PERMISSIONS[role].includes(permission);
                  return (
                    <td key={role} data-label={role} className={granted ? "yes" : "no"}>
                      {granted ? "✓" : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="assumption">
        <Link href="/guides/new/">{t.nav.newGuide}</Link>
      </p>
    </section>
  );
}
