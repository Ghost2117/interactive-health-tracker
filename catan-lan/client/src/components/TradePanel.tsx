import { useState } from 'react';
import type { Action } from '../../../shared/actions.js';
import { getBankTradeRate } from '../../../shared/engine.js';
import type { ClientGameState } from '../../../shared/protocol.js';
import { RESOURCES, type Resource } from '../../../shared/types.js';
import { RESOURCE_LABELS } from '../boardColors.js';

interface Props {
  state: ClientGameState;
  selfId: string;
  dispatch: (action: Action) => void;
  onClose: () => void;
}

function emptyAmounts(): Record<Resource, number> {
  return { brick: 0, lumber: 0, ore: 0, grain: 0, wool: 0 };
}

function toPartial(amounts: Record<Resource, number>): Partial<Record<Resource, number>> {
  const result: Partial<Record<Resource, number>> = {};
  for (const r of RESOURCES) if (amounts[r] > 0) result[r] = amounts[r];
  return result;
}

export function TradePanel({ state, selfId, dispatch, onClose }: Props) {
  const self = state.players.find((p) => p.id === selfId)!;
  const isMyTurn = state.players[state.currentPlayerIndex].id === selfId;

  const [bankGive, setBankGive] = useState<Resource>('brick');
  const [bankWant, setBankWant] = useState<Resource>('lumber');
  const [offerGive, setOfferGive] = useState(emptyAmounts());
  const [offerWant, setOfferWant] = useState(emptyAmounts());

  const rate = self.resources ? getBankTradeRate(state, self, bankGive) : 4;

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Trade</h3>
          <button onClick={onClose} style={closeBtn}>
            ✕
          </button>
        </div>

        <section>
          <h4 style={sectionTitle}>Bank / Port Trade</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Give {rate}x</span>
            <select value={bankGive} onChange={(e) => setBankGive(e.target.value as Resource)}>
              {RESOURCES.map((r) => (
                <option key={r} value={r}>
                  {RESOURCE_LABELS[r]}
                </option>
              ))}
            </select>
            <span>for 1</span>
            <select value={bankWant} onChange={(e) => setBankWant(e.target.value as Resource)}>
              {RESOURCES.map((r) => (
                <option key={r} value={r}>
                  {RESOURCE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              style={enabledBtn}
              disabled={!self.resources || self.resources[bankGive] < rate || bankGive === bankWant}
              onClick={() => dispatch({ type: 'BANK_TRADE', give: bankGive, want: bankWant, giveCount: rate })}
            >
              Trade
            </button>
          </div>
        </section>

        {isMyTurn && !state.activeTrade && (
          <section>
            <h4 style={sectionTitle}>Offer a Trade to Other Players</h4>
            <ResourceAmountGrid label="You give" amounts={offerGive} setAmounts={setOfferGive} max={self.resources} />
            <ResourceAmountGrid label="You want" amounts={offerWant} setAmounts={setOfferWant} />
            <button
              style={{ ...enabledBtn, marginTop: 8 }}
              onClick={() => dispatch({ type: 'OFFER_TRADE', give: toPartial(offerGive), want: toPartial(offerWant) })}
            >
              Propose Trade
            </button>
          </section>
        )}

        {state.activeTrade && (
          <ActiveTradeSection state={state} selfId={selfId} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}

function ActiveTradeSection({ state, selfId, dispatch }: { state: ClientGameState; selfId: string; dispatch: (a: Action) => void }) {
  const trade = state.activeTrade!;
  const proposer = state.players.find((p) => p.id === trade.fromPlayerId)!;
  const isProposer = trade.fromPlayerId === selfId;
  const myResponse = trade.responses[selfId];

  return (
    <section>
      <h4 style={sectionTitle}>Active Trade</h4>
      <p style={{ fontSize: 13 }}>
        <strong>{proposer.name}</strong> offers {describeAmounts(trade.give)} for {describeAmounts(trade.want)}
      </p>

      {isProposer ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(trade.responses).map(([playerId, response]) => {
            const player = state.players.find((p) => p.id === playerId)!;
            return (
              <div key={playerId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span>
                  {player.name}: {response}
                </span>
                {response === 'accepted' && (
                  <button style={enabledBtn} onClick={() => dispatch({ type: 'EXECUTE_TRADE', tradeId: trade.id, withPlayerId: playerId })}>
                    Trade with {player.name}
                  </button>
                )}
              </div>
            );
          })}
          <button style={enabledBtn} onClick={() => dispatch({ type: 'CANCEL_TRADE', tradeId: trade.id })}>
            Cancel Trade
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          {myResponse === 'pending' ? (
            <>
              <button style={enabledBtn} onClick={() => dispatch({ type: 'RESPOND_TRADE', tradeId: trade.id, accept: true })}>
                Accept
              </button>
              <button style={enabledBtn} onClick={() => dispatch({ type: 'RESPOND_TRADE', tradeId: trade.id, accept: false })}>
                Reject
              </button>
            </>
          ) : (
            <span style={{ fontSize: 13, color: '#666' }}>You {myResponse} this offer.</span>
          )}
        </div>
      )}
    </section>
  );
}

function describeAmounts(amounts: Partial<Record<Resource, number>>): string {
  const parts = Object.entries(amounts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([r, n]) => `${n} ${r}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

function ResourceAmountGrid({
  label,
  amounts,
  setAmounts,
  max,
}: {
  label: string;
  amounts: Record<Resource, number>;
  setAmounts: (a: Record<Resource, number>) => void;
  max?: Record<Resource, number> | null;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {RESOURCES.map((r) => (
          <label key={r} style={{ fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {RESOURCE_LABELS[r]}
            <input
              type="number"
              min={0}
              max={max ? max[r] : 19}
              value={amounts[r]}
              onChange={(e) => setAmounts({ ...amounts, [r]: Math.max(0, Number(e.target.value)) })}
              style={{ width: 48 }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 20,
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: 16,
  width: 'min(90vw, 480px)',
  maxHeight: '85vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const sectionTitle: React.CSSProperties = { margin: '0 0 8px 0', fontSize: 14 };

const closeBtn: React.CSSProperties = { border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' };

const enabledBtn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid #2f6b3a',
  background: '#fff',
  color: '#2f6b3a',
  cursor: 'pointer',
  fontSize: 13,
};
