export const PLANNER_STORAGE_KEYS = [
  "popepoch-theme",
  "popepoch-scheme",
  "irrigation_planner_v1",
  "irrigation_planner_mode_v1",
  "irrigation_planner_types_v1",
  "irrigation_prod_v1",
  "irrigation_tab_v1",
] as const;

function scriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function prepareSandboxedPlannerHtml(
  trustedHtml: string,
  initialStorage: Record<string, string>,
  parentOrigin: string,
  nonce: string,
) {
  if (!/^\s*<!doctype html>/i.test(trustedHtml) || !trustedHtml.includes("<head>")) {
    throw new Error("Trusted planner document is invalid");
  }

  const storage: Record<string, string> = {};
  let total = 0;
  for (const key of PLANNER_STORAGE_KEYS) {
    const value = initialStorage[key];
    if (typeof value !== "string" || value.length > 100_000 || total + value.length > 200_000) continue;
    storage[key] = value;
    total += value.length;
  }

  // The iframe has an opaque origin. Its code receives only an in-memory copy
  // of the known planner keys and can persist changes through a nonce-checked
  // postMessage bridge; it cannot read the site's Auth localStorage.
  const bootstrap = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data:; manifest-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'">
<script>(function(){
  var keys=${scriptJson(PLANNER_STORAGE_KEYS)};
  var values=new Map(Object.entries(${scriptJson(storage)}));
  var parentOrigin=${scriptJson(parentOrigin)};
  var nonce=${scriptJson(nonce)};
  document.documentElement.classList.add('embedded');
  function snapshot(){var data={};keys.forEach(function(key){if(values.has(key))data[key]=values.get(key)});return data}
  function report(){window.parent.postMessage({type:'popepoch:planner-state',nonce:nonce,storage:snapshot()},parentOrigin)}
  window.__plannerStorage={
    getItem:function(key){key=String(key);return values.has(key)?values.get(key):null},
    setItem:function(key,value){
      key=String(key);value=String(value);
      if(keys.indexOf(key)<0||value.length>100000||values.get(key)===value)return;
      var total=0;values.forEach(function(item,storedKey){if(storedKey!==key)total+=item.length});
      if(total+value.length>200000)return;
      values.set(key,value);report();
    },
    removeItem:function(key){key=String(key);if(values.delete(key))report()}
  };
  window.addEventListener('message',function(event){
    if(event.source===window.parent&&event.origin===parentOrigin&&event.data&&event.data.type==='popepoch:planner-ping'&&event.data.nonce===nonce)report();
  });
  window.addEventListener('load',report);
})();</script>`;

  const isolatedHtml = trustedHtml.replace(/\blocalStorage\b/g, "window.__plannerStorage");
  return isolatedHtml.replace("<head>", `<head>\n${bootstrap}`);
}
