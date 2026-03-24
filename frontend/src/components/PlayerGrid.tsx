import PlayerCard from "./PlayerCard";
import { PlayerCardData } from "../types";
type PlayerGridProps = {
  players: PlayerCardData[];
  onFullStatsClick?: (player: PlayerCardData) => void;
};
function PlayerGrid({ players, onFullStatsClick }: PlayerGridProps): JSX.Element {
  if (players.length === 0) {
    return <></>;
  }
  return (
    <section className="player-grid" aria-label="Search results">
      {players.map((player) => (
        <PlayerCard
          key={player.key}
          data={player}
          onFullStatsClick={onFullStatsClick}
        />
      ))}
    </section>
  );
}
export default PlayerGrid;