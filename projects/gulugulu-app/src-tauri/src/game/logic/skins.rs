use crate::game::*;

// ---------------------------------------------------------------------------
// 皮肤选择/收藏的纯逻辑（SkinWorkshop.md）。四源皮肤：
//   "default"    = 同元素组合的 0 号固定配方物种形态（虚拟源，不落表）
//   "local"      = custom_species 本体形象（缺省值 = 删键）
//   "ws:<fileId>"= species_skins 里已导入的工坊皮肤（首发/分享）
// 选择按物种统一生效（一物种一选择）；只有 AI 自定义物种可换肤。
// ---------------------------------------------------------------------------

pub const SKIN_DEFAULT: &str = "default";
pub const SKIN_LOCAL: &str = "local";
pub const SKIN_WS_PREFIX: &str = "ws:";

/// 某皮肤 id 是否已导入该物种的收藏列表。
pub(crate) fn skin_installed(save: &GameSave, codename: &str, skin_id: &str) -> bool {
    save.species_skins
        .get(codename)
        .map(|list| list.iter().any(|s| s.id == skin_id))
        .unwrap_or(false)
}

/// 选皮肤（一物种一选择，作用于该物种全部个体、全部场景）。
/// - 目录固定物种一律拒绝（皮肤仅 AI 自定义物种）。
/// - "local"：删键（缺省即 local，存档保持精简）。
/// - "default"：需本体 entry 存在（元素集合来自它）且该配方有 0 号固定物种。
/// - "ws:<fileId>"：需本体 entry 存在（未获得的物种无处渲染）且皮肤已导入。
pub fn logic_select_skin(
    config: &GameConfig,
    save: &mut GameSave,
    codename: &str,
    skin_id: &str,
) -> Result<(), String> {
    if config.species.contains_key(codename) {
        return Err("#skinNotAiSpecies".to_string());
    }
    if skin_id == SKIN_LOCAL {
        save.skin_selected.remove(codename);
        return Ok(());
    }
    let entry = save
        .custom_species
        .get(codename)
        .ok_or_else(|| "#skinSpeciesUnknown".to_string())?;
    if skin_id == SKIN_DEFAULT {
        let recipe_key = crate::fusion_slots::element_set_key(&entry.info.elements);
        if !config.species_by_recipe.contains_key(&recipe_key) {
            return Err("#skinDefaultUnavailable".to_string());
        }
    } else if let Some(_file_id) = skin_id.strip_prefix(SKIN_WS_PREFIX) {
        if !skin_installed(save, codename, skin_id) {
            return Err("#skinNotInstalled".to_string());
        }
    } else {
        return Err("#skinInvalidId".to_string());
    }
    save.skin_selected
        .insert(codename.to_string(), skin_id.to_string());
    Ok(())
}

/// 导入/安装一张工坊皮肤。按 publishedFileId 去重：已存在 → 刷新元数据与形象
/// （工坊条目可能更新过）并返回 `Ok(false)`；新条目超过 MAX_SKINS_PER_SPECIES
/// 拒收。允许先于物种获得而入库（不注册物种、不动图鉴进度）。
pub fn logic_install_skin(
    save: &mut GameSave,
    codename: &str,
    skin: SpeciesSkin,
) -> Result<bool, String> {
    if !skin.id.starts_with(SKIN_WS_PREFIX) {
        return Err("#skinInvalidId".to_string());
    }
    let list = save.species_skins.entry(codename.to_string()).or_default();
    if let Some(existing) = list
        .iter_mut()
        .find(|s| s.published_file_id == skin.published_file_id)
    {
        existing.visual = skin.visual;
        existing.name_zh = skin.name_zh;
        existing.time_created = skin.time_created;
        existing.imported_at = skin.imported_at;
        if skin.author_persona.is_some() {
            existing.author_persona = skin.author_persona;
        }
        return Ok(false);
    }
    if list.len() >= MAX_SKINS_PER_SPECIES {
        return Err("#skinCapReached".to_string());
    }
    list.push(skin);
    Ok(true)
}

/// 移除已导入皮肤；若正被选中则回落 "local"（删选择键）。列表清空时收掉整个键。
#[allow(dead_code)] // 命令层后续接入（图鉴收藏管理）；纯逻辑先行并入测试面。
pub fn logic_remove_skin(save: &mut GameSave, codename: &str, skin_id: &str) -> Result<(), String> {
    let list = save
        .species_skins
        .get_mut(codename)
        .ok_or_else(|| "#skinNotInstalled".to_string())?;
    let index = list
        .iter()
        .position(|s| s.id == skin_id)
        .ok_or_else(|| "#skinNotInstalled".to_string())?;
    list.remove(index);
    if list.is_empty() {
        save.species_skins.remove(codename);
    }
    if save.skin_selected.get(codename).map(String::as_str) == Some(skin_id) {
        save.skin_selected.remove(codename);
    }
    Ok(())
}
