const BASE = '';

async function req(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  return res.json();
}

const get  = (path)        => req('GET',    path);
const post = (path, body)  => req('POST',   path, body);
const put  = (path, body)  => req('PUT',    path, body);
const del  = (path)        => req('DELETE', path);

// Campaigns
export const getCampaigns      = ()                    => get('/api/campaigns');
export const createCampaign    = (name)                => post('/api/campaigns', { name });
export const updateCampaign    = (id, data)            => put(`/api/campaigns/${id}`, data);
export const deleteCampaign    = (id)                  => del(`/api/campaigns/${id}`);

// Characters
export const getCharacters     = ()                    => get('/api/characters');
export const addCharacter      = (cid, data)           => post(`/api/campaigns/${cid}/characters`, data);
export const updateCharacter   = (cid, chid, data)     => put(`/api/campaigns/${cid}/characters/${chid}`, data);
export const deleteCharacter   = (cid, chid)           => del(`/api/campaigns/${cid}/characters/${chid}`);

// Adventures / game data
export const getAdventures     = ()                    => get('/api/adventures');
export const getAdventure      = (id)                  => get(`/api/adventures/${id}`);
export const getScenario       = (aid, sid)            => get(`/api/adventures/${aid}/scenarios/${sid}`);
export const getLore           = (cardName)            => get(`/api/lore/${encodeURIComponent(cardName)}`);

// Locations
export const getLocations      = ()                    => get('/api/locations');
export const getLocation       = (name)                => get(`/api/locations/${encodeURIComponent(name)}`);

// Sessions
export const createSession     = (data)                => post('/api/sessions', data);
export const getSession        = (id)                  => get(`/api/sessions/${id}`);
export const getSessionLog     = (id)                  => get(`/api/sessions/${id}/log`);

// Session actions
export const actionExplore       = (id, data)          => post(`/api/sessions/${id}/actions/explore`,        data);
export const actionMove          = (id, data)          => post(`/api/sessions/${id}/actions/move`,           data);
export const actionEndTurn       = (id)                => post(`/api/sessions/${id}/actions/end-turn`,       {});
export const actionCloseLocation = (id, data)          => post(`/api/sessions/${id}/actions/close-location`, data);
export const actionEncounter     = (id, data)          => post(`/api/sessions/${id}/actions/encounter`,       data);
export const actionDamage        = (id, data)          => post(`/api/sessions/${id}/actions/damage`,          data);
export const actionSetHand       = (id, data)          => post(`/api/sessions/${id}/actions/set-hand`,        data);
export const actionTempClose     = (id, data)          => post(`/api/sessions/${id}/actions/temp-close`,      data);

// Card search
export const searchCards = (q)           => get(`/api/cards/search?q=${encodeURIComponent(q)}`);
export const getCard     = (name)        => get(`/api/cards/${encodeURIComponent(name)}`);
