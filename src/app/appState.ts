export type ImageSessionStatus = "empty" | "loaded";

export interface AppState {
  imageSessionStatus: ImageSessionStatus;
}

export const initialAppState: AppState = {
  imageSessionStatus: "empty",
};
