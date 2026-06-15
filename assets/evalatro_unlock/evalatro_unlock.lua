local enabled = os.getenv("EVALATRO_UNLOCK") == "1"
if not enabled then
  return
end

local applied = false

local function mark_object(obj)
  if type(obj) ~= "table" then
    return
  end
  obj.unlocked = true
  obj.discovered = true
  obj.alerted = true
end

local function mark_table(tbl)
  if type(tbl) ~= "table" then
    return
  end
  for _, obj in pairs(tbl) do
    if type(obj) == "table" and obj[1] ~= nil then
      for _, nested in pairs(obj) do
        mark_object(nested)
      end
    else
      mark_object(obj)
    end
  end
end

local function apply_unlocks()
  if applied or not G or not G.SETTINGS or not G.PROFILES then
    return false
  end

  local profile = G.PROFILES[G.SETTINGS.profile]
  if type(profile) ~= "table" then
    return false
  end

  applied = true
  profile.all_unlocked = true
  profile.evalatro_unlock_all = true

  mark_table(G.P_CENTERS)
  mark_table(G.P_CENTER_POOLS)
  mark_table(G.P_BLINDS)
  mark_table(G.P_TAGS)
  mark_table(G.P_SEALS)

  if G.PROFILES[G.SETTINGS.profile] then
    G.PROFILES[G.SETTINGS.profile].all_unlocked = true
    G.PROFILES[G.SETTINGS.profile].evalatro_unlock_all = true
  end

  pcall(function()
    G:save_progress()
  end)
  pcall(function()
    G:save_settings()
  end)
  sendInfoMessage("Evalatro unlock helper applied to profile " .. tostring(G.SETTINGS.profile), "EVALATRO.UNLOCK")
  return true
end

apply_unlocks()

local love_update = love.update
love.update = function(dt)
  if love_update then
    love_update(dt)
  end
  apply_unlocks()
end

