import { ReactNode } from "react";
import { StateT, CardT } from "../api-types";
import { Card, Joker, Consumable, ItemCard, Priced } from "./cards";

const STATE_LABEL: Record<string, string> = {
  MENU: "Menu", BLIND_SELECT: "Blind select", SELECTING_HAND: "Playing hand",
  ROUND_EVAL: "Round won", SHOP: "Shop", SMODS_BOOSTER_OPENED: "Booster pack", GAME_OVER: "Game over",
};

/** The schematic Balatro board for a single state — shared by Live and the Game replay. */
export function BoardView({ s, played }: { s: StateT; played?: Set<number> }) {
  const blind: any = s.blind || {};
  const target = s.score?.target || blind.score || 0;
  const chips = s.score?.chips || 0;
  const type = (blind.type || "SMALL").toUpperCase();
  const bcls = ["SMALL", "BIG", "BOSS"].includes(type) ? type : "SMALL";
  const chipGlyph = type === "BOSS" ? "☠" : type === "BIG" ? "●" : "◆";
  const pct = target ? Math.min(100, (chips / target) * 100) : 0;
  let eff = blind.effect || "";
  if (blind.skip_tag) eff += (eff ? " · " : "") + `skip ⇒ ${blind.skip_tag}`;
  if (s.state === "BLIND_SELECT" && s.blinds && type !== "BOSS") eff += (eff ? " · " : "") + `boss ahead: ${s.blinds.boss.name}`;

  const hand = s.hand_cards || [], jok = s.jokers || [], cons = s.consumables || [];
  const showShop = s.state === "SHOP" && s.shop;
  const packOpen = s.state === "SMODS_BOOSTER_OPENED" && s.pack?.cards?.length;

  return (
    <div className="panel table-panel">
      <div className="stats">
        <Stat k="Ante" v={s.ante ?? 0} />
        <Stat k="Round" v={s.round ?? 0} />
        <Stat k="Money" v={"$" + (s.money ?? 0)} cls="money" />
        <Stat k="Hands" v={s.hands_left ?? 0} cls="hands" />
        <Stat k="Discards" v={s.discards_left ?? 0} cls="disc" />
        <div className="stat"><div className="k">Phase</div><div className="v small"><span className="state-pill">{STATE_LABEL[s.state] || s.state || "—"}</span></div></div>
      </div>

      <div className={"blind " + bcls}>
        <div className="chip">{chipGlyph}</div>
        <div style={{ flex: 1 }}>
          <div className="name">{blind.name || (s.state === "SHOP" ? "Shop" : "—")}</div>
          <div className="effect">{eff || (target ? `Beat ${target} chips` : "")}</div>
        </div>
      </div>
      <div className={"scoreband" + (target > 0 && chips >= target ? " beaten" : "")}>
        <div className="scorefill" style={{ width: pct + "%" }} />
        <div className="scoretext">{chips.toLocaleString()} / {target.toLocaleString()}</div>
      </div>

      <CardRow label="Jokers" extra="(order matters →)" count={jok.length}>
        {jok.map((c, i) => <Joker key={i} c={c} i={i} />)}
      </CardRow>
      <CardRow label="Hand" count={hand.length}>
        {hand.map((c) => <Card key={c.index} c={c} played={played?.has(c.index)} />)}
      </CardRow>
      {cons.length > 0 && (
        <CardRow label="Consumables" count={cons.length}>
          {cons.map((c, i) => <Consumable key={i} c={c} />)}
        </CardRow>
      )}

      {showShop && (
        <div className="cardrow">
          <div className="label">Shop</div>
          <div className="shopgrid">
            <ShopCol title="Cards" items={s.shop!.cards} />
            <ShopCol title="Vouchers" items={s.shop!.vouchers} />
            <ShopCol title="Packs" items={s.shop!.packs} />
          </div>
        </div>
      )}

      {packOpen && (
        <CardRow label="Booster pack" extra="— pick by index or skip">
          {s.pack!.cards.map((c, i) => <ItemCard key={i} c={c} idx={i} />)}
        </CardRow>
      )}
    </div>
  );
}

function Stat({ k, v, cls }: { k: string; v: ReactNode; cls?: string }) {
  return <div className="stat"><div className="k">{k}</div><div className={"v " + (cls || "")}>{v}</div></div>;
}
function CardRow({ label, extra, count, children }: { label: string; extra?: string; count?: number; children: ReactNode }) {
  const empty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div className="cardrow">
      <div className="label">{label}{count != null && count > 0 && <span className="muted">({count})</span>}{extra && <span style={{ opacity: 0.5 }}>{extra}</span>}</div>
      <div className={"cards" + (empty ? " empty" : "")}>{children}</div>
    </div>
  );
}
function ShopCol({ title, items }: { title: string; items: CardT[] }) {
  if (!items || !items.length) return null;
  return (
    <div className="shopcol">
      <div className="label">{title}</div>
      <div className="cards">{items.map((c, i) => <Priced key={i} cost={c.buy_cost}><ItemCard c={c} idx={i} /></Priced>)}</div>
    </div>
  );
}
