export interface TrackSourceDataEntry {
  id: string;
  name: string;
  location: string;
  difficulty: string;
  laps: number;
  description: string;
  controlPoints: Array<[number, number, number]>;
}

export const TRACK_SOURCES: TrackSourceDataEntry[];
