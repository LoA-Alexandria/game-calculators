export const ROLE_ID_PICKER_BUTTON = "benben:show-role-id-picker";
export const ROLE_ID_PICKER_SELECT = "benben:role-id-picker";

export function roleIdPickerActionRow() {
  return {
    type: 1,
    components: [{
      type: 2,
      style: 2,
      label: "Get a role ID",
      custom_id: ROLE_ID_PICKER_BUTTON,
    }],
  };
}

export function roleIdPickerSelectActionRow() {
  return {
    type: 1,
    components: [{
      type: 6,
      custom_id: ROLE_ID_PICKER_SELECT,
      placeholder: "Choose a server role",
      min_values: 1,
      max_values: 1,
    }],
  };
}

export function selectedRoleId(values: unknown): string | null {
  if (!Array.isArray(values) || values.length !== 1) return null;
  const roleId = values[0];
  return typeof roleId === "string" && /^\d{17,20}$/.test(roleId) ? roleId : null;
}
